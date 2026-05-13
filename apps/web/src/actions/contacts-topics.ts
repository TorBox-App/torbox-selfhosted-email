"use server";

import { auditLog, contactTopic, db } from "@wraps/db";
import { and, eq, inArray, or } from "drizzle-orm";
import { auditLogEntry, getAuditContext } from "@/lib/audit";
import { createActionLogger, serializeError } from "@/lib/logger";
import { revalidateContacts } from "./contacts";
import { checkPermission } from "./shared/permissions";
import { verifyOrgAccess } from "./shared/verify-org-access";

/**
 * Subscribe a contact to topics
 */
export async function subscribeContactToTopics(
  contactId: string,
  organizationId: string,
  topicIds: string[]
): Promise<{ success: boolean; error?: string }> {
  let orgSlug: string | undefined;
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }
    const permError = checkPermission(access.role, "contacts", ["write"]);
    if (permError) return permError;
    orgSlug = access.orgSlug;

    // Verify contact exists
    const existing = await db.query.contact.findFirst({
      where: (c, { and, eq }) =>
        and(eq(c.id, contactId), eq(c.organizationId, organizationId)),
      with: {
        topics: true,
      },
    });

    if (!existing) {
      return { success: false, error: "Contact not found" };
    }

    // Get current subscriptions
    const currentTopicIds = new Set(
      existing.topics
        .filter((t) => t.status === "subscribed")
        .map((t) => t.topicId)
    );

    // Filter to only new subscriptions
    const newTopicIds = topicIds.filter((id) => !currentTopicIds.has(id));

    if (newTopicIds.length === 0) {
      return { success: true };
    }

    // Check if any are resubscriptions (previously unsubscribed)
    const previousSubscriptions = existing.topics
      .filter(
        (t) => t.status === "unsubscribed" && newTopicIds.includes(t.topicId)
      )
      .map((t) => t.topicId);

    const auditCtx = await getAuditContext();
    await db.transaction(async (tx) => {
      if (previousSubscriptions.length > 0) {
        await tx
          .update(contactTopic)
          .set({
            status: "subscribed",
            subscribedAt: new Date(),
            unsubscribedAt: null,
          })
          .where(
            and(
              eq(contactTopic.contactId, contactId),
              or(
                ...previousSubscriptions.map((id) =>
                  eq(contactTopic.topicId, id)
                )
              )
            )
          );
      }

      const trulyNewTopicIds = newTopicIds.filter(
        (id) => !previousSubscriptions.includes(id)
      );
      if (trulyNewTopicIds.length > 0) {
        await tx.insert(contactTopic).values(
          trulyNewTopicIds.map((topicId) => ({
            contactId,
            topicId,
            status: "subscribed",
          }))
        );
      }

      await tx.insert(auditLog).values(
        auditLogEntry(auditCtx, {
          organizationId,
          actorId: access.userId,
          actorEmail: access.userEmail,
          action: "contact.topic_subscribed",
          resource: "contact",
          resourceId: contactId,
          metadata: { contactId, topicIds },
        })
      );
    });

    revalidateContacts(orgSlug);

    return { success: true };
  } catch (error) {
    const log = createActionLogger("subscribeContactToTopics", { orgSlug });
    log.error(
      { err: serializeError(error), contactId, topicIds },
      "Failed to subscribe contact to topics"
    );
    return { success: false, error: "Failed to subscribe to topics" };
  }
}

/**
 * Bulk subscribe multiple contacts to topics
 */
export async function bulkSubscribeContactsToTopics(
  organizationId: string,
  contactIds: string[],
  topicIds: string[]
): Promise<{ success: boolean; error?: string; count?: number }> {
  let orgSlug: string | undefined;
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }
    orgSlug = access.orgSlug;

    const bulkSubPermError = checkPermission(access.role, "contacts", [
      "write",
    ]);
    if (bulkSubPermError) return bulkSubPermError;

    // Batch-fetch all contacts + their topic subscriptions in one query
    const existingContacts = await db.query.contact.findMany({
      where: (c, { and, eq }) =>
        and(inArray(c.id, contactIds), eq(c.organizationId, organizationId)),
      with: { topics: true },
    });

    const contactMap = new Map(existingContacts.map((c) => [c.id, c]));

    let subscribed = 0;

    const auditCtx = await getAuditContext();
    await db.transaction(async (tx) => {
      for (const contactId of contactIds) {
        const existing = contactMap.get(contactId);
        if (!existing) continue;

        const currentTopicIds = new Set(
          existing.topics
            .filter((t) => t.status === "subscribed")
            .map((t) => t.topicId)
        );

        const newTopicIds = topicIds.filter((id) => !currentTopicIds.has(id));
        if (newTopicIds.length === 0) continue;

        const previousSubs = existing.topics
          .filter(
            (t) =>
              t.status === "unsubscribed" && newTopicIds.includes(t.topicId)
          )
          .map((t) => t.topicId);

        if (previousSubs.length > 0) {
          await tx
            .update(contactTopic)
            .set({
              status: "subscribed",
              subscribedAt: new Date(),
              unsubscribedAt: null,
            })
            .where(
              and(
                eq(contactTopic.contactId, contactId),
                or(...previousSubs.map((id) => eq(contactTopic.topicId, id)))
              )
            );
        }

        const trulyNew = newTopicIds.filter((id) => !previousSubs.includes(id));
        if (trulyNew.length > 0) {
          await tx.insert(contactTopic).values(
            trulyNew.map((topicId) => ({
              contactId,
              topicId,
              status: "subscribed",
            }))
          );
        }

        subscribed++;
      }

      await tx.insert(auditLog).values(
        auditLogEntry(auditCtx, {
          organizationId,
          actorId: access.userId,
          actorEmail: access.userEmail,
          action: "contact.topics_bulk_subscribed",
          resource: "contact",
          metadata: { contactCount: subscribed, topicIds },
        })
      );
    });

    revalidateContacts(orgSlug);

    return { success: true, count: subscribed };
  } catch (error) {
    const log = createActionLogger("bulkSubscribeContactsToTopics", {
      orgSlug,
    });
    log.error(
      { err: serializeError(error), contactCount: contactIds.length, topicIds },
      "Failed to bulk subscribe contacts"
    );
    return { success: false, error: "Failed to subscribe contacts" };
  }
}

/**
 * Bulk unsubscribe multiple contacts from topics
 */
export async function bulkUnsubscribeContactsFromTopics(
  organizationId: string,
  contactIds: string[],
  topicIds: string[]
): Promise<{ success: boolean; error?: string; count?: number }> {
  let orgSlug: string | undefined;
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }
    orgSlug = access.orgSlug;

    const bulkUnsubPermError = checkPermission(access.role, "contacts", [
      "write",
    ]);
    if (bulkUnsubPermError) return bulkUnsubPermError;

    const auditCtx = await getAuditContext();
    let unsubscribedCount = 0;

    await db.transaction(async (tx) => {
      const existingSubscriptions = await tx
        .selectDistinct({ contactId: contactTopic.contactId })
        .from(contactTopic)
        .where(
          and(
            eq(contactTopic.status, "subscribed"),
            or(...contactIds.map((id) => eq(contactTopic.contactId, id))),
            or(...topicIds.map((id) => eq(contactTopic.topicId, id)))
          )
        );

      unsubscribedCount = existingSubscriptions.length;

      if (unsubscribedCount > 0) {
        await tx
          .update(contactTopic)
          .set({
            status: "unsubscribed",
            unsubscribedAt: new Date(),
          })
          .where(
            and(
              eq(contactTopic.status, "subscribed"),
              or(...contactIds.map((id) => eq(contactTopic.contactId, id))),
              or(...topicIds.map((id) => eq(contactTopic.topicId, id)))
            )
          );
      }

      await tx.insert(auditLog).values(
        auditLogEntry(auditCtx, {
          organizationId,
          actorId: access.userId,
          actorEmail: access.userEmail,
          action: "contact.topics_bulk_unsubscribed",
          resource: "contact",
          metadata: { contactCount: unsubscribedCount, topicIds },
        })
      );
    });

    revalidateContacts(orgSlug);

    return { success: true, count: unsubscribedCount };
  } catch (error) {
    const log = createActionLogger("bulkUnsubscribeContactsFromTopics", {
      orgSlug,
    });
    log.error(
      { err: serializeError(error), contactCount: contactIds.length, topicIds },
      "Failed to bulk unsubscribe contacts"
    );
    return { success: false, error: "Failed to unsubscribe contacts" };
  }
}

/**
 * Unsubscribe a contact from topics
 */
export async function unsubscribeContactFromTopics(
  contactId: string,
  organizationId: string,
  topicIds: string[]
): Promise<{ success: boolean; error?: string }> {
  let orgSlug: string | undefined;
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }
    const permError = checkPermission(access.role, "contacts", ["write"]);
    if (permError) return permError;
    orgSlug = access.orgSlug;

    // Verify contact exists
    const existing = await db.query.contact.findFirst({
      where: (c, { and, eq }) =>
        and(eq(c.id, contactId), eq(c.organizationId, organizationId)),
    });

    if (!existing) {
      return { success: false, error: "Contact not found" };
    }

    const auditCtx = await getAuditContext();
    await db.transaction(async (tx) => {
      await tx
        .update(contactTopic)
        .set({
          status: "unsubscribed",
          unsubscribedAt: new Date(),
        })
        .where(
          and(
            eq(contactTopic.contactId, contactId),
            eq(contactTopic.status, "subscribed"),
            or(...topicIds.map((id) => eq(contactTopic.topicId, id)))
          )
        );

      await tx.insert(auditLog).values(
        auditLogEntry(auditCtx, {
          organizationId,
          actorId: access.userId,
          actorEmail: access.userEmail,
          action: "contact.topic_unsubscribed",
          resource: "contact",
          resourceId: contactId,
          metadata: { contactId, topicIds },
        })
      );
    });

    revalidateContacts(orgSlug);

    return { success: true };
  } catch (error) {
    const log = createActionLogger("unsubscribeContactFromTopics", { orgSlug });
    log.error(
      { err: serializeError(error), contactId, topicIds },
      "Failed to unsubscribe contact from topics"
    );
    return { success: false, error: "Failed to unsubscribe from topics" };
  }
}
