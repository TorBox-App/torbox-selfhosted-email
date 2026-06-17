"use server";

import { db, template, type WorkflowStep, workflow } from "@wraps/db";
import { and, eq, inArray } from "drizzle-orm";
import { orgAction } from "../shared/org-action";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type ReadinessCheck = {
  id: string;
  label: string;
  status: "pass" | "fail" | "warn";
  severity: "critical" | "warning";
  details?: string;
};

export type ReadinessResult =
  | { success: true; checks: ReadinessCheck[] }
  | { success: false; error: string };

/**
 * Known first-class contact fields (from packages/db/src/schema/contacts.ts).
 * Fields accessed via `properties.*` are custom and always pass.
 */
const KNOWN_CONTACT_FIELDS = new Set([
  "email",
  "emailStatus",
  "phone",
  "smsStatus",
  "firstName",
  "lastName",
  "company",
  "jobTitle",
  "preferredChannel",
  "status",
  "emailsSent",
  "emailsOpened",
  "emailsClicked",
  "smsSent",
  "smsClicked",
]);

async function checkTemplates(
  organizationId: string,
  templateIds: string[]
): Promise<ReadinessCheck[]> {
  const uniqueIds = [...new Set(templateIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return [];
  }

  const foundTemplates = await db
    .select({ id: template.id, status: template.status })
    .from(template)
    .where(
      and(
        eq(template.organizationId, organizationId),
        inArray(template.id, uniqueIds)
      )
    );

  const foundIds = new Set(foundTemplates.map((t) => t.id));
  const missingIds = uniqueIds.filter((id) => !foundIds.has(id));
  const unpublished = foundTemplates.filter((t) => t.status !== "PUBLISHED");

  const checks: ReadinessCheck[] = [];

  checks.push({
    id: "templates_exist",
    label: "All email templates exist",
    status: missingIds.length > 0 ? "fail" : "pass",
    severity: "critical",
    details:
      missingIds.length > 0
        ? `${missingIds.length} template${missingIds.length > 1 ? "s" : ""} not found`
        : undefined,
  });

  checks.push({
    id: "templates_published",
    label: "All templates are published",
    status: unpublished.length > 0 ? "fail" : "pass",
    severity: "warning",
    details:
      unpublished.length > 0
        ? `${unpublished.length} template${unpublished.length > 1 ? "s are" : " is"} still in ${unpublished.map((t) => t.status.toLowerCase()).join(", ")} status`
        : undefined,
  });

  return checks;
}

function checkConditionFields(conditionFields: string[]): ReadinessCheck[] {
  const uniqueFields = [...new Set(conditionFields.filter(Boolean))];
  if (uniqueFields.length === 0) {
    return [];
  }

  const unknownFields = uniqueFields.filter(
    (field) =>
      !(KNOWN_CONTACT_FIELDS.has(field) || field.startsWith("properties."))
  );

  return [
    {
      id: "condition_fields_valid",
      label: "All condition fields are valid",
      status: unknownFields.length > 0 ? "fail" : "pass",
      severity: "warning",
      details:
        unknownFields.length > 0
          ? `Unknown field${unknownFields.length > 1 ? "s" : ""}: ${unknownFields.join(", ")}`
          : undefined,
    },
  ];
}

/**
 * Derive template IDs from workflow step records in DB.
 * Prevents client-supplied template ID spoofing (Issue #16).
 */
async function deriveTemplateIdsFromDb(
  workflowId: string,
  organizationId: string
): Promise<string[]> {
  const wf = await db.query.workflow.findFirst({
    where: and(
      eq(workflow.id, workflowId),
      eq(workflow.organizationId, organizationId)
    ),
    columns: { steps: true },
  });

  if (!wf) return [];

  const steps = wf.steps as WorkflowStep[];
  const templateIds: string[] = [];
  for (const step of steps) {
    if (step.config.type === "send_email" && step.config.templateId) {
      templateIds.push(step.config.templateId);
    }
  }
  return templateIds;
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTION
// ═══════════════════════════════════════════════════════════════════════════

export const checkWorkflowReadiness = orgAction(
  {
    name: "checkWorkflowReadiness",
    resource: "workflows",
    permission: ["read"],
    orgId: (
      _workflowId: string,
      organizationId: string,
      _payload: {
        templateIds: string[];
        conditionFields: string[];
      }
    ) => organizationId,
    onError: "Failed to check workflow readiness",
  },
  async (
    ctx,
    workflowId: string,
    organizationId: string,
    payload: {
      templateIds: string[];
      conditionFields: string[];
    }
  ): Promise<ReadinessResult> => {
    // Derive template IDs from DB instead of trusting client payload (Issue #16).
    // Never fall back to payload.templateIds — an attacker could supply a non-existent
    // workflowId to force the fallback and check arbitrary template IDs.
    const dbTemplateIds = await deriveTemplateIdsFromDb(
      workflowId,
      organizationId
    );

    const templateChecks = await checkTemplates(organizationId, dbTemplateIds);
    const fieldChecks = checkConditionFields(payload.conditionFields);

    return { success: true, checks: [...templateChecks, ...fieldChecks] };
  }
);
