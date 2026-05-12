"use server";

import {
  contact,
  contactTopic,
  db,
  type EventFilters,
  escapeIlike,
  exportContactEvents,
} from "@wraps/db";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import type {
  ContactStatus,
  ContactWithMeta,
  EmailStatus,
  PreferredChannel,
  SmsStatus,
} from "@/lib/contacts";
import type { EventWithContact, ListEventsOptions } from "@/lib/events";
import { createActionLogger } from "@/lib/logger";
import { checkPermission } from "./shared/permissions";
import { verifyOrgAccess } from "./shared/verify-org-access";

const MAX_EXPORT_ROWS = 50_000;

export async function exportAllContacts(
  organizationId: string,
  options: {
    search?: string;
    emailStatus?: EmailStatus;
    topicId?: string;
  } = {}
): Promise<
  | { success: true; contacts: ContactWithMeta[]; total: number }
  | { success: false; error: string }
> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }
    const permError = checkPermission(access.role, "contacts", ["export"]);
    if (permError) return permError;

    const { search, emailStatus, topicId } = options;

    // Build where conditions
    const conditions = [eq(contact.organizationId, organizationId)];

    if (search) {
      conditions.push(ilike(contact.email, `%${escapeIlike(search)}%`));
    }

    if (emailStatus) {
      conditions.push(eq(contact.emailStatus, emailStatus));
    }

    // If filtering by topic, we need a subquery
    let topicFilter: ReturnType<typeof sql> | undefined;
    if (topicId) {
      const subscribedContactIds = db
        .select({ contactId: contactTopic.contactId })
        .from(contactTopic)
        .where(
          and(
            eq(contactTopic.topicId, topicId),
            eq(contactTopic.status, "subscribed")
          )
        );
      topicFilter = sql`${contact.id} IN (${subscribedContactIds})`;
    }

    const whereClause = topicFilter
      ? and(...conditions, topicFilter)
      : and(...conditions);

    // Get contacts without pagination, with safety cap
    const contacts = await db.query.contact.findMany({
      where: whereClause,
      with: {
        createdByUser: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
        topics: {
          with: {
            topic: {
              columns: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [desc(contact.createdAt)],
      limit: MAX_EXPORT_ROWS,
    });

    return {
      success: true,
      contacts: contacts.map((c) => ({
        id: c.id,
        email: c.email,
        emailStatus: c.emailStatus as EmailStatus | null,
        emailVerifiedAt: c.emailVerifiedAt,
        emailUnsubscribedAt: c.emailUnsubscribedAt,
        emailBouncedAt: c.emailBouncedAt,
        emailComplainedAt: c.emailComplainedAt,
        emailSuppressedAt: c.emailSuppressedAt,
        lastEmailSentAt: c.lastEmailSentAt,
        lastEmailOpenedAt: c.lastEmailOpenedAt,
        lastEmailClickedAt: c.lastEmailClickedAt,
        emailsSent: c.emailsSent,
        emailsOpened: c.emailsOpened,
        emailsClicked: c.emailsClicked,
        phone: c.phone,
        smsStatus: c.smsStatus as SmsStatus | null,
        smsConsentedAt: c.smsConsentedAt,
        smsOptedOutAt: c.smsOptedOutAt,
        smsInvalidAt: c.smsInvalidAt,
        lastSmsSentAt: c.lastSmsSentAt,
        lastSmsClickedAt: c.lastSmsClickedAt,
        smsSent: c.smsSent,
        smsClicked: c.smsClicked,
        firstName: c.firstName,
        lastName: c.lastName,
        company: c.company,
        jobTitle: c.jobTitle,
        preferredChannel: c.preferredChannel as PreferredChannel | null,
        properties: (c.properties as Record<string, unknown>) || {},
        lastActivityAt: c.lastActivityAt,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        createdBy: c.createdByUser,
        topics: c.topics.map((ct) => ({
          topicId: ct.topic.id,
          topicName: ct.topic.name,
          status: ct.status,
          subscribedAt: ct.subscribedAt,
        })),
        status: c.status as ContactStatus,
        confirmedAt: c.confirmedAt,
        unsubscribedAt: c.unsubscribedAt,
        bouncedAt: c.bouncedAt,
        complainedAt: c.complainedAt,
      })),
      total: contacts.length,
    };
  } catch (error) {
    const log = createActionLogger("exportAllContacts", {
      orgSlug: organizationId,
    });
    log.error({ err: error }, "Failed to export contacts");
    return { success: false, error: "Failed to export contacts" };
  }
}

export async function exportAllEvents(
  organizationId: string,
  options: Omit<ListEventsOptions, "page" | "pageSize"> = {}
): Promise<
  | { success: true; events: EventWithContact[]; total: number }
  | { success: false; error: string }
> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }
    const permError = checkPermission(access.role, "events", ["export"]);
    if (permError) return permError;

    const events = await exportContactEvents(
      organizationId,
      options as EventFilters,
      MAX_EXPORT_ROWS
    );

    return {
      success: true,
      events: events as EventWithContact[],
      total: events.length,
    };
  } catch (error) {
    const log = createActionLogger("exportAllEvents", {
      orgSlug: organizationId,
    });
    log.error({ err: error }, "Failed to export events");
    return { success: false, error: "Failed to export events" };
  }
}
