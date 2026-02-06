import { db, messageSend } from "@wraps/db";
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

/**
 * Track first email sent for an organization.
 * Called after messageSend records are inserted with status "sent".
 * Fire-and-forget — never throws.
 */
export async function trackFirstEmailSent(
  organizationId: string,
  properties: { channel: string; source: string }
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
      const posthog = getPostHogClient();
      posthog.capture({
        distinctId: organizationId,
        event: "activation_first_email_sent",
        properties: {
          organization_id: organizationId,
          channel: properties.channel,
          source: properties.source,
        },
      });
    }
  } catch {
    // never throw from tracking
  }
}
