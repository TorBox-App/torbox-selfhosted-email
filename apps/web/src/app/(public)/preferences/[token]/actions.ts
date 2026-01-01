"use server";

import { contact, contactTopic, db, eq } from "@wraps/db";
import { and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token";

interface ActionResult {
  success: boolean;
  error?: string;
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

    for (const [topicId, subscribed] of Object.entries(subscriptions)) {
      // Check if subscription exists
      const [existing] = await db
        .select({ status: contactTopic.status })
        .from(contactTopic)
        .where(
          and(
            eq(contactTopic.contactId, contactId),
            eq(contactTopic.topicId, topicId)
          )
        )
        .limit(1);

      if (subscribed) {
        if (existing) {
          // Update to subscribed
          if (existing.status !== "subscribed") {
            await db
              .update(contactTopic)
              .set({
                status: "subscribed",
                subscribedAt: now,
                unsubscribedAt: null,
              })
              .where(
                and(
                  eq(contactTopic.contactId, contactId),
                  eq(contactTopic.topicId, topicId)
                )
              );
          }
        } else {
          // Create subscription
          await db.insert(contactTopic).values({
            contactId,
            topicId,
            status: "subscribed",
            subscribedAt: now,
          });
        }
      } else if (existing && existing.status === "subscribed") {
        // Unsubscribe
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
    return { success: true };
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
