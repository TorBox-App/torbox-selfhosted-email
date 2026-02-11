"use server";

import { auth } from "@wraps/auth";
import { contact, contactEvent, contactTopic, db } from "@wraps/db";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { headers } from "next/headers";
import type {
  ContactStatus,
  ContactWithMeta,
  EmailStatus,
  SmsStatus,
} from "@/lib/contacts";
import type { EventWithContact, ListEventsOptions } from "@/lib/events";
import { buildEventsFilterConditions } from "@/lib/events-queries.server";
import { createActionLogger, serializeError } from "@/lib/logger";

const MAX_EXPORT_ROWS = 50_000;

async function verifyOrgAccess(
  organizationId: string
): Promise<{ userId: string; role: string; orgSlug: string } | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return null;
  }

  const membership = await db.query.member.findFirst({
    where: (m, { and, eq }) =>
      and(eq(m.organizationId, organizationId), eq(m.userId, session.user.id)),
    with: {
      organization: {
        columns: { slug: true },
      },
    },
  });

  if (!membership?.organization.slug) {
    return null;
  }

  return {
    userId: session.user.id,
    role: membership.role,
    orgSlug: membership.organization.slug,
  };
}

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

    const { search, emailStatus, topicId } = options;

    // Build where conditions
    const conditions = [eq(contact.organizationId, organizationId)];

    if (search) {
      conditions.push(ilike(contact.email, `%${search}%`));
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
    log.error({ err: serializeError(error) }, "Failed to export contacts");
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

    const conditions = buildEventsFilterConditions(organizationId, options);

    const events = await db
      .select({
        id: contactEvent.id,
        eventName: contactEvent.eventName,
        eventData: contactEvent.eventData,
        createdAt: contactEvent.createdAt,
        contactId: contactEvent.contactId,
        contactEmail: contact.email,
        contactFirstName: contact.firstName,
        contactLastName: contact.lastName,
      })
      .from(contactEvent)
      .innerJoin(
        contact,
        and(
          eq(contactEvent.contactId, contact.id),
          eq(contact.organizationId, organizationId)
        )
      )
      .where(and(...conditions))
      .orderBy(desc(contactEvent.createdAt))
      .limit(MAX_EXPORT_ROWS);

    return {
      success: true,
      events: events as EventWithContact[],
      total: events.length,
    };
  } catch (error) {
    const log = createActionLogger("exportAllEvents", {
      orgSlug: organizationId,
    });
    log.error({ err: serializeError(error) }, "Failed to export events");
    return { success: false, error: "Failed to export events" };
  }
}
