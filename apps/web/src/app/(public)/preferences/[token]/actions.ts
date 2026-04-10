"use server";

import {
  contact,
  contactTopic,
  db,
  eq,
  type PreferredChannel,
  topic,
} from "@wraps/db";
import { determineSubscriptionStatus } from "@wraps/email";
import { and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token";

type ActionResult = {
  success: boolean;
  error?: string;
  pendingTopics?: string[]; // Topic IDs that are now pending confirmation
};

type TopicChange = {
  topicId: string;
  topicName?: string;
  action: "subscribed" | "unsubscribed";
};

/**
 * Emit workflow events for topic subscription changes via the API.
 * Fire-and-forget: failures are logged but never block the preference update.
 */
async function emitPreferenceEvents(
  token: string,
  contactId: string,
  organizationId: string,
  changes: TopicChange[]
): Promise<void> {
  if (changes.length === 0) {
    return;
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.wraps.dev";
  await fetch(`${apiUrl}/v1/preference-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, contactId, organizationId, changes }),
  }).catch((err) => {
    console.error("[PREFERENCES] Failed to emit workflow events:", err);
  });
}

/**
 * Update topic subscriptions for a contact
 */
export async function updatePreferences(
  token: string,
  contactId: string,
  organizationId: string,
  subscriptions: Record<string, boolean>,
  preferredChannel?: PreferredChannel | null
): Promise<ActionResult> {
  // Verify token matches the contact
  const payload = await verifyUnsubscribeToken(token);
  if (!payload || payload.cid !== contactId || payload.oid !== organizationId) {
    return { success: false, error: "Invalid token" };
  }

  // Validate preferredChannel at runtime
  if (
    preferredChannel !== undefined &&
    preferredChannel !== null &&
    preferredChannel !== "email" &&
    preferredChannel !== "sms"
  ) {
    return { success: false, error: "Invalid preferred channel" };
  }

  try {
    const now = new Date();
    const pendingTopics: string[] = [];
    const topicChanges: TopicChange[] = [];

    // Get contact email for confirmation emails
    const [contactRecord] = await db
      .select({ email: contact.email })
      .from(contact)
      .where(eq(contact.id, contactId))
      .limit(1);

    if (!contactRecord?.email) {
      return { success: false, error: "Contact email not found" };
    }

    // Get all topic info for the subscriptions we're updating
    const _topicIds = Object.keys(subscriptions);
    const topics = await db
      .select({
        id: topic.id,
        name: topic.name,
        description: topic.description,
        doubleOptIn: topic.doubleOptIn,
      })
      .from(topic)
      .where(
        and(
          eq(topic.organizationId, organizationId)
          // Filter to only requested topics
          // Note: drizzle doesn't have an easy "in" for dynamic arrays in select,
          // so we'll filter in JS for now
        )
      );

    const topicMap = new Map(topics.map((t) => [t.id, t]));

    for (const [topicId, subscribed] of Object.entries(subscriptions)) {
      const topicInfo = topicMap.get(topicId);
      if (!topicInfo) {
        continue; // Skip unknown topics
      }

      // Check if subscription exists
      const [existing] = await db
        .select({
          status: contactTopic.status,
          confirmedAt: contactTopic.confirmedAt,
        })
        .from(contactTopic)
        .where(
          and(
            eq(contactTopic.contactId, contactId),
            eq(contactTopic.topicId, topicId)
          )
        )
        .limit(1);

      if (subscribed) {
        // Determine if we need double opt-in
        const result = await determineSubscriptionStatus({
          contactId,
          contactEmail: contactRecord.email,
          topicId,
          topicName: topicInfo.name,
          topicDescription: topicInfo.description,
          topicDoubleOptIn: topicInfo.doubleOptIn,
          organizationId,
          existingSubscription: existing ?? null,
        });

        const newStatus = result.status;

        if (result.status === "pending") {
          pendingTopics.push(topicId);
        }

        if (existing) {
          // Update existing subscription
          if (existing.status !== newStatus) {
            await db
              .update(contactTopic)
              .set({
                status: newStatus,
                subscribedAt: newStatus === "subscribed" ? now : undefined,
                unsubscribedAt: null,
                // Set confirmedAt only if directly confirmed (not pending)
                confirmedAt: newStatus === "subscribed" ? now : undefined,
              })
              .where(
                and(
                  eq(contactTopic.contactId, contactId),
                  eq(contactTopic.topicId, topicId)
                )
              );
            // Track subscription change for workflow events (non-pending only)
            if (newStatus === "subscribed") {
              topicChanges.push({
                topicId,
                topicName: topicInfo.name,
                action: "subscribed",
              });
            }
          }
        } else {
          // Create new subscription
          await db.insert(contactTopic).values({
            contactId,
            topicId,
            status: newStatus,
            subscribedAt: newStatus === "subscribed" ? now : null,
            confirmedAt: newStatus === "subscribed" ? now : null,
          });
          // Track new subscription for workflow events (non-pending only)
          if (newStatus === "subscribed") {
            topicChanges.push({
              topicId,
              topicName: topicInfo.name,
              action: "subscribed",
            });
          }
        }
      } else if (existing && existing.status !== "unsubscribed") {
        // Unsubscribe (from subscribed or pending)
        await db
          .update(contactTopic)
          .set({
            status: "unsubscribed",
            unsubscribedAt: now,
          })
          .where(
            and(
              eq(contactTopic.contactId, contactId),
              eq(contactTopic.topicId, topicId)
            )
          );
        topicChanges.push({
          topicId,
          topicName: topicInfo.name,
          action: "unsubscribed",
        });
      }
    }

    // Update preferred channel if provided
    if (preferredChannel !== undefined) {
      await db
        .update(contact)
        .set({
          preferredChannel,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(contact.id, contactId),
            eq(contact.organizationId, organizationId)
          )
        );
    }

    // Emit workflow events for topic changes (fire-and-forget)
    await emitPreferenceEvents(token, contactId, organizationId, topicChanges);

    revalidatePath(`/preferences/${token}`);
    return {
      success: true,
      pendingTopics: pendingTopics.length > 0 ? pendingTopics : undefined,
    };
  } catch (error) {
    console.error("[PREFERENCES] Error updating preferences:", error);
    return { success: false, error: "Failed to update preferences" };
  }
}

/**
 * Unsubscribe contact from all emails globally
 */
export async function unsubscribeGlobally(
  token: string,
  contactId: string,
  organizationId: string
): Promise<ActionResult> {
  // Verify token matches the contact
  const payload = await verifyUnsubscribeToken(token);
  if (!payload || payload.cid !== contactId || payload.oid !== organizationId) {
    return { success: false, error: "Invalid token" };
  }

  try {
    const now = new Date();

    // Get all subscribed topics before unsubscribing (for event emission)
    const subscribedTopics = await db
      .select({
        topicId: contactTopic.topicId,
        topicName: topic.name,
      })
      .from(contactTopic)
      .innerJoin(topic, eq(topic.id, contactTopic.topicId))
      .where(
        and(
          eq(contactTopic.contactId, contactId),
          eq(contactTopic.status, "subscribed")
        )
      );

    // Update contact to unsubscribed
    await db
      .update(contact)
      .set({
        emailStatus: "unsubscribed",
        emailUnsubscribedAt: now,
      })
      .where(
        and(
          eq(contact.id, contactId),
          eq(contact.organizationId, organizationId)
        )
      );

    // Unsubscribe from all topics for this contact
    await db
      .update(contactTopic)
      .set({
        status: "unsubscribed",
        unsubscribedAt: now,
      })
      .where(eq(contactTopic.contactId, contactId));

    // Emit workflow events for all previously subscribed topics
    const changes: TopicChange[] = subscribedTopics.map((t) => ({
      topicId: t.topicId,
      topicName: t.topicName,
      action: "unsubscribed" as const,
    }));
    await emitPreferenceEvents(token, contactId, organizationId, changes);

    revalidatePath(`/preferences/${token}`);
    return { success: true };
  } catch (error) {
    console.error("[PREFERENCES] Error unsubscribing globally:", error);
    return { success: false, error: "Failed to unsubscribe" };
  }
}

/**
 * Resend confirmation email for a pending topic subscription
 */
export async function resendConfirmation(
  token: string,
  contactId: string,
  organizationId: string,
  topicId: string
): Promise<ActionResult> {
  // Verify token matches the contact
  const payload = await verifyUnsubscribeToken(token);
  if (!payload || payload.cid !== contactId || payload.oid !== organizationId) {
    return { success: false, error: "Invalid token" };
  }

  try {
    // Get contact email
    const [contactRecord] = await db
      .select({ email: contact.email })
      .from(contact)
      .where(eq(contact.id, contactId))
      .limit(1);

    if (!contactRecord?.email) {
      return { success: false, error: "Contact email not found" };
    }

    // Get topic info
    const [topicInfo] = await db
      .select({
        id: topic.id,
        name: topic.name,
        description: topic.description,
        doubleOptIn: topic.doubleOptIn,
      })
      .from(topic)
      .where(
        and(eq(topic.id, topicId), eq(topic.organizationId, organizationId))
      )
      .limit(1);

    if (!topicInfo) {
      return { success: false, error: "Topic not found" };
    }

    if (!topicInfo.doubleOptIn) {
      return { success: false, error: "Topic does not require confirmation" };
    }

    // Check subscription status
    const [subscription] = await db
      .select({ status: contactTopic.status })
      .from(contactTopic)
      .where(
        and(
          eq(contactTopic.contactId, contactId),
          eq(contactTopic.topicId, topicId)
        )
      )
      .limit(1);

    if (!subscription || subscription.status !== "pending") {
      return { success: false, error: "No pending subscription found" };
    }

    // Resend confirmation email
    const result = await determineSubscriptionStatus({
      contactId,
      contactEmail: contactRecord.email,
      topicId,
      topicName: topicInfo.name,
      topicDescription: topicInfo.description,
      topicDoubleOptIn: true, // Force sending
      organizationId,
      existingSubscription: null, // Treat as new to force email send
    });

    if (!result.confirmationEmailSent) {
      return {
        success: false,
        error: result.error || "Failed to send confirmation email",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("[PREFERENCES] Error resending confirmation:", error);
    return { success: false, error: "Failed to resend confirmation" };
  }
}
