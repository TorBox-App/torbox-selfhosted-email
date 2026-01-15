/**
 * Event Ingestion Routes
 *
 * Receives custom events from customer's API, triggers matching workflows,
 * and resumes waiting executions.
 *
 * Event limits (2026 pricing model):
 * - Starter: 50,000 events/month
 * - Growth: 250,000 events/month
 * - Scale: 1,000,000 events/month
 * - Enterprise: Unlimited
 *
 * Soft cap with 25% grace period (blocks at 125% of limit).
 */

import {
  contact,
  contactEvent,
  db,
  eq,
  workflow,
  workflowExecution,
} from "@wraps/db";
import { and, sql } from "drizzle-orm";
import { t } from "elysia";

import {
  type AuthContext,
  createAuthenticatedRoutes,
} from "../middleware/auth";
import {
  eventLimitMiddleware,
  getEventTTLExpiration,
  incrementEventUsage,
} from "../middleware/event-limit";
import {
  deleteScheduledStep,
  enqueueWorkflowStep,
} from "../services/workflow-queue";

// Common response schemas
const _errorResponse = t.Object({
  error: t.String({ description: "Error message" }),
});

// OpenAPI 3.0 compatible arbitrary properties object
const propertiesSchema = t.Optional(
  t.Object({}, { additionalProperties: true, description: "Event properties" })
);

export const eventsRoutes = createAuthenticatedRoutes("/v1/events")
  // Apply event limit middleware (checks usage before allowing ingestion)
  .use(eventLimitMiddleware)

  /**
   * Ingest a custom event
   *
   * POST /v1/events
   *
   * Stores the event, triggers any workflows listening for this event,
   * and resumes executions waiting for this event.
   */
  .post(
    "/",
    async (ctx) => {
      const { body } = ctx;
      const auth = (ctx as unknown as { auth: AuthContext }).auth;
      const { name, contactId, contactEmail, properties } = body;

      // Find the contact
      let contactRecord: typeof contact.$inferSelect | undefined;

      if (contactId) {
        const [c] = await db
          .select()
          .from(contact)
          .where(
            and(
              eq(contact.id, contactId),
              eq(contact.organizationId, auth.organizationId)
            )
          )
          .limit(1);
        contactRecord = c;
      } else if (contactEmail) {
        const [c] = await db
          .select()
          .from(contact)
          .where(
            and(
              eq(contact.email, contactEmail),
              eq(contact.organizationId, auth.organizationId)
            )
          )
          .limit(1);
        contactRecord = c;
      }

      if (!contactRecord) {
        return {
          success: false,
          error: "Contact not found",
        };
      }

      const results = {
        workflowsTriggered: 0,
        executionsResumed: 0,
      };

      // 1. Store the event in contactEvent table with 2-year TTL
      await db.insert(contactEvent).values({
        contactId: contactRecord.id,
        organizationId: auth.organizationId,
        eventName: name,
        eventData: properties || {},
        expiresAt: getEventTTLExpiration(),
      });

      // 2. Increment event usage counter
      await incrementEventUsage(auth.organizationId);

      // 3. Find and trigger matching workflows
      const matchingWorkflows = await db
        .select()
        .from(workflow)
        .where(
          and(
            eq(workflow.organizationId, auth.organizationId),
            eq(workflow.status, "enabled"),
            eq(workflow.triggerType, "event"),
            sql`${workflow.triggerConfig}->>'eventName' = ${name}`
          )
        );

      for (const wf of matchingWorkflows) {
        await enqueueWorkflowStep({
          type: "trigger",
          workflowId: wf.id,
          contactId: contactRecord.id,
          organizationId: auth.organizationId,
          eventData: properties || {},
        });
        results.workflowsTriggered++;
      }

      // 4. Resume executions waiting for this event
      const waitingExecutions = await db
        .select()
        .from(workflowExecution)
        .where(
          and(
            eq(workflowExecution.organizationId, auth.organizationId),
            eq(workflowExecution.contactId, contactRecord.id),
            eq(workflowExecution.status, "waiting"),
            eq(workflowExecution.waitingForEvent, name)
          )
        );

      for (const execution of waitingExecutions) {
        // Cancel timeout scheduler
        if (execution.waitTimeoutSchedulerName) {
          await deleteScheduledStep(execution.waitTimeoutSchedulerName);
        }

        // Resume with 'yes' branch (event received)
        await enqueueWorkflowStep({
          type: "resume",
          executionId: execution.id,
          branch: "yes",
          organizationId: auth.organizationId,
        });
        results.executionsResumed++;
      }

      // Update contact last activity
      await db
        .update(contact)
        .set({ lastActivityAt: new Date() })
        .where(eq(contact.id, contactRecord.id));

      return {
        success: true,
        ...results,
      };
    },
    {
      body: t.Object({
        name: t.String({
          description: "Event name (e.g., 'purchase.completed')",
          maxLength: 255,
        }),
        contactId: t.Optional(
          t.String({ description: "Contact ID", maxLength: 36 })
        ),
        contactEmail: t.Optional(
          t.String({
            description: "Contact email (alternative to contactId)",
            maxLength: 255,
          })
        ),
        properties: propertiesSchema,
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          workflowsTriggered: t.Number({
            description: "Number of workflows triggered",
          }),
          executionsResumed: t.Number({
            description: "Number of executions resumed",
          }),
        }),
        400: t.Object({
          success: t.Literal(false),
          error: t.String(),
        }),
      },
      detail: {
        summary: "Ingest event",
        description:
          "Send a custom event to trigger workflows and resume waiting executions",
        tags: ["events"],
      },
    }
  )

  /**
   * Batch ingest events
   *
   * POST /v1/events/batch
   *
   * Process multiple events in a single request.
   */
  .post(
    "/batch",
    async (ctx) => {
      const { body } = ctx;
      const auth = (ctx as unknown as { auth: AuthContext }).auth;
      const results = {
        processed: 0,
        workflowsTriggered: 0,
        executionsResumed: 0,
        errors: [] as string[],
      };

      for (const event of body.events) {
        try {
          // Find contact
          let contactRecord: typeof contact.$inferSelect | undefined;

          if (event.contactId) {
            const [c] = await db
              .select()
              .from(contact)
              .where(
                and(
                  eq(contact.id, event.contactId),
                  eq(contact.organizationId, auth.organizationId)
                )
              )
              .limit(1);
            contactRecord = c;
          } else if (event.contactEmail) {
            const [c] = await db
              .select()
              .from(contact)
              .where(
                and(
                  eq(contact.email, event.contactEmail),
                  eq(contact.organizationId, auth.organizationId)
                )
              )
              .limit(1);
            contactRecord = c;
          }

          if (!contactRecord) {
            results.errors.push(`Contact not found for event ${event.name}`);
            continue;
          }

          // Store the event in contactEvent table with 2-year TTL
          await db.insert(contactEvent).values({
            contactId: contactRecord.id,
            organizationId: auth.organizationId,
            eventName: event.name,
            eventData: event.properties || {},
            expiresAt: getEventTTLExpiration(),
          });

          // Trigger matching workflows
          const matchingWorkflows = await db
            .select()
            .from(workflow)
            .where(
              and(
                eq(workflow.organizationId, auth.organizationId),
                eq(workflow.status, "enabled"),
                eq(workflow.triggerType, "event"),
                sql`${workflow.triggerConfig}->>'eventName' = ${event.name}`
              )
            );

          for (const wf of matchingWorkflows) {
            await enqueueWorkflowStep({
              type: "trigger",
              workflowId: wf.id,
              contactId: contactRecord.id,
              organizationId: auth.organizationId,
              eventData: event.properties || {},
            });
            results.workflowsTriggered++;
          }

          // Resume waiting executions
          const waitingExecutions = await db
            .select()
            .from(workflowExecution)
            .where(
              and(
                eq(workflowExecution.organizationId, auth.organizationId),
                eq(workflowExecution.contactId, contactRecord.id),
                eq(workflowExecution.status, "waiting"),
                eq(workflowExecution.waitingForEvent, event.name)
              )
            );

          for (const execution of waitingExecutions) {
            if (execution.waitTimeoutSchedulerName) {
              await deleteScheduledStep(execution.waitTimeoutSchedulerName);
            }
            await enqueueWorkflowStep({
              type: "resume",
              executionId: execution.id,
              branch: "yes",
              organizationId: auth.organizationId,
            });
            results.executionsResumed++;
          }

          results.processed++;
        } catch (error) {
          results.errors.push(
            `Error processing event ${event.name}: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
      }

      // Increment event usage counter with total processed count
      if (results.processed > 0) {
        await incrementEventUsage(auth.organizationId, results.processed);
      }

      return {
        success: results.errors.length === 0,
        ...results,
      };
    },
    {
      body: t.Object({
        events: t.Array(
          t.Object({
            name: t.String({ maxLength: 255 }),
            contactId: t.Optional(t.String({ maxLength: 36 })),
            contactEmail: t.Optional(t.String({ maxLength: 255 })),
            properties: t.Optional(
              t.Object({}, { additionalProperties: true })
            ),
          }),
          { description: "List of events to process" }
        ),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          processed: t.Number({ description: "Number of events processed" }),
          workflowsTriggered: t.Number({
            description: "Total workflows triggered",
          }),
          executionsResumed: t.Number({
            description: "Total executions resumed",
          }),
          errors: t.Array(t.String(), { description: "Error messages if any" }),
        }),
      },
      detail: {
        summary: "Batch ingest events",
        description: "Process multiple events in a single request",
        tags: ["events"],
      },
    }
  );
