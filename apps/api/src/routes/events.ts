/**
 * Event Ingestion Routes
 *
 * Receives custom events from customer's API, triggers matching workflows,
 * and resumes waiting executions.
 */

import { contact, db, eq, workflow, workflowExecution } from "@wraps/db";
import { and, sql } from "drizzle-orm";
import { t } from "elysia";

import {
  type AuthContext,
  createAuthenticatedRoutes,
} from "../middleware/auth";
import {
  deleteScheduledStep,
  enqueueWorkflowStep,
} from "../services/workflow-queue";

export const eventsRoutes = createAuthenticatedRoutes("/v1/events")

  /**
   * Ingest a custom event
   *
   * POST /v1/events
   *
   * Triggers any workflows listening for this event and resumes
   * executions waiting for this event.
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

      // 1. Find and trigger matching workflows
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

      // 2. Resume executions waiting for this event
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
        }),
        contactId: t.Optional(t.String({ description: "Contact ID" })),
        contactEmail: t.Optional(
          t.String({ description: "Contact email (alternative to contactId)" })
        ),
        properties: t.Optional(
          t.Record(t.String(), t.Unknown(), { description: "Event properties" })
        ),
      }),
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

      return {
        success: results.errors.length === 0,
        ...results,
      };
    },
    {
      body: t.Object({
        events: t.Array(
          t.Object({
            name: t.String(),
            contactId: t.Optional(t.String()),
            contactEmail: t.Optional(t.String()),
            properties: t.Optional(t.Record(t.String(), t.Unknown())),
          })
        ),
      }),
      detail: {
        summary: "Batch ingest events",
        description: "Process multiple events in a single request",
        tags: ["events"],
      },
    }
  );
