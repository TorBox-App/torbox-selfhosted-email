/**
 * Workflow Trigger Routes
 *
 * API endpoints for directly triggering workflows.
 * Used for workflows with triggerType "api" that are triggered
 * by external systems or customer code.
 */

import { contact, db, eq, workflow } from "@wraps/db";
import { and, inArray } from "drizzle-orm";
import { t } from "elysia";

import { log } from "../../lib/logger";
import {
  type AuthContext,
  createAuthenticatedRoutes,
} from "../../middleware/auth";
import { rateLimitMiddleware } from "../../middleware/rate-limit";
import {
  enqueueWorkflowStep,
  enqueueWorkflowStepBatch,
  type WorkflowJob,
} from "../../services/workflow-queue";

// Common response schemas
const _errorResponse = t.Object({
  success: t.Literal(false),
  error: t.String({ description: "Error message" }),
});

// OpenAPI 3.0 compatible arbitrary properties object
const dataSchema = t.Optional(
  t.Object(
    {},
    { additionalProperties: true, description: "Data to pass to the workflow" }
  )
);

export const workflowsRoutes = createAuthenticatedRoutes("/v1/workflows")
  .use(rateLimitMiddleware)

  /**
   * Trigger a workflow via API
   *
   * POST /v1/workflows/:workflowId/trigger
   *
   * Triggers a specific workflow for a contact. The workflow must have
   * triggerType "api" and be enabled.
   */
  .post(
    "/:workflowId/trigger",
    async (ctx) => {
      const { params, body } = ctx;
      const auth = (ctx as unknown as { auth: AuthContext }).auth;
      const { workflowId } = params;
      const { contactId, contactEmail, data } = body;

      // Find the workflow
      const [wf] = await db
        .select()
        .from(workflow)
        .where(
          and(
            eq(workflow.id, workflowId),
            eq(workflow.organizationId, auth.organizationId)
          )
        )
        .limit(1);

      if (!wf) {
        return {
          success: false,
          error: "Workflow not found",
        };
      }

      // Check workflow is enabled
      if (wf.status !== "enabled") {
        return {
          success: false,
          error: "Workflow is not enabled",
        };
      }

      // Check workflow has api trigger type
      if (wf.triggerType !== "api") {
        return {
          success: false,
          error: `Workflow has trigger type "${wf.triggerType}", expected "api"`,
        };
      }

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

      // Enqueue the workflow trigger
      await enqueueWorkflowStep({
        type: "trigger",
        workflowId: wf.id,
        contactId: contactRecord.id,
        organizationId: auth.organizationId,
        eventData: data || {},
      });

      log.info("Workflow API trigger", {
        workflowId: wf.id,
        contactId: contactRecord.id,
      });

      return {
        success: true,
        message: "Workflow triggered successfully",
        workflowId: wf.id,
        workflowName: wf.name,
        contactId: contactRecord.id,
      };
    },
    {
      params: t.Object({
        workflowId: t.String({
          description: "Workflow ID to trigger",
          maxLength: 36,
        }),
      }),
      body: t.Object({
        contactId: t.Optional(
          t.String({ description: "Contact ID", maxLength: 36 })
        ),
        contactEmail: t.Optional(
          t.String({
            description: "Contact email (alternative to contactId)",
            maxLength: 255,
          })
        ),
        data: dataSchema,
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.Optional(t.String()),
          workflowId: t.Optional(t.String()),
          workflowName: t.Optional(t.String()),
          contactId: t.Optional(t.String()),
          error: t.Optional(t.String()),
        }),
      },
      detail: {
        summary: "Trigger workflow",
        description:
          "Trigger a specific workflow for a contact. The workflow must have triggerType 'api' and be enabled.",
        tags: ["workflows"],
      },
    }
  )

  /**
   * Batch trigger a workflow for multiple contacts
   *
   * POST /v1/workflows/:workflowId/trigger/batch
   *
   * Triggers a workflow for multiple contacts at once.
   */
  .post(
    "/:workflowId/trigger/batch",
    async (ctx) => {
      const { params, body } = ctx;
      const auth = (ctx as unknown as { auth: AuthContext }).auth;
      const { workflowId } = params;
      const { contacts, data } = body;

      // Find the workflow
      const [wf] = await db
        .select()
        .from(workflow)
        .where(
          and(
            eq(workflow.id, workflowId),
            eq(workflow.organizationId, auth.organizationId)
          )
        )
        .limit(1);

      if (!wf) {
        return {
          success: false,
          error: "Workflow not found",
        };
      }

      // Check workflow is enabled
      if (wf.status !== "enabled") {
        return {
          success: false,
          error: "Workflow is not enabled",
        };
      }

      // Check workflow has api trigger type
      if (wf.triggerType !== "api") {
        return {
          success: false,
          error: `Workflow has trigger type "${wf.triggerType}", expected "api"`,
        };
      }

      const results = {
        triggered: 0,
        errors: [] as string[],
      };

      // Batch fetch all contacts in 2 queries (by ID and by email) instead of N queries
      const contactIds = contacts
        .filter((c) => c.contactId)
        .map((c) => c.contactId as string);
      const contactEmails = contacts
        .filter((c) => c.contactEmail && !c.contactId)
        .map((c) => c.contactEmail as string);

      // Fetch contacts by ID
      const contactsById = new Map<string, typeof contact.$inferSelect>();
      if (contactIds.length > 0) {
        const foundById = await db
          .select()
          .from(contact)
          .where(
            and(
              inArray(contact.id, contactIds),
              eq(contact.organizationId, auth.organizationId)
            )
          );
        for (const c of foundById) {
          contactsById.set(c.id, c);
        }
      }

      // Fetch contacts by email
      const contactsByEmail = new Map<string, typeof contact.$inferSelect>();
      if (contactEmails.length > 0) {
        const foundByEmail = await db
          .select()
          .from(contact)
          .where(
            and(
              inArray(contact.email, contactEmails),
              eq(contact.organizationId, auth.organizationId)
            )
          );
        for (const c of foundByEmail) {
          if (c.email) {
            contactsByEmail.set(c.email, c);
          }
        }
      }

      // Process each contact request and collect jobs for batch enqueue.
      // Deduplicate by resolved contactId to prevent double-triggering.
      const jobs: WorkflowJob[] = [];
      const seenContactIds = new Set<string>();
      for (const c of contacts) {
        let contactRecord: typeof contact.$inferSelect | undefined;

        if (c.contactId) {
          contactRecord = contactsById.get(c.contactId);
        } else if (c.contactEmail) {
          contactRecord = contactsByEmail.get(c.contactEmail);
        }

        if (!contactRecord) {
          results.errors.push(
            `Contact not found: ${c.contactId || c.contactEmail}`
          );
          continue;
        }

        if (seenContactIds.has(contactRecord.id)) {
          continue;
        }
        seenContactIds.add(contactRecord.id);

        jobs.push({
          type: "trigger",
          workflowId: wf.id,
          contactId: contactRecord.id,
          organizationId: auth.organizationId,
          eventData: { ...(data || {}), ...(c.data || {}) },
        });

        results.triggered++;
      }

      // Batch enqueue all trigger jobs
      await enqueueWorkflowStepBatch(jobs);

      log.info("Workflow API batch trigger", {
        workflowId: wf.id,
        triggered: results.triggered,
      });

      return {
        success: results.errors.length === 0,
        workflowId: wf.id,
        workflowName: wf.name,
        ...results,
      };
    },
    {
      params: t.Object({
        workflowId: t.String({
          description: "Workflow ID to trigger",
          maxLength: 36,
        }),
      }),
      body: t.Object({
        contacts: t.Array(
          t.Object({
            contactId: t.Optional(t.String({ maxLength: 36 })),
            contactEmail: t.Optional(t.String({ maxLength: 255 })),
            data: t.Optional(t.Object({}, { additionalProperties: true })),
          }),
          { description: "List of contacts to trigger the workflow for" }
        ),
        data: t.Optional(
          t.Object(
            {},
            {
              additionalProperties: true,
              description: "Common data to pass to all workflow triggers",
            }
          )
        ),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          workflowId: t.Optional(t.String()),
          workflowName: t.Optional(t.String()),
          triggered: t.Optional(
            t.Number({ description: "Number of contacts triggered" })
          ),
          errors: t.Optional(
            t.Array(t.String(), { description: "Error messages if any" })
          ),
          error: t.Optional(t.String()),
        }),
      },
      detail: {
        summary: "Batch trigger workflow",
        description:
          "Trigger a workflow for multiple contacts at once. Each contact can have its own data that gets merged with common data.",
        tags: ["workflows"],
      },
    }
  );
