"use server";

import { contact, contactTopic, db, eq, topic } from "@wraps/db";
import { and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { determineSubscriptionStatus } from "@wraps/email";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token";

interface ActionResult {
  success: boolean;
  error?: string;
  pendingTopics?: string[]; // Topic IDs that are now pending confirmation
}

/**
 * Update topic subscriptions for a contact
 */
export async function updatePreferences(
  token: string,
  contactId: string,
  organizationId: string,
  subscriptions: Record<string, boolean>
): Promise<ActionResult> {
  // Verify token matches the contact
  const payload = await verifyUnsubscribeToken(token);
  if (!payload || payload.cid !== contactId || payload.oid !== organizationId) {
    return { success: false, error: "Invalid token" };
  }

  try {
    const now = new Date();
    const pendingTopics: string[] = [];

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
    const topicIds = Object.keys(subscriptions);
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
          eq(topic.organizationId, organizationId),
          // Filter to only requested topics
          // Note: drizzle doesn't have an easy "in" for dynamic arrays in select,
          // so we'll filter in JS for now
        )
      );

    const topicMap = new Map(topics.map((t) => [t.id, t]));

    for (const [topicId, subscribed] of Object.entries(subscriptions)) {
      const topicInfo = topicMap.get(topicId);
      if (!topicInfo) continue; // Skip unknown topics

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
      }
    }

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

    // Update contact to unsubscribed
    await db
      .update(contact)
      .set({
        emailStatus: "unsubscribed",
        emailUnsubscribedAt: now,
      })
      .where(eq(contact.id, contactId));

    // Unsubscribe from all topics
    await db
      .update(contactTopic)
      .set({
        status: "unsubscribed",
        unsubscribedAt: now,
      })
      .where(eq(contactTopic.contactId, contactId));

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
