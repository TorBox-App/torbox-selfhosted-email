/**
 * Batch Sending Routes
 *
 * POST /v1/batch - Create a new batch send
 * GET /v1/batch/:id - Get batch send status
 */

import {
  awsAccount,
  batchSend,
  contact,
  contactTopic,
  db,
  eq,
} from "@wraps/db";
import { and, exists, isNotNull, sql } from "drizzle-orm";
import { t } from "elysia";

import {
  type AuthContext,
  createAuthenticatedRoutes,
} from "../middleware/auth";
import { planGateMiddleware } from "../middleware/plan-gate";
import { rateLimitMiddleware } from "../middleware/rate-limit";
import { enqueueJob } from "../services/queue";
import {
  createBroadcastSchedule,
  deleteBroadcastSchedule,
} from "../services/scheduler";

// Batch send request schema
const createBatchSchema = t.Object({
  channel: t.Optional(
    t.Union([t.Literal("email"), t.Literal("sms")], {
      description: "Channel to send through",
    })
  ),
  name: t.Optional(
    t.String({ description: "Name for the batch send", maxLength: 255 })
  ),
  // Recipient targeting
  audienceType: t.Optional(
    t.Union([t.Literal("all"), t.Literal("topic"), t.Literal("segment")], {
      description: "Audience targeting type",
    })
  ),
  topicId: t.Optional(
    t.String({ description: "Topic ID to target", maxLength: 36 })
  ),
  segmentId: t.Optional(
    t.String({ description: "Segment ID to target", maxLength: 36 })
  ),
  // Email-specific fields
  subject: t.Optional(
    t.String({ description: "Email subject line", maxLength: 998 })
  ),
  previewText: t.Optional(
    t.String({ description: "Email preview text", maxLength: 500 })
  ),
  from: t.Optional(
    t.String({ description: "From email address", maxLength: 255 })
  ),
  fromName: t.Optional(
    t.String({ description: "From display name", maxLength: 100 })
  ),
  replyTo: t.Optional(
    t.String({ description: "Reply-to email address", maxLength: 255 })
  ),
  templateId: t.Optional(
    t.String({ description: "Email template ID", maxLength: 36 })
  ),
  htmlContent: t.Optional(
    t.String({ description: "Raw HTML content (if not using template)" })
  ),
  // Variable mappings for custom template variables
  variableMappings: t.Optional(
    t.Array(
      t.Object({
        variableName: t.String({ description: "Template variable name" }),
        source: t.Union([
          t.Object({
            type: t.Literal("static"),
            value: t.String({ description: "Static value" }),
          }),
          t.Object({
            type: t.Literal("contact"),
            field: t.String({ description: "Contact field name" }),
          }),
        ]),
      }),
      { description: "Variable mappings for custom template variables" }
    )
  ),
  // SMS-specific fields (Phase 3)
  body: t.Optional(t.String({ description: "SMS body text", maxLength: 1600 })),
  senderId: t.Optional(
    t.String({ description: "SMS sender ID", maxLength: 20 })
  ),
  // Scheduling
  scheduledFor: t.Optional(
    t.String({
      description: "ISO 8601 datetime for scheduled send",
      format: "date-time",
    })
  ),
  // AWS account to use
  awsAccountId: t.String({
    description: "AWS account ID to use for sending",
    maxLength: 36,
  }),
  // Pre-counted recipients (from web action validation)
  totalRecipients: t.Optional(
    t.Number({ description: "Pre-counted recipient count" })
  ),
});

// Batch send response schema
const batchResponseSchema = t.Object({
  id: t.String({ description: "Batch ID" }),
  status: t.String({
    description:
      "Batch status (queued, scheduled, processing, completed, failed, cancelled)",
  }),
  channel: t.String({ description: "Channel (email or sms)" }),
  totalRecipients: t.Number({ description: "Total number of recipients" }),
  createdAt: t.String({
    description: "Creation timestamp",
    format: "date-time",
  }),
});

export const batchRoutes = createAuthenticatedRoutes("/v1/batch")
  .use(rateLimitMiddleware)
  .use(planGateMiddleware("batch"))
  .post(
    "/",
    async (ctx) => {
      const { body, set } = ctx;
      const authContext = (ctx as unknown as { auth: AuthContext }).auth;

      // Validate awsAccountId belongs to the authenticated organization
      const [account] = await db
        .select({ id: awsAccount.id })
        .from(awsAccount)
        .where(
          and(
            eq(awsAccount.id, body.awsAccountId),
            eq(awsAccount.organizationId, authContext.organizationId)
          )
        )
        .limit(1);

      if (!account) {
        set.status = 403;
        return {
          id: "",
          status: "error",
          channel: body.channel ?? "email",
          totalRecipients: 0,
          createdAt: new Date().toISOString(),
          error: "AWS account does not belong to this organization",
        };
      }

      // Use pre-counted recipients if provided, otherwise count here
      let recipientCount = body.totalRecipients;
      if (!recipientCount) {
        recipientCount = await getRecipientCount(
          authContext.organizationId,
          body.channel ?? "email",
          {
            audienceType: body.audienceType,
            topicId: body.topicId,
            segmentId: body.segmentId,
          }
        );
      }

      // Determine if this is a scheduled send
      const scheduledFor = body.scheduledFor
        ? new Date(body.scheduledFor)
        : undefined;
      const isScheduled = scheduledFor && scheduledFor > new Date();

      // Create batch send record
      const [batch] = await db
        .insert(batchSend)
        .values({
          organizationId: authContext.organizationId,
          awsAccountId: body.awsAccountId,
          channel: body.channel ?? "email",
          name: body.name ?? `Batch ${new Date().toISOString()}`,
          status: isScheduled ? "scheduled" : "queued",
          // Recipient targeting
          audienceType: body.audienceType ?? "all",
          topicId: body.topicId,
          segmentId: body.segmentId,
          // Email fields
          subject: body.subject,
          previewText: body.previewText,
          from: body.from,
          fromName: body.fromName,
          replyTo: body.replyTo,
          emailTemplateId: body.templateId,
          htmlContent: body.htmlContent,
          variableMappings: body.variableMappings,
          // SMS fields (Phase 3)
          body: body.body,
          senderId: body.senderId,
          // Scheduling
          scheduledFor,
          // Recipients
          totalRecipients: recipientCount,
          // Tracking
          createdBy: authContext.userId,
        })
        .returning();

      if (isScheduled && scheduledFor) {
        // Create EventBridge schedule for future execution
        await createBroadcastSchedule({
          batchId: batch.id,
          organizationId: authContext.organizationId,
          awsAccountId: body.awsAccountId,
          scheduledFor,
          channel: (body.channel ?? "email") as "email" | "sms",
        });
      } else {
        // Send immediately - enqueue to SQS
        await enqueueJob({
          batchId: batch.id,
          organizationId: authContext.organizationId,
          awsAccountId: body.awsAccountId,
          channel: batch.channel,
          chunkIndex: 0,
        });
      }

      return {
        id: batch.id,
        status: batch.status,
        channel: batch.channel,
        totalRecipients: recipientCount,
        createdAt: batch.createdAt.toISOString(),
      };
    },
    {
      body: createBatchSchema,
      response: batchResponseSchema,
      detail: {
        tags: ["batch"],
        summary: "Create batch send",
        description:
          "Creates a new batch send job and queues it for processing",
      },
    }
  )
  .get(
    "/:id",
    async (ctx) => {
      const { params, set } = ctx;
      const authContext = (ctx as unknown as { auth: AuthContext }).auth;

      const [batch] = await db
        .select()
        .from(batchSend)
        .where(
          and(
            eq(batchSend.id, params.id),
            eq(batchSend.organizationId, authContext.organizationId)
          )
        )
        .limit(1);

      if (!batch) {
        set.status = 404;
        throw new Error("Batch not found");
      }

      return {
        id: batch.id,
        status: batch.status,
        channel: batch.channel,
        name: batch.name,
        totalRecipients: batch.totalRecipients,
        processedRecipients: batch.processedRecipients,
        sent: batch.sent,
        failed: batch.failed,
        startedAt: batch.startedAt?.toISOString() ?? null,
        completedAt: batch.completedAt?.toISOString() ?? null,
        createdAt: batch.createdAt.toISOString(),
      };
    },
    {
      params: t.Object({
        id: t.String({ description: "Batch ID", maxLength: 36 }),
      }),
      response: {
        200: t.Object({
          id: t.String(),
          status: t.String(),
          channel: t.String(),
          name: t.Union([t.String(), t.Null()]),
          totalRecipients: t.Number(),
          processedRecipients: t.Number(),
          sent: t.Number(),
          failed: t.Number(),
          startedAt: t.Union([t.String(), t.Null()]),
          completedAt: t.Union([t.String(), t.Null()]),
          createdAt: t.String(),
        }),
      },
      detail: {
        tags: ["batch"],
        summary: "Get batch status",
        description: "Returns the current status of a batch send job",
      },
    }
  )
  .delete(
    "/:id",
    async (ctx) => {
      const { params, set } = ctx;
      const authContext = (ctx as unknown as { auth: AuthContext }).auth;

      // Find the batch (scoped by organization)
      const [batch] = await db
        .select()
        .from(batchSend)
        .where(
          and(
            eq(batchSend.id, params.id),
            eq(batchSend.organizationId, authContext.organizationId)
          )
        )
        .limit(1);

      if (!batch) {
        set.status = 404;
        throw new Error("Batch not found");
      }

      // Can only cancel scheduled or queued batches
      if (!["scheduled", "queued"].includes(batch.status)) {
        set.status = 400;
        throw new Error(
          `Cannot cancel batch in '${batch.status}' status. Only scheduled or queued batches can be cancelled.`
        );
      }

      // If scheduled, delete the EventBridge schedule
      if (batch.status === "scheduled") {
        await deleteBroadcastSchedule(batch.id);
      }

      // Update status to cancelled
      await db
        .update(batchSend)
        .set({
          status: "cancelled",
          updatedAt: new Date(),
        })
        .where(eq(batchSend.id, params.id));

      return { success: true, id: batch.id, status: "cancelled" };
    },
    {
      params: t.Object({
        id: t.String({ description: "Batch ID to cancel", maxLength: 36 }),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          id: t.String(),
          status: t.String(),
        }),
      },
      detail: {
        tags: ["batch"],
        summary: "Cancel batch send",
        description:
          "Cancels a scheduled or queued batch send. If scheduled, also deletes the EventBridge schedule.",
      },
    }
  );

// Helper to count recipients for a batch
async function getRecipientCount(
  organizationId: string,
  channel: string,
  options?: {
    audienceType?: string;
    topicId?: string;
    segmentId?: string;
  }
): Promise<number> {
  const conditions: ReturnType<typeof eq>[] = [
    eq(contact.organizationId, organizationId),
  ];

  if (channel === "email") {
    conditions.push(isNotNull(contact.email));
  } else if (channel === "sms") {
    conditions.push(isNotNull(contact.phone));
    conditions.push(eq(contact.smsStatus, "opted_in"));
  } else {
    return 0;
  }

  // Apply audience filtering
  if (options?.audienceType === "topic" && options.topicId) {
    const topicSubquery = db
      .select({ contactId: contactTopic.contactId })
      .from(contactTopic)
      .where(
        and(
          eq(contactTopic.contactId, contact.id),
          eq(contactTopic.topicId, options.topicId),
          eq(contactTopic.status, "subscribed")
        )
      );
    conditions.push(exists(topicSubquery) as unknown as ReturnType<typeof eq>);
  }

  const whereClause =
    channel === "email"
      ? and(
          ...conditions,
          sql`(${contact.emailStatus} = 'active' OR ${contact.emailStatus} IS NULL)`
        )
      : and(...conditions);

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contact)
    .where(whereClause);

  return result?.count ?? 0;
}
