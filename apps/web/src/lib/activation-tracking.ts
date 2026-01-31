import { apiKey, batchSend, contact, db, template, workflow } from "@wraps/db";
import { createPlatformClient } from "@wraps.dev/client";
import { and, count, eq, isNotNull } from "drizzle-orm";
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

/** Count records for an org. Called AFTER insert, so "first" means count === 1. */
async function countContacts(organizationId: string): Promise<number> {
  const [r] = await db
    .select({ count: count() })
    .from(contact)
    .where(eq(contact.organizationId, organizationId));
  return r?.count ?? 0;
}

async function countWorkflows(organizationId: string): Promise<number> {
  const [r] = await db
    .select({ count: count() })
    .from(workflow)
    .where(eq(workflow.organizationId, organizationId));
  return r?.count ?? 0;
}

async function countTemplates(organizationId: string): Promise<number> {
  const [r] = await db
    .select({ count: count() })
    .from(template)
    .where(eq(template.organizationId, organizationId));
  return r?.count ?? 0;
}

async function countPublishedTemplates(
  organizationId: string
): Promise<number> {
  const [r] = await db
    .select({ count: count() })
    .from(template)
    .where(
      and(
        eq(template.organizationId, organizationId),
        isNotNull(template.sesTemplateName)
      )
    );
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

// ─── Tracking Helpers ────────────────────────────────────────────────────────
// All helpers are async but callers should NOT await them (fire-and-forget).
// Each helper is wrapped in try/catch so it never throws.

export async function trackContactCreated(
  userId: string,
  organizationId: string,
  properties: Record<string, unknown> = {}
) {
  try {
    // Called after insert, so count includes the new record
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
    // Called after import, count includes all newly created records
    const existing = await countContacts(organizationId);
    const props = { organization_id: organizationId, count: properties.count };
    capture(userId, "contacts_imported", props);
    emit(userId, "contacts.imported", props);
    // If total contacts equals what was just imported, these are the first
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
    const existing = await countWorkflows(organizationId);
    const props = { organization_id: organizationId, ...properties };
    capture(userId, "workflow_created", props);
    emit(userId, "workflow.created", props);
    if (existing === 1) {
      const firstProps = { organization_id: organizationId };
      capture(userId, "activation_first_workflow", firstProps);
      emit(userId, "activation.first_workflow", firstProps);
    }
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
    const published = await countPublishedTemplates(organizationId);
    if (published === 1) {
      const firstProps = { organization_id: organizationId };
      capture(userId, "activation_first_template_published", firstProps);
      emit(userId, "activation.first_template_published", firstProps);
    }
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
