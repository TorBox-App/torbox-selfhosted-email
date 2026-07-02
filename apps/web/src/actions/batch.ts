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
  getBroadcastSendOutcomes,
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
import { after } from "next/server";
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
import {
  extractHandlebarsVariables,
  HANDLEBARS_KEYWORDS,
} from "@/lib/handlebars";
import { createActionLogger } from "@/lib/logger";
import { checkFeatureAccess } from "@/lib/plan-limits";
import { orgAction } from "./shared/org-action";
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
export const listBatchSends = orgAction(
  {
    name: "listBatchSends",
    resource: "broadcasts",
    permission: ["read"],
    orgId: (
      organizationId: string,
      _options: {
        page?: number;
        pageSize?: number;
        status?: BatchStatus;
        channel?: Channel;
      } = {}
    ) => organizationId,
    onError: "Failed to fetch batch sends",
  },
  async (
    ctx,
    organizationId: string,
    options: {
      page?: number;
      pageSize?: number;
      status?: BatchStatus;
      channel?: Channel;
    } = {}
  ): Promise<ListBatchesResult> => {
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
  }
);

/**
 * Get a single batch send by ID
 */
export const getBatchSend = orgAction(
  {
    name: "getBatchSend",
    resource: "broadcasts",
    permission: ["read"],
    orgId: (_batchId: string, organizationId: string) => organizationId,
    onError: "Failed to fetch batch send",
  },
  async (
    ctx,
    batchId: string,
    organizationId: string
  ): Promise<GetBatchResult> => {
    // Validate UUID format before any database operations
    if (!uuidSchema.safeParse(batchId).success) {
      return { success: false, error: "Invalid batch ID" };
    }
    if (!uuidSchema.safeParse(organizationId).success) {
      return { success: false, error: "Invalid organization ID" };
    }

    return loadBatchWithMeta(batchId, organizationId);
  }
);

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
  const subjectVarsSeen = new Set(storedVars.map((v) => v.name));
  const allVars: StoredVar[] = [...storedVars];
  if (templateData.subject) {
    for (const v of extractHandlebarsVariables(templateData.subject)) {
      if (!subjectVarsSeen.has(v.name)) {
        subjectVarsSeen.add(v.name);
        allVars.push(v);
      }
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
export const checkTemplateVariableCoverage = orgAction(
  {
    name: "checkTemplateVariableCoverage",
    resource: "broadcasts",
    permission: ["read"],
    orgId: (
      organizationId: string,
      _templateId: string,
      _recipientFilter: RecipientFilter,
      _variableMappings?: VariableMapping[]
    ) => organizationId,
    onError: "Failed to check template variable coverage",
  },
  async (
    ctx,
    organizationId: string,
    templateId: string,
    recipientFilter: RecipientFilter,
    variableMappings?: VariableMapping[]
  ): Promise<CheckTemplateVariableCoverageResult> => {
    const coverage = await assessVariableCoverage(
      organizationId,
      templateId,
      recipientFilter,
      variableMappings
    );

    return { success: true, ...coverage };
  }
);

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
export const createBatchSend = orgAction(
  {
    name: "createBatchSend",
    resource: "broadcasts",
    permission: ["send"],
    orgId: (organizationId: string, _data: CreateBatchInput) => organizationId,
    onError: "Failed to create batch send",
  },
  async (
    ctx,
    organizationId: string,
    data: CreateBatchInput
  ): Promise<CreateBatchResult> => {
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

    revalidatePath(`/${ctx.access.orgSlug}/emails/broadcasts`, "page");

    const auditCtx = await getAuditContext();
    after(() =>
      db
        .insert(auditLog)
        .values(
          auditLogEntry(auditCtx, {
            organizationId,
            actorId: ctx.access.userId,
            actorEmail: ctx.access.userEmail,
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
        .catch((err) =>
          createActionLogger("createBatchSend", {
            orgSlug: organizationId,
          }).warn({ err }, "Best-effort audit log write failed")
        )
    );

    await trackBroadcastCreated(ctx.access.userEmail, organizationId, {
      channel: data.channel ?? "email",
      recipientCount,
      templateId: data.templateId,
    });

    return await getBatchSend(result.id, organizationId);
  }
);

/**
 * Save a broadcast as a draft.
 */
export const saveDraftBatchSend = orgAction(
  {
    name: "saveDraftBatchSend",
    resource: "broadcasts",
    permission: ["write"],
    orgId: (organizationId: string, _data: CreateDraftBatchInput) =>
      organizationId,
    onError: "Failed to save draft",
  },
  async (
    ctx,
    organizationId: string,
    data: CreateDraftBatchInput
  ): Promise<SaveDraftBatchResult> => {
    const featureCheck = await checkFeatureAccess(organizationId, "batch");
    if (!featureCheck.allowed) {
      return {
        success: false,
        error:
          featureCheck.message ??
          "Batch sending is not available on your plan.",
      };
    }

    const newBatch = await ctx.audited(
      async (tx) => {
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
            createdBy: ctx.access.userId,
          },
          tx
        );
        if (!inserted) throw new Error("Broadcast insert returned null");
        return inserted;
      },
      (inserted) => ({
        action: "broadcast.draft_saved" as const,
        resource: "broadcast",
        resourceId: inserted.id,
        metadata: {
          broadcastId: inserted.id,
          channel: data.channel ?? "email",
        },
      })
    );

    revalidatePath(`/${ctx.access.orgSlug}/emails/broadcasts`, "page");

    return loadBatchWithMeta(newBatch.id, organizationId);
  }
);

/**
 * Internal helper: load a batch by (id, orgId) shaped as BatchSendWithMeta.
 */
async function loadBatchWithMeta(
  batchId: string,
  organizationId: string
): Promise<GetBatchResult> {
  // sent/failed come from message_send row statuses, not the batch counters:
  // rows self-heal as SES events arrive, counters don't. Broadcasts that
  // predate per-message rows (total === 0) fall back to the counters.
  const [b, outcomes] = await Promise.all([
    findBroadcastWithMeta(batchId, organizationId),
    getBroadcastSendOutcomes(batchId, organizationId),
  ]);

  if (!b) {
    return { success: false, error: "Batch send not found" };
  }

  const hasPerMessageRows = outcomes.total > 0;

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
      sent: hasPerMessageRows ? outcomes.accepted : b.sent,
      delivered: b.delivered,
      failed: hasPerMessageRows ? outcomes.failed : b.failed,
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
export const updateDraftBatchSend = orgAction(
  {
    name: "updateDraftBatchSend",
    resource: "broadcasts",
    permission: ["write"],
    orgId: (
      _batchId: string,
      organizationId: string,
      _data: UpdateDraftBatchInput
    ) => organizationId,
    onError: "Failed to update draft",
  },
  async (
    ctx,
    batchId: string,
    organizationId: string,
    data: UpdateDraftBatchInput
  ): Promise<UpdateDraftBatchResult> => {
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

    await ctx.audited(
      async (tx) => {
        await updateDraftBroadcast(batchId, organizationId, updateData, tx);
      },
      () => ({
        action: "broadcast.draft_updated" as const,
        resource: "broadcast",
        resourceId: batchId,
        metadata: { broadcastId: batchId },
      })
    );

    revalidatePath(`/${ctx.access.orgSlug}/emails/broadcasts`, "page");
    revalidatePath(
      `/${ctx.access.orgSlug}/emails/broadcasts/${batchId}`,
      "page"
    );

    return loadBatchWithMeta(batchId, organizationId);
  }
);

/**
 * Promote a draft broadcast to a real send.
 */
export const promoteDraftToSend = orgAction(
  {
    name: "promoteDraftToSend",
    resource: "broadcasts",
    permission: ["send"],
    orgId: (
      _batchId: string,
      organizationId: string,
      _data: UpdateDraftBatchInput & { scheduledFor?: Date }
    ) => organizationId,
    onError: "Failed to send broadcast",
  },
  async (
    ctx,
    batchId: string,
    organizationId: string,
    data: UpdateDraftBatchInput & { scheduledFor?: Date }
  ): Promise<PromoteDraftBatchResult> => {
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

    revalidatePath(`/${ctx.access.orgSlug}/emails/broadcasts`, "page");
    revalidatePath(
      `/${ctx.access.orgSlug}/emails/broadcasts/${batchId}`,
      "page"
    );

    const auditCtx = await getAuditContext();
    after(() =>
      db
        .insert(auditLog)
        .values(
          auditLogEntry(auditCtx, {
            organizationId,
            actorId: ctx.access.userId,
            actorEmail: ctx.access.userEmail,
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
        .catch((err) =>
          createActionLogger("promoteDraftToSend", {
            orgSlug: organizationId,
          }).warn({ err }, "Best-effort audit log write failed")
        )
    );

    await trackBroadcastCreated(ctx.access.userEmail, organizationId, {
      channel: merged.channel,
      recipientCount,
      templateId: merged.templateId,
    });

    return loadBatchWithMeta(batchId, organizationId);
  }
);

/**
 * Hard-delete a draft broadcast.
 */
export const deleteDraftBatchSend = orgAction(
  {
    name: "deleteDraftBatchSend",
    resource: "broadcasts",
    permission: ["write"],
    orgId: (_batchId: string, organizationId: string) => organizationId,
    onError: "Failed to delete draft",
  },
  async (
    ctx,
    batchId: string,
    organizationId: string
  ): Promise<DeleteDraftBatchResult> => {
    // Pre-check: verify the draft exists and is in draft status
    const existing = await findBroadcastStatus(batchId, organizationId);
    if (!existing || existing.status !== "draft") {
      return { success: false, error: "Draft not found or already sent" };
    }

    await ctx.audited(
      async (tx) => {
        await deleteDraftBroadcast(batchId, organizationId, tx);
      },
      () => ({
        action: "broadcast.draft_deleted" as const,
        resource: "broadcast",
        resourceId: batchId,
        metadata: { broadcastId: batchId },
      })
    );

    revalidatePath(`/${ctx.access.orgSlug}/emails/broadcasts`, "page");

    return { success: true };
  }
);

/**
 * Duplicate a broadcast: clone its config as a new draft row.
 */
export const duplicateBatchSend = orgAction(
  {
    name: "duplicateBatchSend",
    resource: "broadcasts",
    permission: ["write"],
    orgId: (_sourceBatchId: string, organizationId: string) => organizationId,
    onError: "Failed to duplicate broadcast",
  },
  async (
    ctx,
    sourceBatchId: string,
    organizationId: string
  ): Promise<DuplicateBatchResult> => {
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

    const newBatch = await ctx.audited(
      async (tx) => {
        const inserted = await duplicateBroadcast(
          source,
          organizationId,
          ctx.access.userId,
          tx
        );
        if (!inserted) throw new Error("Broadcast duplicate returned null");
        return inserted;
      },
      (inserted) => ({
        action: "broadcast.duplicated" as const,
        resource: "broadcast",
        resourceId: inserted.id,
        metadata: { broadcastId: inserted.id, sourceId: sourceBatchId },
      })
    );

    revalidatePath(`/${ctx.access.orgSlug}/emails/broadcasts`, "page");

    return loadBatchWithMeta(newBatch.id, organizationId);
  }
);

/**
 * Cancel a batch send
 */
export const cancelBatchSend = orgAction(
  {
    name: "cancelBatchSend",
    resource: "broadcasts",
    permission: ["write"],
    orgId: (_batchId: string, organizationId: string) => organizationId,
    onError: "Failed to cancel batch send",
  },
  async (
    ctx,
    batchId: string,
    organizationId: string
  ): Promise<CancelBatchResult> => {
    if (!uuidSchema.safeParse(batchId).success) {
      return { success: false, error: "Invalid batch ID" };
    }
    if (!uuidSchema.safeParse(organizationId).success) {
      return { success: false, error: "Invalid organization ID" };
    }

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
        actorId: ctx.access.userId,
        actorEmail: ctx.access.userEmail,
        action: "broadcast.cancelled",
        resource: "broadcast",
        resourceId: batchId,
        metadata: { broadcastId: batchId },
      })
    );

    revalidatePath(`/${ctx.access.orgSlug}/emails/broadcasts`, "page");
    revalidatePath(
      `/${ctx.access.orgSlug}/emails/broadcasts/${batchId}`,
      "page"
    );

    return { success: true };
  }
);

/**
 * Get recipient preview count for batch send form
 */
export const getRecipientCount = orgAction(
  {
    name: "getRecipientCount",
    resource: "broadcasts",
    permission: ["read"],
    orgId: (
      organizationId: string,
      _channel?: Channel,
      _filter?: RecipientFilter
    ) => organizationId,
    onError: "Failed to count recipients",
  },
  async (
    ctx,
    organizationId: string,
    channel: Channel = "email",
    filter?: RecipientFilter
  ): Promise<
    { success: true; count: number } | { success: false; error: string }
  > => {
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
  }
);

/**
 * Get sample contacts for audience preview
 */
export const getSampleContacts = orgAction(
  {
    name: "getSampleContacts",
    resource: "broadcasts",
    permission: ["read"],
    orgId: (
      organizationId: string,
      _channel?: Channel,
      _filter?: RecipientFilter,
      _limit?: number
    ) => organizationId,
    onError: "Failed to fetch sample contacts",
  },
  async (
    ctx,
    organizationId: string,
    channel: Channel = "email",
    filter?: RecipientFilter,
    limit = 5
  ): Promise<GetSampleContactsResult> => {
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
  }
);

/**
 * List templates for batch send form
 */
export const listTemplatesForBatch = orgAction(
  {
    name: "listTemplatesForBatch",
    resource: "broadcasts",
    permission: ["read"],
    orgId: (organizationId: string) => organizationId,
    onError: "Failed to fetch templates",
  },
  async (
    ctx,
    organizationId: string
  ): Promise<
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
  > => {
    const templates = await listPublishedTemplates(organizationId);

    return { success: true, templates };
  }
);

/**
 * List topics for batch send recipient selection
 */
export const listTopicsForBatch = orgAction(
  {
    name: "listTopicsForBatch",
    resource: "broadcasts",
    permission: ["read"],
    orgId: (organizationId: string) => organizationId,
    onError: "Failed to fetch topics",
  },
  async (
    ctx,
    organizationId: string
  ): Promise<
    | {
        success: true;
        topics: Array<{ id: string; name: string; subscriberCount: number }>;
      }
    | { success: false; error: string }
  > => {
    const topics = await listTopicsWithSubscriberCounts(organizationId);

    return { success: true, topics };
  }
);

/**
 * List segments for batch send recipient selection
 */
export const listSegmentsForBatch = orgAction(
  {
    name: "listSegmentsForBatch",
    resource: "broadcasts",
    permission: ["read"],
    orgId: (organizationId: string) => organizationId,
    onError: "Failed to fetch segments",
  },
  async (
    ctx,
    organizationId: string
  ): Promise<
    | {
        success: true;
        segments: Array<{ id: string; name: string; memberCount: number }>;
      }
    | { success: false; error: string }
  > => {
    const segments = await listSegmentsForBroadcast(organizationId);

    return { success: true, segments };
  }
);

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
export const extractTemplateVariables = orgAction(
  {
    name: "extractTemplateVariables",
    resource: "broadcasts",
    permission: ["read"],
    orgId: (organizationId: string, _templateId: string) => organizationId,
    onError: "Failed to extract template variables",
  },
  async (
    ctx,
    organizationId: string,
    templateId: string
  ): Promise<
    | { success: true; variables: ExtractedVariable[] }
    | { success: false; error: string }
  > => {
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
  }
);

/**
 * Get template content for preview rendering
 */
export const getTemplateContent = orgAction(
  {
    name: "getTemplateContent",
    resource: "broadcasts",
    permission: ["read"],
    orgId: (organizationId: string, _templateId: string) => organizationId,
    onError: "Failed to fetch template content",
  },
  async (
    ctx,
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
  > => {
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
  }
);
