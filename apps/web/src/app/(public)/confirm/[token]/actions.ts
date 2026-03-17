"use server";

import { contact, contactTopic, db, eq, topic } from "@wraps/db";
import { verifyConfirmationToken } from "@wraps/email";
import { and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type ConfirmResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Confirm a topic subscription
 */
export async function confirmSubscription(
  token: string
): Promise<ConfirmResult> {
  // Verify token
  const payload = await verifyConfirmationToken(token);
  if (!payload) {
    return { success: false, error: "Invalid or expired confirmation link" };
  }

  const { cid: contactId, oid: organizationId, tid: topicId } = payload;

  // Verify contact exists and belongs to organization
  const [contactRecord] = await db
    .select({ id: contact.id })
    .from(contact)
    .where(
      and(eq(contact.id, contactId), eq(contact.organizationId, organizationId))
    )
    .limit(1);

  if (!contactRecord) {
    return { success: false, error: "Contact not found" };
  }

  // Verify topic exists
  const [topicRecord] = await db
    .select({ id: topic.id })
    .from(topic)
    .where(and(eq(topic.id, topicId), eq(topic.organizationId, organizationId)))
    .limit(1);

  if (!topicRecord) {
    return { success: false, error: "Topic not found" };
  }

  // Get current subscription status
  const [subscription] = await db
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

  // Check if already confirmed
  if (subscription?.status === "subscribed" && subscription.confirmedAt) {
    // Already confirmed - still return success but subscription is already active
    return { success: true };
  }

  // Reject replay on explicitly unsubscribed contacts (CAN-SPAM/GDPR)
  if (subscription?.status === "unsubscribed") {
    return {
      success: false,
      error:
        "This contact has unsubscribed and cannot be re-subscribed via confirmation link",
    };
  }

  // Check if subscription exists
  if (subscription) {
    // Update pending subscription to confirmed
    const now = new Date();
    await db
      .update(contactTopic)
      .set({
        status: "subscribed",
        subscribedAt: now,
        confirmedAt: now,
        unsubscribedAt: null,
      })
      .where(
        and(
          eq(contactTopic.contactId, contactId),
          eq(contactTopic.topicId, topicId)
        )
      );
  } else {
    // No pending subscription found - this shouldn't happen normally
    // but handle gracefully by creating the subscription
    await db.insert(contactTopic).values({
      contactId,
      topicId,
      status: "subscribed",
      subscribedAt: new Date(),
      confirmedAt: new Date(),
    });
  }

  revalidatePath(`/confirm/${token}`);

  return { success: true };
}
