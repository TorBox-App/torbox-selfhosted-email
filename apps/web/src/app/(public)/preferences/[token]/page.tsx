import {
  contact,
  contactTopic,
  db,
  eq,
  organization,
  topic,
  topicSettings,
} from "@wraps/db";
import { and } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token";
import { PreferencesForm } from "./preferences-form";

type PreferencesPageProps = {
  params: Promise<{
    token: string;
  }>;
};

export async function generateMetadata({
  params,
}: PreferencesPageProps): Promise<Metadata> {
  const { token } = await params;
  const payload = await verifyUnsubscribeToken(token);

  if (!payload) {
    return { title: "Email Preferences" };
  }

  const [result] = await db
    .select({
      orgName: organization.name,
      title: topicSettings.preferenceCenterTitle,
      description: topicSettings.preferenceCenterDescription,
    })
    .from(organization)
    .leftJoin(
      topicSettings,
      and(
        eq(organization.id, topicSettings.organizationId),
        eq(topicSettings.organizationId, payload.oid) // defense in depth
      )
    )
    .where(eq(organization.id, payload.oid))
    .limit(1);

  const pageTitle = result?.title || "Email Preferences";
  const fullTitle = result?.orgName
    ? `${pageTitle} - ${result.orgName}`
    : pageTitle;

  return {
    title: fullTitle,
    description:
      result?.description || "Manage your email subscription preferences",
  };
}

export default async function PreferencesPage({
  params,
}: PreferencesPageProps) {
  const { token } = await params;

  // Verify token
  const payload = await verifyUnsubscribeToken(token);
  if (!payload) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm dark:bg-gray-800">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/30">
            <svg
              className="h-6 w-6 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          </div>
          <h1 className="mb-2 font-semibold text-gray-900 text-xl dark:text-white">
            Link Expired
          </h1>
          <p className="text-gray-500 text-sm dark:text-gray-400">
            This preferences link is no longer valid. Please use the link from a
            more recent email.
          </p>
        </div>
      </div>
    );
  }

  const { cid: contactId, oid: organizationId } = payload;

  // Load contact
  const [contactRecord] = await db
    .select({
      id: contact.id,
      email: contact.email,
      emailStatus: contact.emailStatus,
    })
    .from(contact)
    .where(
      and(eq(contact.id, contactId), eq(contact.organizationId, organizationId))
    )
    .limit(1);

  if (!contactRecord) {
    notFound();
  }

  // Load organization with branding and topic settings (single query with left join)
  // Join condition includes explicit org check for defense in depth
  const [orgWithSettings] = await db
    .select({
      name: organization.name,
      logo: organization.logo,
      brandColor: organization.brandColor,
      preferenceCenterTitle: topicSettings.preferenceCenterTitle,
      preferenceCenterDescription: topicSettings.preferenceCenterDescription,
    })
    .from(organization)
    .leftJoin(
      topicSettings,
      and(
        eq(organization.id, topicSettings.organizationId),
        eq(topicSettings.organizationId, organizationId) // defense in depth
      )
    )
    .where(eq(organization.id, organizationId))
    .limit(1);

  // Load public topics for this organization
  const topics = await db
    .select({
      id: topic.id,
      name: topic.name,
      description: topic.description,
    })
    .from(topic)
    .where(
      and(eq(topic.organizationId, organizationId), eq(topic.public, true))
    );

  // Load contact's topic subscriptions
  const subscriptions = await db
    .select({
      topicId: contactTopic.topicId,
      status: contactTopic.status,
      confirmedAt: contactTopic.confirmedAt,
    })
    .from(contactTopic)
    .where(eq(contactTopic.contactId, contactId));

  // Load topic doubleOptIn info
  const topicDetails = await db
    .select({
      id: topic.id,
      doubleOptIn: topic.doubleOptIn,
    })
    .from(topic)
    .where(eq(topic.organizationId, organizationId));

  const topicDoubleOptInMap = new Map(
    topicDetails.map((t) => [t.id, t.doubleOptIn])
  );

  // Build topic list with subscription status
  const topicsWithStatus = topics.map((t) => {
    const sub = subscriptions.find((s) => s.topicId === t.id);
    return {
      ...t,
      subscribed: sub?.status === "subscribed",
      pending: sub?.status === "pending",
      doubleOptIn: topicDoubleOptInMap.get(t.id) ?? false,
    };
  });

  const maskedEmail = contactRecord.email
    ? maskEmail(contactRecord.email)
    : "your email";

  const brandColor = orgWithSettings?.brandColor || "#000000"; // Default to black

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header with branding */}
        <div className="mb-8 text-center">
          {orgWithSettings?.logo ? (
            <img
              alt={orgWithSettings.name || "Company logo"}
              className="mx-auto mb-6 h-12 w-auto"
              src={orgWithSettings.logo}
            />
          ) : orgWithSettings?.name ? (
            <div
              className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-xl font-semibold text-lg text-white"
              style={{ backgroundColor: brandColor }}
            >
              {orgWithSettings.name.charAt(0).toUpperCase()}
            </div>
          ) : null}

          <h1 className="mb-2 font-semibold text-2xl text-gray-900 tracking-tight dark:text-white">
            {orgWithSettings?.preferenceCenterTitle || "Email Preferences"}
          </h1>
          <p className="text-gray-500 text-sm dark:text-gray-400">
            {orgWithSettings?.preferenceCenterDescription ? (
              renderDescription(orgWithSettings.preferenceCenterDescription, {
                masked_email: maskedEmail,
                email: contactRecord.email || "",
                org_name: orgWithSettings.name || "",
              })
            ) : (
              <>
                Manage subscriptions for{" "}
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {maskedEmail}
                </span>
              </>
            )}
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 dark:bg-gray-800 dark:ring-gray-700">
          <PreferencesForm
            brandColor={brandColor}
            contactId={contactId}
            isGloballyUnsubscribed={
              contactRecord.emailStatus === "unsubscribed"
            }
            organizationId={organizationId}
            orgName={orgWithSettings?.name || undefined}
            token={token}
            topics={topicsWithStatus}
          />
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-gray-400 text-xs dark:text-gray-500">
          You can update your preferences anytime using the link in our emails.
        </p>
      </div>
    </div>
  );
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!(local && domain)) {
    return email;
  }
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local.at(-1)}@${domain}`;
}

/**
 * Render description with template variables
 * Supported variables: {{masked_email}}, {{email}}, {{org_name}}
 */
function renderDescription(
  template: string,
  variables: Record<string, string>
): React.ReactNode {
  // Split by template variable pattern {{variable_name}}
  const parts = template.split(/(\{\{[^}]+\}\})/g);

  // Create unique keys based on cumulative string position
  let position = 0;
  return parts.map((part) => {
    const currentPosition = position;
    position += part.length;

    const match = part.match(/^\{\{(\w+)\}\}$/);
    if (match) {
      const varName = match[1];
      const value = variables[varName];
      if (value !== undefined) {
        // Highlight the masked_email variable
        if (varName === "masked_email") {
          return (
            <span
              className="font-medium text-gray-700 dark:text-gray-300"
              key={`${varName}-${currentPosition}`}
            >
              {value}
            </span>
          );
        }
        return <span key={`${varName}-${currentPosition}`}>{value}</span>;
      }
      // Return the original if variable not found
      return part;
    }
    return part;
  });
}
