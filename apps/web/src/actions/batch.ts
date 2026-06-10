"use server";
// baseline:allow-large-file

import { auth } from "@wraps/auth";
import {
  auditLog,
  countBroadcastRecipients,
  db,
  deleteDraftBroadcast,
  duplicateBroadcast,
  findAwsAccountForOrg,
  findBroadcast,
  findBroadcastStatus,
  findBroadcastWithMeta,
  findDraftBroadcast,
  findTemplateContent,
  findTemplateForValidation,
  findTemplateVariables,
  getSampleBroadcastRecipients,
  getSampleRecipientsWithProperties,
  insertDraftBroadcast,
  listBroadcasts,
  listPublishedTemplates,
  listSegmentsForBroadcast,
  listTopicsWithSubscriberCounts,
  updateDraftBroadcast,
} from "@wraps/db";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { getVariablesForContext } from "@/components/template-editor/variables/variable-definitions";
import { trackBroadcastCreated } from "@/lib/activation-tracking";
import { auditLogEntry, getAuditContext } from "@/lib/audit";
import type {
  BatchStatus,
  CancelBatchResult,
  Channel,
  CheckTemplateVariableCoverageResult,
  CreateBatchInput,
  CreateBatchResult,
  CreateDraftBatchInput,
  DeleteDraftBatchResult,
  DuplicateBatchResult,
  ExtractedVariable,
  GetBatchResult,
  GetSampleContactsResult,
  ListBatchesResult,
  PromoteDraftBatchResult,
  RecipientFilter,
  SampleContact,
  SaveDraftBatchResult,
  UpdateDraftBatchInput,
  UpdateDraftBatchResult,
  VariableMapping,
} from "@/lib/batch";
import { HANDLEBARS_KEYWORDS } from "@/lib/handlebars";
import { createActionLogger } from "@/lib/logger";
import { checkFeatureAccess } from "@/lib/plan-limits";
import { checkPermission } from "./shared/permissions";
import { verifyOrgAccess } from "./shared/verify-org-access";
import { publishTemplateToSES } from "./templates";

// UUID validation schema for input sanitization
const uuidSchema = z.string().uuid();

// Re-export types for convenience
export type {
  AudienceType,
  BatchSendWithMeta,
  CancelBatchResult,
  CheckTemplateVariableCoverageResult,
  ContentType,
  CreateBatchResult,
  GetBatchResult,
  ListBatchesResult,
  RecipientFilter,
  VariableMapping,
} from "@/lib/batch";

/**
 * List batch sends for an organization
 */
export async function listBatchSends(
  organizationId: string,
  options: {
    page?: number;
    pageSize?: number;
    status?: BatchStatus;
    channel?: Channel;
  } = {}
): Promise<ListBatchesResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }
    const permError = checkPermission(access.role, "broadcasts", ["read"]);
    if (permError) return permError;

    const { batches, total } = await listBroadcasts(organizationId, options);

    return {
      success: true,
      batches: batches.map((b) => ({
        id: b.id,
        name: b.name,
        channel: b.channel as Channel,
        status: b.status as BatchStatus,
        subject: b.subject,
        previewText: b.previewText,
        from: b.from,
        fromName: b.fromName,
        replyTo: b.replyTo,
        templateId: b.emailTemplateId,
        templateName: b.emailTemplate?.name,
        totalRecipients: b.totalRecipients,
        processedRecipients: b.processedRecipients,
        sent: b.sent,
        delivered: b.delivered,
        failed: b.failed,
        opened: b.opened,
        clicked: b.clicked,
        bounced: b.bounced,
        complained: b.complained,
        errorMessage: b.errorMessage,
        scheduledFor: b.scheduledFor,
        startedAt: b.startedAt,
        completedAt: b.completedAt,
        createdAt: b.createdAt,
        createdBy: b.createdByUser,
        awsAccount: b.awsAccount,
      })),
      total,
    };
  } catch (error) {
    const log = createActionLogger("listBatchSends", {
      orgSlug: organizationId,
    });
    log.error({ err: error }, "Failed to list batch sends");
    return { success: false, error: "Failed to fetch batch sends" };
  }
}

/**
 * Get a single batch send by ID
 */
export async function getBatchSend(
  batchId: string,
  organizationId: string
): Promise<GetBatchResult> {
  // Validate UUID format before any database operations
  if (!uuidSchema.safeParse(batchId).success) {
    return { success: false, error: "Invalid batch ID" };
  }
  if (!uuidSchema.safeParse(organizationId).success) {
    return { success: false, error: "Invalid organization ID" };
  }

  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }
    const permError = checkPermission(access.role, "broadcasts", ["read"]);
    if (permError) return permError;

    return loadBatchWithMeta(batchId, organizationId);
  } catch (error) {
    const log = createActionLogger("getBatchSend", {
      orgSlug: organizationId,
    });
    log.error({ err: error, batchId }, "Failed to get batch send");
    return { success: false, error: "Failed to fetch batch send" };
  }
}

// =============================================================================
// TEMPLATE VARIABLE COVERAGE
// =============================================================================

/**
 * Identifies "risky" template variables — custom variables with no fallback
 * and no static mapping — then checks a sample of contacts to see how many
 * are missing them. Returns coverage stats without performing auth checks
 * (callers are responsible for auth).
 */
async function assessVariableCoverage(
  organizationId: string,
  templateId: string,
  recipientFilter: RecipientFilter | undefined,
  variableMappings: VariableMapping[] | undefined
): Promise<{
  allFail: boolean;
  missingCount: number;
  totalSampled: number;
  totalRecipients: number;
  missingVariables: string[];
}> {
  const EMPTY = {
    allFail: false,
    missingCount: 0,
    totalSampled: 0,
    totalRecipients: 0,
    missingVariables: [] as string[],
  };

  const templateData = await findTemplateVariables(templateId, organizationId);
  if (!templateData) return EMPTY;

  const staticMappedVars = new Set(
    (variableMappings ?? [])
      .filter((m) => m.source.type === "static")
      .map((m) => m.variableName)
  );

  // Names the batch sender always provides from contact columns (not properties)
  const BATCH_SENDER_SHORT_NAMES = new Set([
    "firstName",
    "lastName",
    "company",
    "jobTitle",
    "email",
    "contactFirstName",
    "contactLastName",
    "contactCompany",
    "contactJobTitle",
    "contactEmail",
    "organizationName",
    "unsubscribeUrl",
    "preferencesUrl",
    "confirmationUrl",
  ]);

  const knownVariableNames = new Set(
    getVariablesForContext("broadcast").map((v) => v.name)
  );

  type StoredVar = { name: string; fallback?: string | null };
  const storedVars = (templateData.variables ?? []) as StoredVar[];

  // Also parse variables from the subject line — these aren't stored in
  // templateData.variables (which is extracted from body HTML only)
  const subjectVarRegex = /\{\{([^}|]+?)(?:\|([^}]*))?\}\}/g;
  const subjectVarsSeen = new Set(storedVars.map((v) => v.name));
  const allVars: StoredVar[] = [...storedVars];
  if (templateData.subject) {
    let m = subjectVarRegex.exec(templateData.subject);
    while (m !== null) {
      const name = m[1].trim();
      const fallback = m[2]?.trim();
      if (!subjectVarsSeen.has(name)) {
        subjectVarsSeen.add(name);
        allVars.push(fallback ? { name, fallback } : { name });
      }
      m = subjectVarRegex.exec(templateData.subject);
    }
  }

  const riskyVars: string[] = [];
  for (const v of allVars) {
    if (HANDLEBARS_KEYWORDS.has(v.name)) continue;
    if (v.fallback) continue;
    if (staticMappedVars.has(v.name)) continue;
    if (BATCH_SENDER_SHORT_NAMES.has(v.name)) continue;
    if (knownVariableNames.has(v.name)) continue;
    if (knownVariableNames.has(`contact.${v.name}`)) continue;
    if (v.name.startsWith("contact.")) continue;
    if (v.name.startsWith("organization.")) continue;
    riskyVars.push(v.name);
  }

  if (riskyVars.length === 0) return EMPTY;

  const { contacts, totalCount } = await getSampleRecipientsWithProperties(
    organizationId,
    "email",
    recipientFilter
      ? {
          audienceType: recipientFilter.audienceType,
          topicId: recipientFilter.topicId,
          segmentId: recipientFilter.segmentId,
        }
      : undefined
  );

  if (contacts.length === 0) {
    return {
      ...EMPTY,
      totalRecipients: totalCount,
      missingVariables: riskyVars,
    };
  }

  const missingContacts = contacts.filter(
    (c: { properties: Record<string, unknown> | null }) => {
      const props = c.properties ?? {};
      return riskyVars.some((varName) => {
        const val = props[varName];
        return val == null || val === "";
      });
    }
  );

  return {
    allFail: missingContacts.length === contacts.length,
    missingCount: missingContacts.length,
    totalSampled: contacts.length,
    totalRecipients: totalCount,
    missingVariables: riskyVars,
  };
}

/**
 * Pre-flight check: assess whether template custom variables can be resolved
 * for the selected audience. Returned data drives a warning banner in the
 * broadcast form (review step) before the user clicks Send.
 */
export async function checkTemplateVariableCoverage(
  organizationId: string,
  templateId: string,
  recipientFilter: RecipientFilter,
  variableMappings?: VariableMapping[]
): Promise<CheckTemplateVariableCoverageResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }
    const permError = checkPermission(access.role, "broadcasts", ["read"]);
    if (permError) return permError;

    const coverage = await assessVariableCoverage(
      organizationId,
      templateId,
      recipientFilter,
      variableMappings
    );

    return { success: true, ...coverage };
  } catch (error) {
    const log = createActionLogger("checkTemplateVariableCoverage", {
      orgSlug: organizationId,
    });
    log.error({ err: error, templateId }, "Failed to assess variable coverage");
    return {
      success: false,
      error: "Failed to check template variable coverage",
    };
  }
}

/**
 * Shared pre-send validation.
 *
 * Runs all the checks + side effects that both direct-send (createBatchSend)
 * and promote-from-draft (promoteDraftToSend) must perform:
 * - plan feature access ("batch", plus "campaigns" if scheduled)
 * - AWS account ownership
 * - template existence + auto-publish to SES if needed
 * - eligible recipient count (real-time, audience drift safe)
 *
 * Returns a discriminated union so callers can destructure without casts.
 */
type PrepareSendData = {
  awsAccountId: string;
  channel?: Channel;
  templateId?: string;
  recipientFilter?: RecipientFilter;
  scheduledFor?: Date;
  variableMappings?: VariableMapping[];
};

type PrepareSendResult =
  | { ok: true; recipientCount: number }
  | { ok: false; error: string };

async function validateAndPrepareSend(
  organizationId: string,
  data: PrepareSendData
): Promise<PrepareSendResult> {
  const featureCheck = await checkFeatureAccess(organizationId, "batch");
  if (!featureCheck.allowed) {
    return {
      ok: false,
      error:
        featureCheck.message ?? "Batch sending is not available on your plan.",
    };
  }

  if (data.scheduledFor) {
    const schedulingCheck = await checkFeatureAccess(
      organizationId,
      "campaigns"
    );
    if (!schedulingCheck.allowed) {
      return {
        ok: false,
        error:
          schedulingCheck.message ??
          "Scheduling broadcasts requires a paid plan.",
      };
    }
  }

  const awsAccountRow = await findAwsAccountForOrg(
    data.awsAccountId,
    organizationId
  );

  if (!awsAccountRow) {
    return { ok: false, error: "AWS account not found" };
  }

  if (data.templateId) {
    const tmpl = await findTemplateForValidation(
      data.templateId,
      organizationId
    );

    if (!tmpl) {
      return { ok: false, error: "Template not found" };
    }

    const needsPublish =
      !tmpl.sesTemplateName ||
      (tmpl.updatedAt &&
        (!tmpl.publishedAt || tmpl.updatedAt > tmpl.publishedAt));

    if (needsPublish) {
      const publishResult = await publishTemplateToSES(
        data.templateId,
        organizationId
      );

      if (!publishResult.success) {
        return {
          ok: false,
          error: `Failed to publish template: ${publishResult.error}`,
        };
      }
    }
  }

  const recipientCount = await countBroadcastRecipients(
    organizationId,
    data.channel ?? "email",
    data.recipientFilter
      ? {
          audienceType: data.recipientFilter.audienceType,
          topicId: data.recipientFilter.topicId,
          segmentId: data.recipientFilter.segmentId,
        }
      : undefined
  );

  if (recipientCount === 0) {
    return {
      ok: false,
      error:
        data.channel === "sms"
          ? "No contacts with SMS consent found"
          : "No active email contacts found",
    };
  }

  // Block sends where every contact would fail template rendering due to
  // missing custom variables that have no fallback and no static mapping.
  if (data.templateId && data.channel !== "sms") {
    const coverage = await assessVariableCoverage(
      organizationId,
      data.templateId,
      data.recipientFilter,
      data.variableMappings
    );
    if (coverage.allFail && coverage.missingVariables.length > 0) {
      return {
        ok: false,
        error: `All contacts are missing required template variables: ${coverage.missingVariables.join(", ")}. Add these attributes to your contacts or set a fallback in the template.`,
      };
    }
  }

  return { ok: true, recipientCount };
}

/**
 * Create a new batch send by calling the API (direct-send path).
 */
export async function createBatchSend(
  organizationId: string,
  data: CreateBatchInput
): Promise<CreateBatchResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }

    const permError = checkPermission(access.role, "broadcasts", ["send"]);
    if (permError) return permError;

    const prep = await validateAndPrepareSend(organizationId, {
      awsAccountId: data.awsAccountId,
      channel: data.channel,
      templateId: data.templateId,
      recipientFilter: data.recipientFilter,
      scheduledFor: data.scheduledFor,
    });

    if (!prep.ok) {
      return { success: false, error: prep.error };
    }

    const { recipientCount } = prep;

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: "Session not found" };
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      return { success: false, error: "API URL not configured" };
    }

    const response = await fetch(`${apiUrl}/v1/batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.session.token}`,
        "X-Organization-Id": organizationId,
      },
      body: JSON.stringify({
        channel: data.channel ?? "email",
        name: data.name ?? `Broadcast ${new Date().toLocaleDateString()}`,
        audienceType: data.recipientFilter?.audienceType ?? "all",
        topicId: data.recipientFilter?.topicId,
        segmentId: data.recipientFilter?.segmentId,
        subject: data.subject,
        previewText: data.previewText,
        from: data.from,
        fromName: data.fromName,
        replyTo: data.replyTo,
        templateId: data.templateId,
        htmlContent: data.htmlContent,
        variableMappings: data.variableMappings,
        body: data.body,
        senderId: data.senderId,
        scheduledFor: data.scheduledFor?.toISOString(),
        awsAccountId: data.awsAccountId,
        totalRecipients: recipientCount,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorData = JSON.parse(errorText) as {
          error?: string;
          debug?: unknown;
        };
        return {
          success: false,
          error: `${errorData.error} | debug: ${JSON.stringify(errorData.debug)}`,
        };
      } catch {
        return { success: false, error: errorText || "Unknown error" };
      }
    }

    const result = (await response.json()) as { id: string };

    revalidatePath(`/${access.orgSlug}/emails/broadcasts`, "page");

    const auditCtx = await getAuditContext();
    db.insert(auditLog)
      .values(
        auditLogEntry(auditCtx, {
          organizationId,
          actorId: access.userId,
          actorEmail: access.userEmail,
          action: "broadcast.sent",
          resource: "broadcast",
          resourceId: result.id,
          metadata: {
            broadcastId: result.id,
            channel: data.channel ?? "email",
            recipientCount,
          },
        })
      )
      .catch(() => {});

    await trackBroadcastCreated(access.userEmail, organizationId, {
      channel: data.channel ?? "email",
      recipientCount,
      templateId: data.templateId,
    });

    return await getBatchSend(result.id, organizationId);
  } catch (error) {
    const log = createActionLogger("createBatchSend", {
      orgSlug: organizationId,
    });
    log.error({ err: error }, "Failed to create batch send");
    return { success: false, error: "Failed to create batch send" };
  }
}

/**
 * Save a broadcast as a draft.
 */
export async function saveDraftBatchSend(
  organizationId: string,
  data: CreateDraftBatchInput
): Promise<SaveDraftBatchResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }

    const permError = checkPermission(access.role, "broadcasts", ["write"]);
    if (permError) return permError;

    const featureCheck = await checkFeatureAccess(organizationId, "batch");
    if (!featureCheck.allowed) {
      return {
        success: false,
        error:
          featureCheck.message ??
          "Batch sending is not available on your plan.",
      };
    }

    const auditCtx = await getAuditContext();
    const newBatch = await db.transaction(async (tx) => {
      const inserted = await insertDraftBroadcast(
        {
          organizationId,
          status: "draft",
          channel: data.channel ?? "email",
          name: data.name ?? null,
          subject: data.subject ?? null,
          previewText: data.previewText ?? null,
          from: data.from ?? null,
          fromName: data.fromName ?? null,
          replyTo: data.replyTo ?? null,
          emailTemplateId: data.templateId ?? null,
          htmlContent: data.htmlContent ?? null,
          variableMappings: data.variableMappings ?? null,
          body: data.body ?? null,
          senderId: data.senderId ?? null,
          audienceType: data.recipientFilter?.audienceType ?? "all",
          topicId: data.recipientFilter?.topicId ?? null,
          segmentId: data.recipientFilter?.segmentId ?? null,
          awsAccountId: data.awsAccountId ?? null,
          scheduledFor: data.scheduledFor ?? null,
          createdBy: access.userId,
        },
        tx
      );
      if (!inserted) return null;
      await tx.insert(auditLog).values(
        auditLogEntry(auditCtx, {
          organizationId,
          actorId: access.userId,
          actorEmail: access.userEmail,
          action: "broadcast.draft_saved",
          resource: "broadcast",
          resourceId: inserted.id,
          metadata: {
            broadcastId: inserted.id,
            channel: data.channel ?? "email",
          },
        })
      );
      return inserted;
    });

    if (!newBatch) {
      return { success: false, error: "Failed to save draft" };
    }

    revalidatePath(`/${access.orgSlug}/emails/broadcasts`, "page");

    return loadBatchWithMeta(newBatch.id, organizationId);
  } catch (error) {
    const log = createActionLogger("saveDraftBatchSend", {
      orgSlug: organizationId,
    });
    log.error({ err: error }, "Failed to save draft batch");
    return { success: false, error: "Failed to save draft" };
  }
}

/**
 * Internal helper: load a batch by (id, orgId) shaped as BatchSendWithMeta.
 */
async function loadBatchWithMeta(
  batchId: string,
  organizationId: string
): Promise<GetBatchResult> {
  const b = await findBroadcastWithMeta(batchId, organizationId);

  if (!b) {
    return { success: false, error: "Batch send not found" };
  }

  return {
    success: true,
    batch: {
      id: b.id,
      name: b.name,
      channel: b.channel as Channel,
      status: b.status as BatchStatus,
      subject: b.subject,
      previewText: b.previewText,
      from: b.from,
      fromName: b.fromName,
      replyTo: b.replyTo,
      templateId: b.emailTemplateId,
      templateName: b.emailTemplate?.name,
      totalRecipients: b.totalRecipients,
      processedRecipients: b.processedRecipients,
      sent: b.sent,
      delivered: b.delivered,
      failed: b.failed,
      opened: b.opened,
      clicked: b.clicked,
      bounced: b.bounced,
      complained: b.complained,
      errorMessage: b.errorMessage,
      scheduledFor: b.scheduledFor,
      startedAt: b.startedAt,
      completedAt: b.completedAt,
      createdAt: b.createdAt,
      createdBy: b.createdByUser,
      awsAccount: b.awsAccount,
    },
  };
}

/**
 * Update an existing draft broadcast. Fails if the row is not a draft.
 */
export async function updateDraftBatchSend(
  batchId: string,
  organizationId: string,
  data: UpdateDraftBatchInput
): Promise<UpdateDraftBatchResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }

    const permError = checkPermission(access.role, "broadcasts", ["write"]);
    if (permError) return permError;

    const existing = await findBroadcastStatus(batchId, organizationId);

    if (!existing) {
      return { success: false, error: "Draft not found" };
    }

    if (existing.status !== "draft") {
      return {
        success: false,
        error: `Cannot edit: broadcast is already ${existing.status}`,
      };
    }

    const updateData: Parameters<typeof updateDraftBroadcast>[2] = {};

    if (data.channel !== undefined) updateData.channel = data.channel;
    if (data.name !== undefined) updateData.name = data.name ?? null;
    if (data.subject !== undefined) updateData.subject = data.subject ?? null;
    if (data.previewText !== undefined)
      updateData.previewText = data.previewText ?? null;
    if (data.from !== undefined) updateData.from = data.from ?? null;
    if (data.fromName !== undefined)
      updateData.fromName = data.fromName ?? null;
    if (data.replyTo !== undefined) updateData.replyTo = data.replyTo ?? null;
    if (data.templateId !== undefined)
      updateData.emailTemplateId = data.templateId ?? null;
    if (data.htmlContent !== undefined)
      updateData.htmlContent = data.htmlContent ?? null;
    if (data.variableMappings !== undefined)
      updateData.variableMappings = data.variableMappings ?? null;
    if (data.body !== undefined) updateData.body = data.body ?? null;
    if (data.senderId !== undefined)
      updateData.senderId = data.senderId ?? null;
    if (data.awsAccountId !== undefined)
      updateData.awsAccountId = data.awsAccountId ?? null;
    if (data.scheduledFor !== undefined)
      updateData.scheduledFor = data.scheduledFor ?? null;
    if (data.recipientFilter !== undefined) {
      updateData.audienceType = data.recipientFilter.audienceType;
      updateData.topicId = data.recipientFilter.topicId ?? null;
      updateData.segmentId = data.recipientFilter.segmentId ?? null;
    }

    const auditCtx = await getAuditContext();
    await db.transaction(async (tx) => {
      await updateDraftBroadcast(batchId, organizationId, updateData, tx);
      await tx.insert(auditLog).values(
        auditLogEntry(auditCtx, {
          organizationId,
          actorId: access.userId,
          actorEmail: access.userEmail,
          action: "broadcast.draft_updated",
          resource: "broadcast",
          resourceId: batchId,
          metadata: { broadcastId: batchId },
        })
      );
    });

    revalidatePath(`/${access.orgSlug}/emails/broadcasts`, "page");
    revalidatePath(`/${access.orgSlug}/emails/broadcasts/${batchId}`, "page");

    return loadBatchWithMeta(batchId, organizationId);
  } catch (error) {
    const log = createActionLogger("updateDraftBatchSend", {
      orgSlug: organizationId,
    });
    log.error({ err: error, batchId }, "Failed to update draft batch");
    return { success: false, error: "Failed to update draft" };
  }
}

/**
 * Promote a draft broadcast to a real send.
 */
export async function promoteDraftToSend(
  batchId: string,
  organizationId: string,
  data: UpdateDraftBatchInput & { scheduledFor?: Date }
): Promise<PromoteDraftBatchResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }

    const permError = checkPermission(access.role, "broadcasts", ["send"]);
    if (permError) return permError;

    const existing = await findDraftBroadcast(batchId, organizationId);

    if (!existing) {
      return { success: false, error: "Draft not found" };
    }

    const merged = {
      awsAccountId: data.awsAccountId ?? existing.awsAccountId ?? undefined,
      channel: (data.channel ?? existing.channel) as Channel,
      name: data.name ?? existing.name ?? undefined,
      subject: data.subject ?? existing.subject ?? undefined,
      previewText: data.previewText ?? existing.previewText ?? undefined,
      from: data.from ?? existing.from ?? undefined,
      fromName: data.fromName ?? existing.fromName ?? undefined,
      replyTo: data.replyTo ?? existing.replyTo ?? undefined,
      templateId: data.templateId ?? existing.emailTemplateId ?? undefined,
      htmlContent: data.htmlContent ?? existing.htmlContent ?? undefined,
      variableMappings:
        data.variableMappings ?? existing.variableMappings ?? undefined,
      body: data.body ?? existing.body ?? undefined,
      senderId: data.senderId ?? existing.senderId ?? undefined,
      recipientFilter:
        data.recipientFilter ??
        ({
          audienceType: (existing.audienceType ?? "all") as
            | "all"
            | "topic"
            | "segment",
          topicId: existing.topicId ?? undefined,
          segmentId: existing.segmentId ?? undefined,
        } as RecipientFilter),
      scheduledFor: data.scheduledFor ?? existing.scheduledFor ?? undefined,
    };

    if (!merged.awsAccountId) {
      return {
        success: false,
        error: "AWS account is required before sending",
      };
    }

    const prep = await validateAndPrepareSend(organizationId, {
      awsAccountId: merged.awsAccountId,
      channel: merged.channel,
      templateId: merged.templateId,
      recipientFilter: merged.recipientFilter,
      scheduledFor: merged.scheduledFor,
    });

    if (!prep.ok) {
      return { success: false, error: prep.error };
    }

    const { recipientCount } = prep;

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: "Session not found" };
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      return { success: false, error: "API URL not configured" };
    }

    const response = await fetch(`${apiUrl}/v1/batch/${batchId}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.session.token}`,
        "X-Organization-Id": organizationId,
      },
      body: JSON.stringify({
        channel: merged.channel,
        name: merged.name,
        audienceType: merged.recipientFilter.audienceType,
        topicId: merged.recipientFilter.topicId,
        segmentId: merged.recipientFilter.segmentId,
        subject: merged.subject,
        previewText: merged.previewText,
        from: merged.from,
        fromName: merged.fromName,
        replyTo: merged.replyTo,
        templateId: merged.templateId,
        htmlContent: merged.htmlContent,
        variableMappings: merged.variableMappings,
        body: merged.body,
        senderId: merged.senderId,
        scheduledFor: merged.scheduledFor
          ? merged.scheduledFor.toISOString()
          : undefined,
        awsAccountId: merged.awsAccountId,
        totalRecipients: recipientCount,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorData = JSON.parse(errorText) as {
          error?: string;
          debug?: unknown;
        };
        return {
          success: false,
          error: errorData.error || "Failed to send broadcast",
        };
      } catch {
        return {
          success: false,
          error: errorText || "Failed to send broadcast",
        };
      }
    }

    revalidatePath(`/${access.orgSlug}/emails/broadcasts`, "page");
    revalidatePath(`/${access.orgSlug}/emails/broadcasts/${batchId}`, "page");

    const auditCtx = await getAuditContext();
    db.insert(auditLog)
      .values(
        auditLogEntry(auditCtx, {
          organizationId,
          actorId: access.userId,
          actorEmail: access.userEmail,
          action: "broadcast.sent_from_draft",
          resource: "broadcast",
          resourceId: batchId,
          metadata: {
            broadcastId: batchId,
            channel: merged.channel,
            recipientCount,
          },
        })
      )
      .catch(() => {});

    await trackBroadcastCreated(access.userEmail, organizationId, {
      channel: merged.channel,
      recipientCount,
      templateId: merged.templateId,
    });

    return loadBatchWithMeta(batchId, organizationId);
  } catch (error) {
    const log = createActionLogger("promoteDraftToSend", {
      orgSlug: organizationId,
    });
    log.error({ err: error, batchId }, "Failed to promote draft");
    return { success: false, error: "Failed to send broadcast" };
  }
}

/**
 * Hard-delete a draft broadcast.
 */
export async function deleteDraftBatchSend(
  batchId: string,
  organizationId: string
): Promise<DeleteDraftBatchResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }

    const permError = checkPermission(access.role, "broadcasts", ["write"]);
    if (permError) return permError;

    const auditCtx = await getAuditContext();
    const deleted = await db.transaction(async (tx) => {
      const rows = await deleteDraftBroadcast(batchId, organizationId, tx);
      if (rows.length === 0) return rows;
      await tx.insert(auditLog).values(
        auditLogEntry(auditCtx, {
          organizationId,
          actorId: access.userId,
          actorEmail: access.userEmail,
          action: "broadcast.draft_deleted",
          resource: "broadcast",
          resourceId: batchId,
          metadata: { broadcastId: batchId },
        })
      );
      return rows;
    });

    if (deleted.length === 0) {
      return {
        success: false,
        error: "Draft not found or already sent",
      };
    }

    revalidatePath(`/${access.orgSlug}/emails/broadcasts`, "page");

    return { success: true };
  } catch (error) {
    const log = createActionLogger("deleteDraftBatchSend", {
      orgSlug: organizationId,
    });
    log.error({ err: error, batchId }, "Failed to delete draft batch");
    return { success: false, error: "Failed to delete draft" };
  }
}

/**
 * Duplicate a broadcast: clone its config as a new draft row.
 */
export async function duplicateBatchSend(
  sourceBatchId: string,
  organizationId: string
): Promise<DuplicateBatchResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }

    const permError = checkPermission(access.role, "broadcasts", ["write"]);
    if (permError) return permError;

    const featureCheck = await checkFeatureAccess(organizationId, "batch");
    if (!featureCheck.allowed) {
      return {
        success: false,
        error:
          featureCheck.message ??
          "Batch sending is not available on your plan.",
      };
    }

    const source = await findBroadcastWithMeta(sourceBatchId, organizationId);

    if (!source) {
      return { success: false, error: "Broadcast not found" };
    }

    const auditCtx = await getAuditContext();
    const newBatch = await db.transaction(async (tx) => {
      const inserted = await duplicateBroadcast(
        source,
        organizationId,
        access.userId,
        tx
      );
      if (!inserted) return null;
      await tx.insert(auditLog).values(
        auditLogEntry(auditCtx, {
          organizationId,
          actorId: access.userId,
          actorEmail: access.userEmail,
          action: "broadcast.duplicated",
          resource: "broadcast",
          resourceId: inserted.id,
          metadata: { broadcastId: inserted.id, sourceId: sourceBatchId },
        })
      );
      return inserted;
    });

    if (!newBatch) {
      return { success: false, error: "Failed to duplicate broadcast" };
    }

    revalidatePath(`/${access.orgSlug}/emails/broadcasts`, "page");

    return loadBatchWithMeta(newBatch.id, organizationId);
  } catch (error) {
    const log = createActionLogger("duplicateBatchSend", {
      orgSlug: organizationId,
    });
    log.error({ err: error, sourceBatchId }, "Failed to duplicate broadcast");
    return { success: false, error: "Failed to duplicate broadcast" };
  }
}

/**
 * Cancel a batch send
 */
export async function cancelBatchSend(
  batchId: string,
  organizationId: string
): Promise<CancelBatchResult> {
  if (!uuidSchema.safeParse(batchId).success) {
    return { success: false, error: "Invalid batch ID" };
  }
  if (!uuidSchema.safeParse(organizationId).success) {
    return { success: false, error: "Invalid organization ID" };
  }

  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }

    const permError = checkPermission(access.role, "broadcasts", ["write"]);
    if (permError) return permError;

    const batch = await findBroadcast(batchId, organizationId);

    if (!batch) {
      return { success: false, error: "Batch not found" };
    }

    if (!["scheduled", "queued", "processing"].includes(batch.status)) {
      return {
        success: false,
        error: `Cannot cancel batch with status "${batch.status}"`,
      };
    }

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: "Session not found" };
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      return { success: false, error: "API URL not configured" };
    }

    const response = await fetch(`${apiUrl}/v1/batch/${batch.id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session.session.token}`,
        "X-Organization-Id": organizationId,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorData = JSON.parse(errorText) as { error?: string };
        return {
          success: false,
          error: errorData.error || "Failed to cancel batch send",
        };
      } catch {
        return {
          success: false,
          error: errorText || "Failed to cancel batch send",
        };
      }
    }

    const auditCtx = await getAuditContext();
    await db.insert(auditLog).values(
      auditLogEntry(auditCtx, {
        organizationId,
        actorId: access.userId,
        actorEmail: access.userEmail,
        action: "broadcast.cancelled",
        resource: "broadcast",
        resourceId: batchId,
        metadata: { broadcastId: batchId },
      })
    );

    revalidatePath(`/${access.orgSlug}/emails/broadcasts`, "page");
    revalidatePath(`/${access.orgSlug}/emails/broadcasts/${batchId}`, "page");

    return { success: true };
  } catch (error) {
    const log = createActionLogger("cancelBatchSend", {
      orgSlug: organizationId,
    });
    log.error({ err: error, batchId }, "Failed to cancel batch send");
    return { success: false, error: "Failed to cancel batch send" };
  }
}

/**
 * Get recipient preview count for batch send form
 */
export async function getRecipientCount(
  organizationId: string,
  channel: Channel = "email",
  filter?: RecipientFilter
): Promise<
  { success: true; count: number } | { success: false; error: string }
> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }
    const permError = checkPermission(access.role, "broadcasts", ["read"]);
    if (permError) return permError;

    const count = await countBroadcastRecipients(
      organizationId,
      channel,
      filter
        ? {
            audienceType: filter.audienceType,
            topicId: filter.topicId,
            segmentId: filter.segmentId,
          }
        : undefined
    );
    return { success: true, count };
  } catch (error) {
    const log = createActionLogger("getRecipientCount", {
      orgSlug: organizationId,
    });
    log.error({ err: error }, "Failed to get recipient count");
    return { success: false, error: "Failed to count recipients" };
  }
}

/**
 * Get sample contacts for audience preview
 */
export async function getSampleContacts(
  organizationId: string,
  channel: Channel = "email",
  filter?: RecipientFilter,
  limit = 5
): Promise<GetSampleContactsResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }
    const permError = checkPermission(access.role, "broadcasts", ["read"]);
    if (permError) return permError;

    const { contacts, totalCount } = await getSampleBroadcastRecipients(
      organizationId,
      channel,
      filter
        ? {
            audienceType: filter.audienceType,
            topicId: filter.topicId,
            segmentId: filter.segmentId,
          }
        : undefined,
      limit
    );

    return {
      success: true,
      contacts: contacts as SampleContact[],
      totalCount,
    };
  } catch (error) {
    const log = createActionLogger("getSampleContacts", {
      orgSlug: organizationId,
    });
    log.error({ err: error }, "Failed to get sample contacts");
    return { success: false, error: "Failed to fetch sample contacts" };
  }
}

/**
 * List templates for batch send form
 */
export async function listTemplatesForBatch(organizationId: string): Promise<
  | {
      success: true;
      templates: Array<{
        id: string;
        name: string;
        subject: string | null;
        previewText: string | null;
      }>;
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
    const permError = checkPermission(access.role, "broadcasts", ["read"]);
    if (permError) return permError;

    const templates = await listPublishedTemplates(organizationId);

    return { success: true, templates };
  } catch (error) {
    const log = createActionLogger("listTemplatesForBatch", {
      orgSlug: organizationId,
    });
    log.error({ err: error }, "Failed to list templates");
    return { success: false, error: "Failed to fetch templates" };
  }
}

/**
 * List topics for batch send recipient selection
 */
export async function listTopicsForBatch(organizationId: string): Promise<
  | {
      success: true;
      topics: Array<{ id: string; name: string; subscriberCount: number }>;
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
    const permError = checkPermission(access.role, "broadcasts", ["read"]);
    if (permError) return permError;

    const topics = await listTopicsWithSubscriberCounts(organizationId);

    return { success: true, topics };
  } catch (error) {
    const log = createActionLogger("listTopicsForBatch", {
      orgSlug: organizationId,
    });
    log.error({ err: error }, "Failed to list topics");
    return { success: false, error: "Failed to fetch topics" };
  }
}

/**
 * List segments for batch send recipient selection
 */
export async function listSegmentsForBatch(organizationId: string): Promise<
  | {
      success: true;
      segments: Array<{ id: string; name: string; memberCount: number }>;
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
    const permError = checkPermission(access.role, "broadcasts", ["read"]);
    if (permError) return permError;

    const segments = await listSegmentsForBroadcast(organizationId);

    return { success: true, segments };
  } catch (error) {
    const log = createActionLogger("listSegmentsForBatch", {
      orgSlug: organizationId,
    });
    log.error({ err: error }, "Failed to list segments");
    return { success: false, error: "Failed to fetch segments" };
  }
}

// =============================================================================
// TEMPLATE VARIABLE EXTRACTION
// =============================================================================

type JSONContent = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: JSONContent[];
  text?: string;
};

/**
 * Extract all variables from a template's JSON content
 */
export async function extractTemplateVariables(
  organizationId: string,
  templateId: string
): Promise<
  | { success: true; variables: ExtractedVariable[] }
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
    const permError = checkPermission(access.role, "broadcasts", ["read"]);
    if (permError) return permError;

    const templateData = await findTemplateVariables(
      templateId,
      organizationId
    );

    if (!templateData) {
      return { success: false, error: "Template not found" };
    }

    const knownVariables = getVariablesForContext("broadcast");
    const knownVariableNames = new Set(knownVariables.map((v) => v.name));

    const extractedVariables: ExtractedVariable[] = [];
    const seenVariables = new Set<string>();

    if (templateData.sourceFormat === "react-email") {
      const storedVars = (templateData.variables ?? []) as Array<{
        name: string;
        fallback?: string;
      }>;
      for (const v of storedVars) {
        if (HANDLEBARS_KEYWORDS.has(v.name)) {
          continue;
        }
        if (!seenVariables.has(v.name)) {
          seenVariables.add(v.name);

          const isKnown = knownVariableNames.has(v.name);
          const knownDef = knownVariables.find((kv) => kv.name === v.name);

          let category: "contact" | "organization" | "system" | "custom";
          if (isKnown && knownDef?.category) {
            category = knownDef.category as typeof category;
          } else if (v.name.startsWith("contact.")) {
            category = "contact";
          } else if (v.name.startsWith("organization.")) {
            category = "organization";
          } else if (
            v.name === "unsubscribeUrl" ||
            v.name === "preferencesUrl" ||
            v.name === "confirmationUrl"
          ) {
            category = "system";
          } else {
            category = "custom";
          }

          extractedVariables.push({
            name: v.name,
            label: knownDef?.label,
            fallback: v.fallback,
            isKnown,
            category,
          });
        }
      }

      extractedVariables.sort((a, b) => {
        if (a.isKnown !== b.isKnown) {
          return a.isKnown ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      return { success: true, variables: extractedVariables };
    }

    function extractFromNode(node: JSONContent) {
      if (node.type === "variable" && node.attrs) {
        const name = node.attrs.name as string;
        const label = node.attrs.label as string | undefined;
        const fallback = node.attrs.fallback as string | undefined;

        if (name && !seenVariables.has(name)) {
          seenVariables.add(name);

          const isKnown = knownVariableNames.has(name);
          const knownDef = knownVariables.find((v) => v.name === name);

          let category: "contact" | "organization" | "system" | "custom";
          if (isKnown && knownDef?.category) {
            category = knownDef.category as typeof category;
          } else if (name.startsWith("contact.")) {
            category = "contact";
          } else if (name.startsWith("organization.")) {
            category = "organization";
          } else if (
            name === "unsubscribeUrl" ||
            name === "preferencesUrl" ||
            name === "confirmationUrl"
          ) {
            category = "system";
          } else {
            category = "custom";
          }

          extractedVariables.push({
            name,
            label: label ?? knownDef?.label,
            fallback: fallback ?? undefined,
            isKnown,
            category,
          });
        }
      }

      if (node.content) {
        for (const child of node.content) {
          extractFromNode(child);
        }
      }
    }

    if (templateData.content) {
      const content =
        typeof templateData.content === "string"
          ? JSON.parse(templateData.content)
          : templateData.content;
      extractFromNode(content as JSONContent);
    }

    extractedVariables.sort((a, b) => {
      if (a.isKnown !== b.isKnown) {
        return a.isKnown ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return { success: true, variables: extractedVariables };
  } catch (error) {
    const log = createActionLogger("extractTemplateVariables", {
      orgSlug: organizationId,
    });
    log.error({ err: error, templateId }, "Failed to extract variables");
    return { success: false, error: "Failed to extract template variables" };
  }
}

/**
 * Get template content for preview rendering
 */
export async function getTemplateContent(
  organizationId: string,
  templateId: string
): Promise<
  | {
      success: true;
      content: unknown;
      subject: string | null;
      compiledHtml: string | null;
      sourceFormat: string | null;
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
    const permError = checkPermission(access.role, "broadcasts", ["read"]);
    if (permError) return permError;

    const templateData = await findTemplateContent(templateId, organizationId);

    if (!templateData) {
      return { success: false, error: "Template not found" };
    }

    return {
      success: true,
      content: templateData.content,
      subject: templateData.subject,
      compiledHtml: templateData.compiledHtml,
      sourceFormat: templateData.sourceFormat,
    };
  } catch (error) {
    const log = createActionLogger("getTemplateContent", {
      orgSlug: organizationId,
    });
    log.error({ err: error, templateId }, "Failed to get template content");
    return { success: false, error: "Failed to fetch template content" };
  }
}
