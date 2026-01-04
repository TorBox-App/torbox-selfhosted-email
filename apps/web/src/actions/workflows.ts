"use server";

import { auth } from "@wraps/auth";
import {
  db,
  workflow,
  workflowExecution,
  type CanvasViewport,
  type TriggerConfig,
  type Workflow,
  type WorkflowStep,
  type WorkflowTransition,
  type WorkflowTriggerType,
} from "@wraps/db";
import { and, count, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createActionLogger, serializeError } from "@/lib/logger";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type WorkflowWithMeta = Workflow & {
  createdByUser?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
};

export type ListWorkflowsResult =
  | {
      success: true;
      workflows: WorkflowWithMeta[];
      total: number;
      page: number;
      pageSize: number;
    }
  | { success: false; error: string };

export type GetWorkflowResult =
  | { success: true; workflow: WorkflowWithMeta }
  | { success: false; error: string };

export type CreateWorkflowResult =
  | { success: true; workflow: WorkflowWithMeta }
  | { success: false; error: string };

export type UpdateWorkflowResult =
  | { success: true; workflow: WorkflowWithMeta }
  | { success: false; error: string };

export type DeleteWorkflowResult =
  | { success: true }
  | { success: false; error: string };

export type EnableWorkflowResult =
  | { success: true; workflow: WorkflowWithMeta }
  | { success: false; error: string };

export type DuplicateWorkflowResult =
  | { success: true; workflow: WorkflowWithMeta }
  | { success: false; error: string };

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Verify user has access to organization
 */
async function verifyOrgAccess(
  organizationId: string
): Promise<{ userId: string; role: string } | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return null;
  }

  const membership = await db.query.member.findFirst({
    where: (m, { and, eq }) =>
      and(eq(m.organizationId, organizationId), eq(m.userId, session.user.id)),
  });

  if (!membership) {
    return null;
  }

  return { userId: session.user.id, role: membership.role };
}

/**
 * Validate workflow definition for common issues
 */
function validateWorkflowDefinition(
  steps: WorkflowStep[],
  transitions: WorkflowTransition[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for trigger node
  const triggerSteps = steps.filter((s) => s.type === "trigger");
  if (triggerSteps.length === 0) {
    errors.push("Workflow must have a trigger node");
  } else if (triggerSteps.length > 1) {
    errors.push("Workflow can only have one trigger node");
  }

  // Check all steps have IDs
  for (const step of steps) {
    if (!step.id) {
      errors.push("All steps must have an ID");
      break;
    }
  }

  // Check transitions reference valid step IDs
  const stepIds = new Set(steps.map((s) => s.id));
  for (const transition of transitions) {
    if (!stepIds.has(transition.fromStepId)) {
      errors.push(`Transition references unknown step: ${transition.fromStepId}`);
    }
    if (!stepIds.has(transition.toStepId)) {
      errors.push(`Transition references unknown step: ${transition.toStepId}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * List workflows for an organization with pagination
 */
export async function listWorkflows(
  organizationId: string,
  options: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: Workflow["status"];
  } = {}
): Promise<ListWorkflowsResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }

    const { page = 1, pageSize = 50, search, status } = options;
    const offset = (page - 1) * pageSize;

    // Build where conditions
    const conditions = [eq(workflow.organizationId, organizationId)];

    if (search) {
      conditions.push(ilike(workflow.name, `%${search}%`));
    }

    if (status) {
      conditions.push(eq(workflow.status, status));
    }

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(workflow)
      .where(and(...conditions));

    const total = totalResult?.count ?? 0;

    // Get workflows with pagination
    const workflows = await db.query.workflow.findMany({
      where: and(...conditions),
      with: {
        createdByUser: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [desc(workflow.updatedAt)],
      limit: pageSize,
      offset,
    });

    return {
      success: true,
      workflows: workflows as WorkflowWithMeta[],
      total,
      page,
      pageSize,
    };
  } catch (error) {
    const log = createActionLogger("listWorkflows", {
      orgSlug: organizationId,
    });
    log.error({ err: serializeError(error) }, "Failed to list workflows");
    return { success: false, error: "Failed to fetch workflows" };
  }
}

/**
 * Get a single workflow by ID
 */
export async function getWorkflow(
  workflowId: string,
  organizationId: string
): Promise<GetWorkflowResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }

    const w = await db.query.workflow.findFirst({
      where: and(
        eq(workflow.id, workflowId),
        eq(workflow.organizationId, organizationId)
      ),
      with: {
        createdByUser: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!w) {
      return { success: false, error: "Workflow not found" };
    }

    return { success: true, workflow: w as WorkflowWithMeta };
  } catch (error) {
    const log = createActionLogger("getWorkflow", { orgSlug: organizationId });
    log.error(
      { err: serializeError(error), workflowId },
      "Failed to get workflow"
    );
    return { success: false, error: "Failed to fetch workflow" };
  }
}

/**
 * Create a new workflow
 */
export async function createWorkflow(
  organizationId: string,
  data: {
    name: string;
    description?: string;
    awsAccountId?: string;
    topicId?: string;
  }
): Promise<CreateWorkflowResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }

    if (!data.name?.trim()) {
      return { success: false, error: "Workflow name is required" };
    }

    // Create default trigger step
    const triggerId = crypto.randomUUID();
    const defaultSteps: WorkflowStep[] = [
      {
        id: triggerId,
        type: "trigger",
        name: "Trigger",
        position: { x: 400, y: 50 },
        config: {
          type: "trigger",
          triggerType: "event",
        },
      },
    ];

    const [newWorkflow] = await db
      .insert(workflow)
      .values({
        organizationId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        awsAccountId: data.awsAccountId || null,
        topicId: data.topicId || null,
        status: "draft",
        triggerType: "event",
        triggerConfig: {},
        steps: defaultSteps,
        transitions: [],
        createdBy: access.userId,
      })
      .returning();

    if (!newWorkflow) {
      return { success: false, error: "Failed to create workflow" };
    }

    // Revalidate
    revalidatePath("/[orgSlug]/automations", "page");

    return await getWorkflow(newWorkflow.id, organizationId);
  } catch (error) {
    const log = createActionLogger("createWorkflow", {
      orgSlug: organizationId,
    });
    log.error({ err: serializeError(error) }, "Failed to create workflow");
    return { success: false, error: "Failed to create workflow" };
  }
}

/**
 * Update a workflow
 */
export async function updateWorkflow(
  workflowId: string,
  organizationId: string,
  data: {
    name?: string;
    description?: string;
    awsAccountId?: string | null;
    topicId?: string | null;
    triggerType?: WorkflowTriggerType;
    triggerConfig?: TriggerConfig;
    steps?: WorkflowStep[];
    transitions?: WorkflowTransition[];
    canvasViewport?: CanvasViewport;
    allowReentry?: boolean;
    reentryDelaySeconds?: number | null;
    maxConcurrentExecutions?: number;
    contactCooldownSeconds?: number | null;
  }
): Promise<UpdateWorkflowResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }

    // Verify workflow exists
    const existing = await db.query.workflow.findFirst({
      where: and(
        eq(workflow.id, workflowId),
        eq(workflow.organizationId, organizationId)
      ),
    });

    if (!existing) {
      return { success: false, error: "Workflow not found" };
    }

    // Validate steps/transitions if provided
    if (data.steps !== undefined || data.transitions !== undefined) {
      const steps = data.steps ?? (existing.steps as WorkflowStep[]);
      const transitions =
        data.transitions ?? (existing.transitions as WorkflowTransition[]);

      const validation = validateWorkflowDefinition(steps, transitions);
      if (!validation.valid) {
        return {
          success: false,
          error: `Invalid workflow: ${validation.errors.join(", ")}`,
        };
      }
    }

    // Build update data
    const updateData: Partial<typeof workflow.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) {
      if (!data.name.trim()) {
        return { success: false, error: "Workflow name is required" };
      }
      updateData.name = data.name.trim();
    }

    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || null;
    }

    if (data.awsAccountId !== undefined) {
      updateData.awsAccountId = data.awsAccountId;
    }

    if (data.topicId !== undefined) {
      updateData.topicId = data.topicId;
    }

    if (data.triggerType !== undefined) {
      updateData.triggerType = data.triggerType;
    }

    if (data.triggerConfig !== undefined) {
      updateData.triggerConfig = data.triggerConfig;
    }

    if (data.steps !== undefined) {
      updateData.steps = data.steps;
    }

    if (data.transitions !== undefined) {
      updateData.transitions = data.transitions;
    }

    if (data.canvasViewport !== undefined) {
      updateData.canvasViewport = data.canvasViewport;
    }

    if (data.allowReentry !== undefined) {
      updateData.allowReentry = data.allowReentry;
    }

    if (data.reentryDelaySeconds !== undefined) {
      updateData.reentryDelaySeconds = data.reentryDelaySeconds;
    }

    if (data.maxConcurrentExecutions !== undefined) {
      updateData.maxConcurrentExecutions = data.maxConcurrentExecutions;
    }

    if (data.contactCooldownSeconds !== undefined) {
      updateData.contactCooldownSeconds = data.contactCooldownSeconds;
    }

    // Update workflow
    await db
      .update(workflow)
      .set(updateData)
      .where(
        and(
          eq(workflow.id, workflowId),
          eq(workflow.organizationId, organizationId)
        )
      );

    // Revalidate
    revalidatePath("/[orgSlug]/automations", "page");
    revalidatePath(`/[orgSlug]/automations/${workflowId}`, "page");

    return await getWorkflow(workflowId, organizationId);
  } catch (error) {
    const log = createActionLogger("updateWorkflow", {
      orgSlug: organizationId,
    });
    log.error(
      { err: serializeError(error), workflowId },
      "Failed to update workflow"
    );
    return { success: false, error: "Failed to update workflow" };
  }
}

/**
 * Delete a workflow
 */
export async function deleteWorkflow(
  workflowId: string,
  organizationId: string
): Promise<DeleteWorkflowResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }

    // Verify workflow exists
    const existing = await db.query.workflow.findFirst({
      where: and(
        eq(workflow.id, workflowId),
        eq(workflow.organizationId, organizationId)
      ),
    });

    if (!existing) {
      return { success: false, error: "Workflow not found" };
    }

    // Check for active executions
    const [activeCount] = await db
      .select({ count: count() })
      .from(workflowExecution)
      .where(
        and(
          eq(workflowExecution.workflowId, workflowId),
          inArray(workflowExecution.status, ["pending", "active", "paused"])
        )
      );

    if ((activeCount?.count ?? 0) > 0) {
      return {
        success: false,
        error: `Cannot delete workflow with ${activeCount?.count} active execution(s). Disable the workflow first and wait for executions to complete.`,
      };
    }

    // Delete workflow (cascades to executions)
    await db
      .delete(workflow)
      .where(
        and(
          eq(workflow.id, workflowId),
          eq(workflow.organizationId, organizationId)
        )
      );

    // Revalidate
    revalidatePath("/[orgSlug]/automations", "page");

    return { success: true };
  } catch (error) {
    const log = createActionLogger("deleteWorkflow", {
      orgSlug: organizationId,
    });
    log.error(
      { err: serializeError(error), workflowId },
      "Failed to delete workflow"
    );
    return { success: false, error: "Failed to delete workflow" };
  }
}

/**
 * Enable a workflow (make it active and start accepting triggers)
 */
export async function enableWorkflow(
  workflowId: string,
  organizationId: string
): Promise<EnableWorkflowResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }

    // Get workflow
    const existing = await db.query.workflow.findFirst({
      where: and(
        eq(workflow.id, workflowId),
        eq(workflow.organizationId, organizationId)
      ),
    });

    if (!existing) {
      return { success: false, error: "Workflow not found" };
    }

    // Validate workflow has required configuration
    const steps = existing.steps as WorkflowStep[];
    const transitions = existing.transitions as WorkflowTransition[];

    const validation = validateWorkflowDefinition(steps, transitions);
    if (!validation.valid) {
      return {
        success: false,
        error: `Cannot enable workflow: ${validation.errors.join(", ")}`,
      };
    }

    // Check trigger is configured
    const triggerStep = steps.find((s) => s.type === "trigger");
    if (!triggerStep) {
      return {
        success: false,
        error: "Workflow must have a trigger configured",
      };
    }

    // For custom event triggers, require eventName
    if (existing.triggerType === "event") {
      const triggerConfig = existing.triggerConfig as TriggerConfig;
      if (!triggerConfig?.eventName) {
        return {
          success: false,
          error: "Custom event trigger must have an event name configured",
        };
      }
    }

    // contact_created, contact_updated, and api triggers don't need additional config

    // Check workflow has at least one action step
    const actionSteps = steps.filter(
      (s) => s.type !== "trigger" && s.type !== "exit"
    );
    if (actionSteps.length === 0) {
      return {
        success: false,
        error: "Workflow must have at least one action step",
      };
    }

    // Enable workflow
    await db
      .update(workflow)
      .set({
        status: "enabled",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workflow.id, workflowId),
          eq(workflow.organizationId, organizationId)
        )
      );

    // Revalidate
    revalidatePath("/[orgSlug]/automations", "page");
    revalidatePath(`/[orgSlug]/automations/${workflowId}`, "page");

    return await getWorkflow(workflowId, organizationId);
  } catch (error) {
    const log = createActionLogger("enableWorkflow", {
      orgSlug: organizationId,
    });
    log.error(
      { err: serializeError(error), workflowId },
      "Failed to enable workflow"
    );
    return { success: false, error: "Failed to enable workflow" };
  }
}

/**
 * Disable a workflow (stop accepting new triggers, existing executions continue)
 */
export async function disableWorkflow(
  workflowId: string,
  organizationId: string
): Promise<EnableWorkflowResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }

    // Verify workflow exists
    const existing = await db.query.workflow.findFirst({
      where: and(
        eq(workflow.id, workflowId),
        eq(workflow.organizationId, organizationId)
      ),
    });

    if (!existing) {
      return { success: false, error: "Workflow not found" };
    }

    // Pause workflow
    await db
      .update(workflow)
      .set({
        status: "paused",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workflow.id, workflowId),
          eq(workflow.organizationId, organizationId)
        )
      );

    // Revalidate
    revalidatePath("/[orgSlug]/automations", "page");
    revalidatePath(`/[orgSlug]/automations/${workflowId}`, "page");

    return await getWorkflow(workflowId, organizationId);
  } catch (error) {
    const log = createActionLogger("disableWorkflow", {
      orgSlug: organizationId,
    });
    log.error(
      { err: serializeError(error), workflowId },
      "Failed to disable workflow"
    );
    return { success: false, error: "Failed to disable workflow" };
  }
}

/**
 * Duplicate a workflow
 */
export async function duplicateWorkflow(
  workflowId: string,
  organizationId: string
): Promise<DuplicateWorkflowResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }

    // Get original workflow
    const original = await db.query.workflow.findFirst({
      where: and(
        eq(workflow.id, workflowId),
        eq(workflow.organizationId, organizationId)
      ),
    });

    if (!original) {
      return { success: false, error: "Workflow not found" };
    }

    // Generate new IDs for steps and update transitions
    const oldToNewIdMap = new Map<string, string>();
    const originalSteps = original.steps as WorkflowStep[];
    const originalTransitions = original.transitions as WorkflowTransition[];

    // Map old step IDs to new ones
    for (const step of originalSteps) {
      oldToNewIdMap.set(step.id, crypto.randomUUID());
    }

    // Create new steps with updated IDs
    const newSteps: WorkflowStep[] = originalSteps.map((step) => ({
      ...step,
      id: oldToNewIdMap.get(step.id)!,
    }));

    // Create new transitions with updated IDs
    const newTransitions: WorkflowTransition[] = originalTransitions.map(
      (transition) => ({
        ...transition,
        id: crypto.randomUUID(),
        fromStepId: oldToNewIdMap.get(transition.fromStepId) || transition.fromStepId,
        toStepId: oldToNewIdMap.get(transition.toStepId) || transition.toStepId,
      })
    );

    // Create duplicate workflow
    const [newWorkflow] = await db
      .insert(workflow)
      .values({
        organizationId,
        name: `${original.name} (copy)`,
        description: original.description,
        awsAccountId: original.awsAccountId,
        topicId: original.topicId,
        status: "draft", // Always start as draft
        triggerType: original.triggerType,
        triggerConfig: original.triggerConfig,
        steps: newSteps,
        transitions: newTransitions,
        canvasViewport: original.canvasViewport,
        allowReentry: original.allowReentry,
        reentryDelaySeconds: original.reentryDelaySeconds,
        maxConcurrentExecutions: original.maxConcurrentExecutions,
        contactCooldownSeconds: original.contactCooldownSeconds,
        createdBy: access.userId,
      })
      .returning();

    if (!newWorkflow) {
      return { success: false, error: "Failed to duplicate workflow" };
    }

    // Revalidate
    revalidatePath("/[orgSlug]/automations", "page");

    return await getWorkflow(newWorkflow.id, organizationId);
  } catch (error) {
    const log = createActionLogger("duplicateWorkflow", {
      orgSlug: organizationId,
    });
    log.error(
      { err: serializeError(error), workflowId },
      "Failed to duplicate workflow"
    );
    return { success: false, error: "Failed to duplicate workflow" };
  }
}

/**
 * Get workflow execution statistics
 */
export async function getWorkflowStats(
  workflowId: string,
  organizationId: string
): Promise<
  | {
      success: true;
      stats: {
        total: number;
        active: number;
        completed: number;
        failed: number;
      };
    }
  | { success: false; error: string }
> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }

    // Verify workflow exists
    const existing = await db.query.workflow.findFirst({
      where: and(
        eq(workflow.id, workflowId),
        eq(workflow.organizationId, organizationId)
      ),
      columns: {
        totalExecutions: true,
        activeExecutions: true,
        completedExecutions: true,
        failedExecutions: true,
      },
    });

    if (!existing) {
      return { success: false, error: "Workflow not found" };
    }

    return {
      success: true,
      stats: {
        total: existing.totalExecutions,
        active: existing.activeExecutions,
        completed: existing.completedExecutions,
        failed: existing.failedExecutions,
      },
    };
  } catch (error) {
    const log = createActionLogger("getWorkflowStats", {
      orgSlug: organizationId,
    });
    log.error(
      { err: serializeError(error), workflowId },
      "Failed to get workflow stats"
    );
    return { success: false, error: "Failed to get workflow stats" };
  }
}
