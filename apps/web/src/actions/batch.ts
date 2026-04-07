"use server";
// baseline:allow-large-file

import { auth } from "@wraps/auth";
import {
  batchSend,
  contact,
  contactTopic,
  db,
  escapeIlike,
  template,
} from "@wraps/db";
import {
  and,
  desc,
  eq,
  exists,
  inArray,
  isNotNull,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { getVariablesForContext } from "@/components/template-editor/variables/variable-definitions";
import { trackBroadcastCreated } from "@/lib/activation-tracking";
import type {
  BatchStatus,
  CancelBatchResult,
  Channel,
  CreateBatchInput,
  CreateBatchResult,
  ExtractedVariable,
  GetBatchResult,
  GetSampleContactsResult,
  ListBatchesResult,
  RecipientFilter,
  SampleContact,
} from "@/lib/batch";
import { HANDLEBARS_KEYWORDS } from "@/lib/handlebars";
import { createActionLogger, serializeError } from "@/lib/logger";
import { checkFeatureAccess } from "@/lib/plan-limits";
import type { FilterCondition, SegmentFilter } from "@/lib/segments";
import { verifyOrgAccess } from "./shared/verify-org-access";
import { publishTemplateToSES } from "./templates";

// UUID validation schema for input sanitization
const uuidSchema = z.string().uuid();

// Re-export types for convenience
export type {
  AudienceType,
  BatchSendWithMeta,
  CancelBatchResult,
  ContentType,
  CreateBatchResult,
  GetBatchResult,
  ListBatchesResult,
  RecipientFilter,
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

    const { page = 1, pageSize = 20, status, channel } = options;
    const offset = (page - 1) * pageSize;

    // Build where conditions
    const conditions = [eq(batchSend.organizationId, organizationId)];
    if (status) {
      conditions.push(eq(batchSend.status, status));
    }
    if (channel) {
      conditions.push(eq(batchSend.channel, channel));
    }

    // Get total count
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(batchSend)
      .where(and(...conditions));

    const total = totalResult?.count ?? 0;

    // Get batch sends with relations
    const batches = await db.query.batchSend.findMany({
      where: and(...conditions),
      with: {
        createdByUser: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
        awsAccount: {
          columns: {
            id: true,
            name: true,
            region: true,
          },
        },
        emailTemplate: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [desc(batchSend.createdAt)],
      limit: pageSize,
      offset,
    });

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
    log.error({ err: serializeError(error) }, "Failed to list batch sends");
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

    const b = await db.query.batchSend.findFirst({
      where: (batch, { and, eq }) =>
        and(eq(batch.id, batchId), eq(batch.organizationId, organizationId)),
      with: {
        createdByUser: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
        awsAccount: {
          columns: {
            id: true,
            name: true,
            region: true,
          },
        },
        emailTemplate: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });

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
  } catch (error) {
    const log = createActionLogger("getBatchSend", {
      orgSlug: organizationId,
    });
    log.error(
      { err: serializeError(error), batchId },
      "Failed to get batch send"
    );
    return { success: false, error: "Failed to fetch batch send" };
  }
}

/**
 * Create a new batch send by calling the API
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

    // Only owners and admins can create batch sends
    if (!["owner", "admin"].includes(access.role)) {
      return {
        success: false,
        error: "Only owners and admins can send emails",
      };
    }

    // Check if batch sending is available for this plan
    const featureCheck = await checkFeatureAccess(organizationId, "batch");
    if (!featureCheck.allowed) {
      return {
        success: false,
        error:
          featureCheck.message ??
          "Batch sending is not available on your plan.",
      };
    }

    // Check if scheduling is available (requires campaigns feature - Starter+)
    if (data.scheduledFor) {
      const schedulingCheck = await checkFeatureAccess(
        organizationId,
        "campaigns"
      );
      if (!schedulingCheck.allowed) {
        return {
          success: false,
          error:
            schedulingCheck.message ??
            "Scheduling broadcasts requires a paid plan.",
        };
      }
    }

    // Validate AWS account exists and belongs to org
    const awsAccount = await db.query.awsAccount.findFirst({
      where: (a, { and, eq }) =>
        and(eq(a.id, data.awsAccountId), eq(a.organizationId, organizationId)),
    });

    if (!awsAccount) {
      return { success: false, error: "AWS account not found" };
    }

    // Validate template if provided and auto-publish if needed
    if (data.templateId) {
      const tmpl = await db.query.template.findFirst({
        where: (t, { and, eq }) =>
          and(eq(t.id, data.templateId!), eq(t.organizationId, organizationId)),
        columns: {
          id: true,
          sesTemplateName: true,
          subject: true,
          updatedAt: true,
          publishedAt: true,
        },
      });

      if (!tmpl) {
        return { success: false, error: "Template not found" };
      }

      // Re-publish only if:
      // 1. Never pushed to SES (no sesTemplateName)
      // 2. Edited after last publish (dashboard edits update updatedAt)
      // CLI-pushed templates have sesTemplateName but null publishedAt —
      // dashboard edits to those will re-publish since publishedAt is null.
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
            success: false,
            error: `Failed to publish template: ${publishResult.error}`,
          };
        }
      }
    }

    // Count eligible recipients based on filter
    const recipientCount = await countRecipients(
      organizationId,
      data.channel ?? "email",
      data.recipientFilter
    );

    if (recipientCount === 0) {
      return {
        success: false,
        error:
          data.channel === "sms"
            ? "No contacts with SMS consent found"
            : "No active email contacts found",
      };
    }

    // Get session from Better Auth
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: "Session not found" };
    }

    // Call the API to create batch and enqueue
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
        // Recipient targeting
        audienceType: data.recipientFilter?.audienceType ?? "all",
        topicId: data.recipientFilter?.topicId,
        segmentId: data.recipientFilter?.segmentId,
        // Email fields
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
      // Read body as text first, then try to parse as JSON
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

    revalidatePath("/[orgSlug]/emails/broadcasts", "page");

    // Track activation event (fire-and-forget)
    trackBroadcastCreated(access.userEmail, organizationId, {
      channel: data.channel ?? "email",
      recipientCount,
    });

    return await getBatchSend(result.id, organizationId);
  } catch (error) {
    const log = createActionLogger("createBatchSend", {
      orgSlug: organizationId,
    });
    log.error({ err: serializeError(error) }, "Failed to create batch send");
    return { success: false, error: "Failed to create batch send" };
  }
}

/**
 * Cancel a batch send
 *
 * Calls the API DELETE endpoint which handles:
 * - Verifying batch exists and ownership
 * - Checking if batch can be cancelled (only scheduled/queued)
 * - Deleting EventBridge schedule if status is "scheduled"
 * - Updating status to "cancelled"
 */
export async function cancelBatchSend(
  batchId: string,
  organizationId: string
): Promise<CancelBatchResult> {
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

    // Only owners and admins can cancel batch sends
    if (!["owner", "admin"].includes(access.role)) {
      return {
        success: false,
        error: "Only owners and admins can cancel batch sends",
      };
    }

    // Verify batch exists and belongs to this organization before making API call
    // This prevents SSRF by ensuring we only use validated IDs from the database
    const batch = await db.query.batchSend.findFirst({
      where: (b, { and, eq }) =>
        and(eq(b.id, batchId), eq(b.organizationId, organizationId)),
      columns: { id: true, status: true },
    });

    if (!batch) {
      return { success: false, error: "Batch not found" };
    }

    // Check if batch can be cancelled (scheduled, queued, or processing)
    if (!["scheduled", "queued", "processing"].includes(batch.status)) {
      return {
        success: false,
        error: `Cannot cancel batch with status "${batch.status}"`,
      };
    }

    // Get session for API auth
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: "Session not found" };
    }

    // Call the API to cancel batch (handles EventBridge schedule deletion)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      return { success: false, error: "API URL not configured" };
    }

    // Use validated batch.id from database, not raw user input
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

    revalidatePath("/[orgSlug]/emails/broadcasts", "page");
    revalidatePath(`/[orgSlug]/emails/broadcasts/${batchId}`, "page");

    return { success: true };
  } catch (error) {
    const log = createActionLogger("cancelBatchSend", {
      orgSlug: organizationId,
    });
    log.error(
      { err: serializeError(error), batchId },
      "Failed to cancel batch send"
    );
    return { success: false, error: "Failed to cancel batch send" };
  }
}

// Map of field names to Drizzle column references for segment filtering
const COLUMN_MAP = {
  status: contact.status,
  email: contact.email,
  lastActivityAt: contact.lastActivityAt,
  lastEmailSentAt: contact.lastEmailSentAt,
  lastEmailOpenedAt: contact.lastEmailOpenedAt,
  lastEmailClickedAt: contact.lastEmailClickedAt,
  emailsSent: contact.emailsSent,
  emailsOpened: contact.emailsOpened,
  emailsClicked: contact.emailsClicked,
  createdAt: contact.createdAt,
  confirmedAt: contact.confirmedAt,
} as const;

/**
 * Build SQL condition from a single segment filter
 */
function buildFilterSQL(filter: SegmentFilter): SQL | null {
  const { field, operator, value, unit } = filter;

  // Handle topic-based filters
  if (field === "topics") {
    const topicId = value as string;
    const subquery = db
      .select({ contactId: contactTopic.contactId })
      .from(contactTopic)
      .where(
        and(
          eq(contactTopic.contactId, contact.id),
          eq(contactTopic.topicId, topicId),
          eq(contactTopic.status, "subscribed")
        )
      );

    if (operator === "hasTopic") {
      return exists(subquery);
    }
    if (operator === "notHasTopic") {
      // Use sql to build NOT EXISTS
      return sql`NOT EXISTS (${subquery})`;
    }
    return null;
  }

  // Handle custom properties
  if (field.startsWith("properties.")) {
    const propertyKey = field.replace("properties.", "");

    switch (operator) {
      case "equals":
        return sql`properties->>${propertyKey} = ${String(value)}`;
      case "notEquals":
        return sql`properties->>${propertyKey} != ${String(value)}`;
      case "contains":
        return sql`properties->>${propertyKey} ILIKE ${`%${escapeIlike(String(value))}%`}`;
      case "exists":
        return sql`properties ? ${propertyKey}`;
      case "notExists":
        return sql`NOT (properties ? ${propertyKey})`;
      default:
        return null;
    }
  }

  // Handle standard contact fields
  const col = COLUMN_MAP[field as keyof typeof COLUMN_MAP];
  if (!col) {
    return null;
  }

  switch (operator) {
    case "equals":
      return sql`${col} = ${value}`;
    case "notEquals":
      return sql`${col} != ${value}`;
    case "contains":
      return sql`${col} ILIKE ${`%${escapeIlike(String(value))}%`}`;
    case "greaterThan":
      return sql`${col} > ${value}`;
    case "lessThan":
      return sql`${col} < ${value}`;
    case "exists":
      return sql`${col} IS NOT NULL`;
    case "notExists":
      return sql`${col} IS NULL`;
    case "within": {
      const timeValue = value as number;
      const interval =
        unit === "hours"
          ? `${timeValue} hours`
          : unit === "minutes"
            ? `${timeValue} minutes`
            : `${timeValue} days`;
      return sql`${col} > NOW() - INTERVAL ${interval}`;
    }
    default:
      return null;
  }
}

/**
 * Build SQL condition from FilterCondition recursively
 */
function buildConditionSQL(condition: FilterCondition): SQL | null {
  const groupConditions: SQL[] = [];

  for (const group of condition.groups) {
    const filterConditions: SQL[] = [];

    for (const filter of group.filters) {
      const filterSQL = buildFilterSQL(filter);
      if (filterSQL) {
        filterConditions.push(filterSQL);
      }
    }

    if (group.nested) {
      const nestedSQL = buildConditionSQL(group.nested);
      if (nestedSQL) {
        filterConditions.push(nestedSQL);
      }
    }

    if (filterConditions.length > 0) {
      groupConditions.push(and(...filterConditions)!);
    }
  }

  if (groupConditions.length === 0) {
    return null;
  }

  if (condition.logic === "OR") {
    return or(...groupConditions) ?? null;
  }
  return and(...groupConditions) ?? null;
}

/**
 * Count eligible recipients for a batch send
 */
async function countRecipients(
  organizationId: string,
  channel: Channel,
  filter?: RecipientFilter
): Promise<number> {
  // Base conditions for channel
  const baseConditions: SQL[] = [eq(contact.organizationId, organizationId)];

  if (channel === "email") {
    baseConditions.push(isNotNull(contact.email));
    baseConditions.push(
      sql`(${contact.emailStatus} = 'active' OR ${contact.emailStatus} IS NULL)`
    );
  } else {
    // SMS
    baseConditions.push(isNotNull(contact.phone));
    baseConditions.push(eq(contact.smsStatus, "opted_in"));
  }

  // Apply recipient filter
  if (filter?.audienceType === "topic" && filter.topicId) {
    // Filter by topic subscription
    const topicSubquery = db
      .select({ contactId: contactTopic.contactId })
      .from(contactTopic)
      .where(
        and(
          eq(contactTopic.contactId, contact.id),
          eq(contactTopic.topicId, filter.topicId),
          eq(contactTopic.status, "subscribed")
        )
      );
    baseConditions.push(exists(topicSubquery));
  } else if (filter?.audienceType === "segment" && filter.segmentId) {
    // Fetch segment and apply its condition
    const seg = await db.query.segment.findFirst({
      where: (s, { and, eq }) =>
        and(eq(s.id, filter.segmentId!), eq(s.organizationId, organizationId)),
    });

    if (seg?.condition) {
      const segmentSQL = buildConditionSQL(seg.condition);
      if (segmentSQL) {
        baseConditions.push(segmentSQL);
      }
    }
  }

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contact)
    .where(and(...baseConditions));

  return result?.count ?? 0;
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

    const count = await countRecipients(organizationId, channel, filter);
    return { success: true, count };
  } catch (error) {
    const log = createActionLogger("getRecipientCount", {
      orgSlug: organizationId,
    });
    log.error({ err: serializeError(error) }, "Failed to get recipient count");
    return { success: false, error: "Failed to count recipients" };
  }
}

/**
 * Get sample contacts for audience preview
 * Returns a few sample contacts matching the filter for preview purposes
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

    // Base conditions for channel
    const baseConditions: SQL[] = [eq(contact.organizationId, organizationId)];

    if (channel === "email") {
      baseConditions.push(isNotNull(contact.email));
      baseConditions.push(
        sql`(${contact.emailStatus} = 'active' OR ${contact.emailStatus} IS NULL)`
      );
    } else {
      // SMS
      baseConditions.push(isNotNull(contact.phone));
      baseConditions.push(eq(contact.smsStatus, "opted_in"));
    }

    // Apply recipient filter
    if (filter?.audienceType === "topic" && filter.topicId) {
      // Filter by topic subscription
      const topicSubquery = db
        .select({ contactId: contactTopic.contactId })
        .from(contactTopic)
        .where(
          and(
            eq(contactTopic.contactId, contact.id),
            eq(contactTopic.topicId, filter.topicId),
            eq(contactTopic.status, "subscribed")
          )
        );
      baseConditions.push(exists(topicSubquery));
    } else if (filter?.audienceType === "segment" && filter.segmentId) {
      // Fetch segment and apply its condition
      const seg = await db.query.segment.findFirst({
        where: (s, { and, eq }) =>
          and(
            eq(s.id, filter.segmentId!),
            eq(s.organizationId, organizationId)
          ),
      });

      if (seg?.condition) {
        const segmentSQL = buildConditionSQL(seg.condition);
        if (segmentSQL) {
          baseConditions.push(segmentSQL);
        }
      }
    }

    // Get total count first
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contact)
      .where(and(...baseConditions));

    const totalCount = countResult?.count ?? 0;

    // Get sample contacts
    const contacts = await db
      .select({
        id: contact.id,
        email: contact.email,
        firstName: contact.firstName,
        lastName: contact.lastName,
        company: contact.company,
      })
      .from(contact)
      .where(and(...baseConditions))
      .orderBy(desc(contact.createdAt))
      .limit(limit);

    return {
      success: true,
      contacts: contacts as SampleContact[],
      totalCount,
    };
  } catch (error) {
    const log = createActionLogger("getSampleContacts", {
      orgSlug: organizationId,
    });
    log.error({ err: serializeError(error) }, "Failed to get sample contacts");
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

    const templates = await db.query.template.findMany({
      where: (t, { and, eq }) =>
        and(eq(t.organizationId, organizationId), eq(t.status, "PUBLISHED")),
      columns: {
        id: true,
        name: true,
        subject: true,
        previewText: true,
      },
      orderBy: [desc(template.updatedAt)],
    });

    return {
      success: true,
      templates,
    };
  } catch (error) {
    const log = createActionLogger("listTemplatesForBatch", {
      orgSlug: organizationId,
    });
    log.error({ err: serializeError(error) }, "Failed to list templates");
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

    const topics = await db.query.topic.findMany({
      where: (t, { eq }) => eq(t.organizationId, organizationId),
      columns: {
        id: true,
        name: true,
      },
    });

    // Get subscriber counts scoped to this org's topics
    const topicIds = topics.map((t) => t.id);
    const subscriberCounts =
      topicIds.length > 0
        ? await db
            .select({
              topicId: contactTopic.topicId,
              count: sql<number>`count(*)::int`,
            })
            .from(contactTopic)
            .where(
              and(
                eq(contactTopic.status, "subscribed"),
                inArray(contactTopic.topicId, topicIds)
              )
            )
            .groupBy(contactTopic.topicId)
        : [];

    const countMap = new Map(subscriberCounts.map((c) => [c.topicId, c.count]));

    // Sort by subscriber count descending
    const topicsWithCounts = topics
      .map((t) => ({
        id: t.id,
        name: t.name,
        subscriberCount: countMap.get(t.id) ?? 0,
      }))
      .sort((a, b) => b.subscriberCount - a.subscriberCount);

    return {
      success: true,
      topics: topicsWithCounts,
    };
  } catch (error) {
    const log = createActionLogger("listTopicsForBatch", {
      orgSlug: organizationId,
    });
    log.error({ err: serializeError(error) }, "Failed to list topics");
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

    const segments = await db.query.segment.findMany({
      where: (s, { eq }) => eq(s.organizationId, organizationId),
      columns: {
        id: true,
        name: true,
        memberCount: true,
      },
      orderBy: (s, { desc }) => [desc(s.memberCount)],
    });

    return {
      success: true,
      segments: segments.map((s) => ({
        id: s.id,
        name: s.name,
        memberCount: s.memberCount,
      })),
    };
  } catch (error) {
    const log = createActionLogger("listSegmentsForBatch", {
      orgSlug: organizationId,
    });
    log.error({ err: serializeError(error) }, "Failed to list segments");
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
 * Returns a list of variables with their known/custom status
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

    // Fetch the template
    const templateData = await db.query.template.findFirst({
      where: (t, { and, eq }) =>
        and(eq(t.id, templateId), eq(t.organizationId, organizationId)),
      columns: {
        content: true,
        emailType: true,
        sourceFormat: true,
        variables: true,
      },
    });

    if (!templateData) {
      return { success: false, error: "Template not found" };
    }

    // Get known variables for broadcast context
    const knownVariables = getVariablesForContext("broadcast");
    const knownVariableNames = new Set(knownVariables.map((v) => v.name));

    // Extract variables from the template content
    const extractedVariables: ExtractedVariable[] = [];
    const seenVariables = new Set<string>();

    // React-email templates store variables in the dedicated column
    if (templateData.sourceFormat === "react-email") {
      const storedVars = (templateData.variables ?? []) as Array<{
        name: string;
        fallback?: string;
      }>;
      for (const v of storedVars) {
        // Defensive: stale rows from before the extractor was fixed may
        // still contain Handlebars block keywords like `else`. Skip them.
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
        if (a.isKnown !== b.isKnown) return a.isKnown ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      return { success: true, variables: extractedVariables };
    }

    // TipTap templates: walk JSONContent nodes to find variable nodes
    function extractFromNode(node: JSONContent) {
      // Check if this is a variable node
      if (node.type === "variable" && node.attrs) {
        const name = node.attrs.name as string;
        const label = node.attrs.label as string | undefined;
        const fallback = node.attrs.fallback as string | undefined;

        if (name && !seenVariables.has(name)) {
          seenVariables.add(name);

          // Determine if this is a known variable
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

      // Recurse into children
      if (node.content) {
        for (const child of node.content) {
          extractFromNode(child);
        }
      }
    }

    // Parse and extract from the template content
    if (templateData.content) {
      const content =
        typeof templateData.content === "string"
          ? JSON.parse(templateData.content)
          : templateData.content;
      extractFromNode(content as JSONContent);
    }

    // Sort variables: known first, then custom, alphabetically within each group
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
    log.error(
      { err: serializeError(error), templateId },
      "Failed to extract variables"
    );
    return { success: false, error: "Failed to extract template variables" };
  }
}

/**
 * Get template content for preview rendering
 * Returns the template's JSONContent for client-side rendering
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

    const templateData = await db.query.template.findFirst({
      where: (t, { and, eq }) =>
        and(eq(t.id, templateId), eq(t.organizationId, organizationId)),
      columns: {
        content: true,
        subject: true,
        compiledHtml: true,
        sourceFormat: true,
      },
    });

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
    log.error(
      { err: serializeError(error), templateId },
      "Failed to get template content"
    );
    return { success: false, error: "Failed to fetch template content" };
  }
}
