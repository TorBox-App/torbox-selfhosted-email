import {
  db,
  messageSend,
  organizationExtension,
  template,
  user,
  workflow,
} from "@wraps/db";
import { member } from "@wraps/db/schema/auth";
import { createPlatformClient } from "@wraps.dev/client";
import { and, count, eq } from "drizzle-orm";
import { log } from "./logger";
import { getPostHogClient } from "./posthog";

/** Platform event emission. Never throws, but logs failures. */
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
    const { error } = await client.POST("/v1/events/", {
      body: { name: event, contactEmail, properties },
    });
    if (error) {
      log.error("Activation event emit failed", error, { event, contactEmail });
    }
  } catch (err) {
    log.error("Activation event emit threw", err, { event, contactEmail });
  }
}

/**
 * Track first email sent for an organization.
 * Called after messageSend records are inserted with status "sent".
 * MUST be awaited in Lambda — fire-and-forget = dead code.
 */
export async function trackFirstEmailSent(
  organizationId: string,
  properties: { channel: string; source: string },
  contactEmail?: string
) {
  try {
    const [r] = await db
      .select({ count: count() })
      .from(messageSend)
      .where(
        and(
          eq(messageSend.organizationId, organizationId),
          eq(messageSend.status, "sent")
        )
      );

    const total = r?.count ?? 0;

    // Fire activation event only for the first batch of sent messages
    if (total > 0 && total <= 50) {
      const props = {
        organization_id: organizationId,
        channel: properties.channel,
        source: properties.source,
      };

      const posthog = getPostHogClient();
      posthog.capture({
        distinctId: organizationId,
        event: "activation_first_email_sent",
        properties: props,
        groups: { organization: organizationId },
      });
      posthog.groupIdentify({
        groupType: "organization",
        groupKey: organizationId,
        properties: {
          activation_first_email_sent: true,
        },
      });

      // Also emit to Wraps platform for workflow triggers
      if (contactEmail) {
        await emit(contactEmail, "activation.first_email_sent", props);
      }
    }
  } catch {
    // never throw from tracking
  }
}

/**
 * Track first email delivery for an organization from SES webhook events.
 * Catches SDK sends that bypass batch-sender (no messageSend records).
 * Uses organizationExtension as a cheap check to avoid repeated DB queries.
 * MUST be awaited in Lambda.
 */
export async function trackFirstEmailDelivered(
  organizationId: string,
  source: "sdk" | "platform"
) {
  try {
    // Fast path: check if org already has activation score > 0 with email tracked
    const [ext] = await db
      .select({ activationScore: organizationExtension.activationScore })
      .from(organizationExtension)
      .where(eq(organizationExtension.organizationId, organizationId))
      .limit(1);

    // If activation score >= 7, the org is already well-activated — skip
    if (ext && ext.activationScore >= 7) return;

    // Check whether we've already tracked this activation via messageSend records
    const [r] = await db
      .select({ count: count() })
      .from(messageSend)
      .where(
        and(
          eq(messageSend.organizationId, organizationId),
          eq(messageSend.status, "sent")
        )
      );

    // For platform sends, trackFirstEmailSent already handles this path
    // Only fire here if there are zero messageSend records (pure SDK send)
    // or if we've never fired the activation event before
    const hasPlatformSends = (r?.count ?? 0) > 0;
    if (source === "platform" && hasPlatformSends) return;

    const props = {
      organization_id: organizationId,
      channel: "email",
      source,
    };

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: organizationId,
      event: "activation_first_email_sent",
      properties: props,
      groups: { organization: organizationId },
    });
    posthog.groupIdentify({
      groupType: "organization",
      groupKey: organizationId,
      properties: {
        activation_first_email_sent: true,
        activation_email_source: source,
      },
    });

    // Emit to platform API so activation workflows can trigger on SDK sends
    const ownerEmail = await getOrgOwnerEmail(organizationId);
    if (ownerEmail) {
      await emit(ownerEmail, "activation.first_email_sent", props);
    }

    log.info("Activation: first email delivery tracked from webhook", {
      organizationId,
      source,
    });
  } catch {
    // never throw from tracking
  }
}

/** Look up a user's email by ID. Returns null if not found. */
async function getUserEmail(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return row?.email ?? null;
}

/** Look up the org owner's email. Returns null if not found. */
async function getOrgOwnerEmail(
  organizationId: string
): Promise<string | null> {
  const [row] = await db
    .select({ email: user.email })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(
      and(eq(member.organizationId, organizationId), eq(member.role, "owner"))
    )
    .limit(1);
  return row?.email ?? null;
}

/** Set properties on a contact record via platform API. Best-effort, never throws. */
async function setContactProperties(
  userEmail: string,
  props: Record<string, unknown>
) {
  try {
    const key = process.env.WRAPS_API_KEY;
    if (!key) return;
    const client = createPlatformClient({ apiKey: key });
    const searchResult = await client.GET("/v1/contacts/", {
      params: { query: { search: userEmail, pageSize: "10" } },
    });

    const contacts =
      (
        searchResult.data as
          | {
              contacts?: {
                id: string;
                email: string | null;
                properties: Record<string, unknown> | null;
              }[];
            }
          | undefined
      )?.contacts ?? [];

    const normalizedEmail = userEmail.toLowerCase().trim();
    const matched = contacts.find(
      (c) =>
        typeof c.email === "string" &&
        c.email.toLowerCase().trim() === normalizedEmail
    );

    if (matched) {
      await client.PATCH("/v1/contacts/{id}", {
        params: { path: { id: matched.id } },
        body: {
          properties: {
            ...(typeof matched.properties === "object" &&
            matched.properties !== null
              ? matched.properties
              : {}),
            ...props,
          },
        },
      });
    }
  } catch {
    // best-effort
  }
}

/**
 * Track first resource creation for an organization.
 * Catches CLI pushes that bypass web-side activation tracking.
 * Sets contact properties so activation workflows don't send
 * redundant nudge emails to users who already created resources.
 * MUST be awaited in Lambda.
 */
export async function trackFirstResourceCreated(
  organizationId: string,
  resource: "template" | "workflow",
  source: "cli" | "dashboard",
  userId?: string | null
) {
  try {
    const table = resource === "template" ? template : workflow;
    const [r] = await db
      .select({ count: count() })
      .from(table)
      .where(eq(table.organizationId, organizationId));

    // Resolve user email for contact property updates and event emission
    const userEmail = userId ? await getUserEmail(userId) : null;

    // Always set contact properties so workflows know the user has created
    // this resource, even if it's not their first one
    if (userEmail) {
      const contactProp =
        resource === "template"
          ? { hasCreatedTemplate: true }
          : { hasCreatedWorkflow: true };
      await setContactProperties(userEmail, contactProp);
    }

    // Only fire "first" activation events when count === 1
    if ((r?.count ?? 0) !== 1) return;

    const eventName =
      resource === "template"
        ? "activation_first_template"
        : "activation_first_automation";
    const platformEvent =
      resource === "template"
        ? "activation.first_template"
        : "activation.first_automation";

    const props = {
      organization_id: organizationId,
      resource,
      source,
    };

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userEmail ?? organizationId,
      event: eventName,
      properties: props,
      groups: { organization: organizationId },
    });
    posthog.groupIdentify({
      groupType: "organization",
      groupKey: organizationId,
      properties: {
        [eventName]: true,
        [`${eventName}_source`]: source,
      },
    });

    // Emit to platform so activation workflows can react
    if (userEmail) {
      await emit(userEmail, platformEvent, props);
    }

    log.info("Activation: first resource created", {
      organizationId,
      resource,
      source,
    });
  } catch {
    // never throw from tracking
  }
}
