import {
  apiKey,
  awsAccount,
  batchSend,
  contact,
  db,
  messageSend,
  template,
} from "@wraps/db";
import { createPlatformClient } from "@wraps.dev/client";
import { and, count, eq } from "drizzle-orm";
import { getPostHogClient } from "./posthog-server";

/** Fire-and-forget PostHog capture. Never throws. */
function capture(
  distinctId: string,
  event: string,
  properties: Record<string, unknown>
) {
  try {
    const posthog = getPostHogClient();
    posthog.capture({ distinctId, event, properties });
  } catch {
    // intentionally swallowed - tracking should never break the app
  }
}

/** Fire-and-forget platform event emission. Never throws. */
async function emit(
  contactEmail: string,
  event: string,
  properties: Record<string, unknown>
) {
  try {
    const key = process.env.WRAPS_API_KEY;
    if (!key) {
      return;
    }
    const client = createPlatformClient({ apiKey: key });
    await client.POST("/v1/events/", {
      body: { name: event, contactEmail, properties },
    });
  } catch {
    // intentionally swallowed - tracking should never break the app
  }
}

// ─── Count Helpers ──────────────────────────────────────────────────────────
// Called AFTER insert, so "first" means count === 1.

async function countAwsAccounts(organizationId: string): Promise<number> {
  const [r] = await db
    .select({ count: count() })
    .from(awsAccount)
    .where(eq(awsAccount.organizationId, organizationId));
  return r?.count ?? 0;
}

async function countContacts(organizationId: string): Promise<number> {
  const [r] = await db
    .select({ count: count() })
    .from(contact)
    .where(eq(contact.organizationId, organizationId));
  return r?.count ?? 0;
}

async function countTemplates(organizationId: string): Promise<number> {
  const [r] = await db
    .select({ count: count() })
    .from(template)
    .where(eq(template.organizationId, organizationId));
  return r?.count ?? 0;
}

async function countBatchSends(organizationId: string): Promise<number> {
  const [r] = await db
    .select({ count: count() })
    .from(batchSend)
    .where(eq(batchSend.organizationId, organizationId));
  return r?.count ?? 0;
}

async function countApiKeys(organizationId: string): Promise<number> {
  const [r] = await db
    .select({ count: count() })
    .from(apiKey)
    .where(eq(apiKey.organizationId, organizationId));
  return r?.count ?? 0;
}

async function countSentMessages(organizationId: string): Promise<number> {
  const [r] = await db
    .select({ count: count() })
    .from(messageSend)
    .where(
      and(
        eq(messageSend.organizationId, organizationId),
        eq(messageSend.status, "sent")
      )
    );
  return r?.count ?? 0;
}

// ─── Tracking Helpers ────────────────────────────────────────────────────────
// All helpers are async but callers should NOT await them (fire-and-forget).
// Each helper is wrapped in try/catch so it never throws.

// ─── Tier 1: Infrastructure Activation ───────────────────────────────────────
// These represent the critical path to "can they send email?"
// Fully Activated = aws_connected + domain_verified + first_email_sent

export async function trackAwsConnected(
  userId: string,
  organizationId: string,
  properties: { region: string; accountId: string }
) {
  try {
    const existing = await countAwsAccounts(organizationId);
    const props = {
      organization_id: organizationId,
      region: properties.region,
      account_id: properties.accountId,
    };
    capture(userId, "aws_account_connected", props);
    emit(userId, "aws_account.connected", props);
    if (existing === 1) {
      capture(userId, "activation_aws_connected", props);
      emit(userId, "activation.aws_connected", props);
    }
  } catch {
    // never throw from tracking
  }
}

export async function trackDomainVerified(
  userId: string,
  organizationId: string,
  properties: {
    domain: string;
    isFirstDomain: boolean;
  }
) {
  try {
    const props = {
      organization_id: organizationId,
      domain: properties.domain,
    };
    capture(userId, "domain_verified", props);
    emit(userId, "domain.verified", props);
    if (properties.isFirstDomain) {
      capture(userId, "activation_domain_verified", props);
      emit(userId, "activation.domain_verified", props);
    }
  } catch {
    // never throw from tracking
  }
}

export async function trackFirstEmailSent(
  userId: string,
  organizationId: string,
  properties: { channel: string; source: string } = {
    channel: "email",
    source: "broadcast",
  }
) {
  try {
    const existing = await countSentMessages(organizationId);
    if (existing <= 1) {
      const props = {
        organization_id: organizationId,
        channel: properties.channel,
        source: properties.source,
      };
      capture(userId, "activation_first_email_sent", props);
      emit(userId, "activation.first_email_sent", props);
    }
  } catch {
    // never throw from tracking
  }
}

// ─── Tier 2: Product Adoption ────────────────────────────────────────────────
// These track deeper engagement with product features.

export async function trackContactCreated(
  userId: string,
  organizationId: string,
  properties: Record<string, unknown> = {}
) {
  try {
    const existing = await countContacts(organizationId);
    const props = {
      organization_id: organizationId,
      method: "manual",
      ...properties,
    };
    capture(userId, "contact_created", props);
    emit(userId, "contact.created", props);
    if (existing === 1) {
      const firstProps = { organization_id: organizationId };
      capture(userId, "activation_first_contact", firstProps);
      emit(userId, "activation.first_contact", firstProps);
    }
  } catch {
    // never throw from tracking
  }
}

export async function trackContactsImported(
  userId: string,
  organizationId: string,
  properties: { count: number }
) {
  try {
    const existing = await countContacts(organizationId);
    const props = { organization_id: organizationId, count: properties.count };
    capture(userId, "contacts_imported", props);
    emit(userId, "contacts.imported", props);
    if (existing <= properties.count) {
      const firstProps = { organization_id: organizationId };
      capture(userId, "activation_first_contact", firstProps);
      emit(userId, "activation.first_contact", firstProps);
    }
  } catch {
    // never throw from tracking
  }
}

export async function trackWorkflowCreated(
  userId: string,
  organizationId: string,
  properties: Record<string, unknown> = {}
) {
  try {
    const props = { organization_id: organizationId, ...properties };
    capture(userId, "workflow_created", props);
    emit(userId, "workflow.created", props);
  } catch {
    // never throw from tracking
  }
}

export async function trackTemplateCreated(
  userId: string,
  organizationId: string,
  properties: Record<string, unknown> = {}
) {
  try {
    const existing = await countTemplates(organizationId);
    const props = { organization_id: organizationId, ...properties };
    capture(userId, "template_created", props);
    emit(userId, "template.created", props);
    if (existing === 1) {
      const firstProps = { organization_id: organizationId };
      capture(userId, "activation_first_template", firstProps);
      emit(userId, "activation.first_template", firstProps);
    }
  } catch {
    // never throw from tracking
  }
}

export async function trackTemplatePublished(
  userId: string,
  organizationId: string,
  properties: Record<string, unknown> = {}
) {
  try {
    const props = { organization_id: organizationId, ...properties };
    capture(userId, "template_published", props);
    emit(userId, "template.published", props);
  } catch {
    // never throw from tracking
  }
}

export async function trackBroadcastCreated(
  userId: string,
  organizationId: string,
  properties: { channel: string; recipientCount: number }
) {
  try {
    const existing = await countBatchSends(organizationId);
    const props = {
      organization_id: organizationId,
      channel: properties.channel,
      recipient_count: properties.recipientCount,
    };
    capture(userId, "broadcast_created", props);
    emit(userId, "broadcast.created", props);
    if (existing === 1) {
      const firstProps = {
        organization_id: organizationId,
        channel: properties.channel,
      };
      capture(userId, "activation_first_broadcast", firstProps);
      emit(userId, "activation.first_broadcast", firstProps);
    }
  } catch {
    // never throw from tracking
  }
}

export async function trackApiKeyCreated(
  userId: string,
  organizationId: string
) {
  try {
    const existing = await countApiKeys(organizationId);
    const props = { organization_id: organizationId };
    capture(userId, "api_key_created", props);
    emit(userId, "api_key.created", props);
    if (existing === 1) {
      capture(userId, "activation_first_api_key", props);
      emit(userId, "activation.first_api_key", props);
    }
  } catch {
    // never throw from tracking
  }
}
