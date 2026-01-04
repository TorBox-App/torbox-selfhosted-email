/**
 * Workflow Trigger Routes
 *
 * API endpoints for directly triggering workflows.
 * Used for workflows with triggerType "api" that are triggered
 * by external systems or customer code.
 */

import { contact, db, eq, workflow } from "@wraps/db";
import { and } from "drizzle-orm";
import { t } from "elysia";

import {
  type AuthContext,
  createAuthenticatedRoutes,
} from "../middleware/auth";
import { enqueueWorkflowStep } from "../services/workflow-queue";

export const workflowsRoutes = createAuthenticatedRoutes("/v1/workflows")

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

      console.log(
        `[workflows] API trigger: workflow ${wf.id} for contact ${contactRecord.id}`
      );

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
        workflowId: t.String({ description: "Workflow ID to trigger" }),
      }),
      body: t.Object({
        contactId: t.Optional(t.String({ description: "Contact ID" })),
        contactEmail: t.Optional(
          t.String({ description: "Contact email (alternative to contactId)" })
        ),
        data: t.Optional(
          t.Record(t.String(), t.Unknown(), {
            description: "Data to pass to the workflow as trigger data",
          })
        ),
      }),
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

      for (const c of contacts) {
        // Find the contact
        let contactRecord: typeof contact.$inferSelect | undefined;

        if (c.contactId) {
          const [found] = await db
            .select()
            .from(contact)
            .where(
              and(
                eq(contact.id, c.contactId),
                eq(contact.organizationId, auth.organizationId)
              )
            )
            .limit(1);
          contactRecord = found;
        } else if (c.contactEmail) {
          const [found] = await db
            .select()
            .from(contact)
            .where(
              and(
                eq(contact.email, c.contactEmail),
                eq(contact.organizationId, auth.organizationId)
              )
            )
            .limit(1);
          contactRecord = found;
        }

        if (!contactRecord) {
          results.errors.push(
            `Contact not found: ${c.contactId || c.contactEmail}`
          );
          continue;
        }

        // Enqueue the workflow trigger
        await enqueueWorkflowStep({
          type: "trigger",
          workflowId: wf.id,
          contactId: contactRecord.id,
          organizationId: auth.organizationId,
          eventData: { ...(data || {}), ...(c.data || {}) },
        });

        results.triggered++;
      }

      console.log(
        `[workflows] API batch trigger: workflow ${wf.id} for ${results.triggered} contacts`
      );

      return {
        success: results.errors.length === 0,
        workflowId: wf.id,
        workflowName: wf.name,
        ...results,
      };
    },
    {
      params: t.Object({
        workflowId: t.String({ description: "Workflow ID to trigger" }),
      }),
      body: t.Object({
        contacts: t.Array(
          t.Object({
            contactId: t.Optional(t.String()),
            contactEmail: t.Optional(t.String()),
            data: t.Optional(t.Record(t.String(), t.Unknown())),
          }),
          { description: "List of contacts to trigger the workflow for" }
        ),
        data: t.Optional(
          t.Record(t.String(), t.Unknown(), {
            description: "Common data to pass to all workflow triggers",
          })
        ),
      }),
      detail: {
        summary: "Batch trigger workflow",
        description:
          "Trigger a workflow for multiple contacts at once. Each contact can have its own data that gets merged with common data.",
        tags: ["workflows"],
      },
    }
  );
