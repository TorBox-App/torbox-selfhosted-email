import { db, messageSend } from "@wraps/db";
import { createPlatformClient } from "@wraps.dev/client";
import { and, count, eq } from "drizzle-orm";
import { PostHog } from "posthog-node";

let posthogClient: PostHog | null = null;

const noopClient = {
  capture: () => {},
  flush: async () => {},
  shutdown: async () => {},
} as unknown as PostHog;

function getPostHogClient(): PostHog {
  if (process.env.NODE_ENV === "test" || process.env.CI === "true") {
    return noopClient;
  }

  if (!posthogClient) {
    const apiKey = process.env.POSTHOG_KEY;
    if (!apiKey) {
      return noopClient;
    }
    posthogClient = new PostHog(apiKey, {
      host: "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}

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
      console.error(`[activation-tracking] emit ${event} failed:`, error);
    }
  } catch (err) {
    console.error(`[activation-tracking] emit ${event} threw:`, err);
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
