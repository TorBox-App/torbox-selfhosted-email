/**
 * Workflow Schedule Routes
 *
 * Internal routes for managing EventBridge one-time schedules
 * for schedule-triggered workflows.
 *
 * Called by server actions on enable/disable/update of scheduled workflows.
 */

import { t } from "elysia";

import {
  type AuthContext,
  createAuthenticatedRoutes,
} from "../middleware/auth";
import {
  createNextWorkflowSchedule,
  deleteWorkflowSchedule,
} from "../services/workflow-scheduler";

export const workflowScheduleRoutes = createAuthenticatedRoutes(
  "/v1/workflow-schedules"
)
  /**
   * Enable a workflow schedule
   *
   * POST /v1/workflow-schedules/:workflowId/enable
   *
   * Creates the next one-time EventBridge Schedule for a workflow.
   */
  .post(
    "/:workflowId/enable",
    async (ctx) => {
      const { params, body, set } = ctx;
      const auth = (ctx as unknown as { auth: AuthContext }).auth;

      try {
        const scheduleName = await createNextWorkflowSchedule({
          workflowId: params.workflowId,
          organizationId: auth.organizationId,
          cronExpression: body.cronExpression,
          timezone: body.timezone,
        });

        return { success: true, scheduleName };
      } catch (error) {
        console.error(
          `[workflow-schedules] Failed to enable schedule for ${params.workflowId}:`,
          error
        );
        set.status = 500;
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to create schedule",
        };
      }
    },
    {
      params: t.Object({
        workflowId: t.String(),
      }),
      body: t.Object({
        cronExpression: t.String(),
        timezone: t.Optional(t.String()),
      }),
    }
  )

  /**
   * Disable a workflow schedule
   *
   * POST /v1/workflow-schedules/:workflowId/disable
   *
   * Deletes the pending EventBridge Schedule for a workflow.
   */
  .post(
    "/:workflowId/disable",
    async (ctx) => {
      const { params, set } = ctx;

      try {
        await deleteWorkflowSchedule(params.workflowId);
        return { success: true };
      } catch (error) {
        console.error(
          `[workflow-schedules] Failed to disable schedule for ${params.workflowId}:`,
          error
        );
        set.status = 500;
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to delete schedule",
        };
      }
    },
    {
      params: t.Object({
        workflowId: t.String(),
      }),
    }
  )

  /**
   * Update a workflow schedule (reschedule)
   *
   * PUT /v1/workflow-schedules/:workflowId
   *
   * Deletes the old schedule and creates a new one with updated cron.
   */
  .put(
    "/:workflowId",
    async (ctx) => {
      const { params, body, set } = ctx;
      const auth = (ctx as unknown as { auth: AuthContext }).auth;

      try {
        // Delete old schedule first
        await deleteWorkflowSchedule(params.workflowId);

        // Create new schedule with updated cron
        const scheduleName = await createNextWorkflowSchedule({
          workflowId: params.workflowId,
          organizationId: auth.organizationId,
          cronExpression: body.cronExpression,
          timezone: body.timezone,
        });

        return { success: true, scheduleName };
      } catch (error) {
        console.error(
          `[workflow-schedules] Failed to update schedule for ${params.workflowId}:`,
          error
        );
        set.status = 500;
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to update schedule",
        };
      }
    },
    {
      params: t.Object({
        workflowId: t.String(),
      }),
      body: t.Object({
        cronExpression: t.String(),
        timezone: t.Optional(t.String()),
      }),
    }
  );
