/**
 * Topic Subscription Service
 *
 * Handles double opt-in logic for topic subscriptions.
 * Sends confirmation emails via the organization's AWS SES.
 */

import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
import { awsAccount, db, eq, organization } from "@wraps/db";

import { generateConfirmationUrl } from "./confirmation-token";
import { generateTopicConfirmationEmail } from "@wraps/email/emails/topic-confirmation";

export type CreateSubscriptionParams = {
  contactId: string;
  contactEmail: string;
  topicId: string;
  topicName: string;
  topicDescription?: string | null;
  topicDoubleOptIn: boolean;
  organizationId: string;
  existingSubscription?: {
    status: string;
    confirmedAt: Date | null;
  } | null;
};

export type CreateSubscriptionResult = {
  status: "subscribed" | "pending";
  confirmationEmailSent?: boolean;
  error?: string;
};

/**
 * Determine subscription status and send confirmation email if needed.
 *
 * Rules:
 * 1. If topic doesn't require double opt-in → return "subscribed"
 * 2. If re-subscribing and was previously confirmed → return "subscribed" (auto-confirm)
 * 3. Otherwise → send confirmation email, return "pending"
 */
export async function determineSubscriptionStatus(
  params: CreateSubscriptionParams
): Promise<CreateSubscriptionResult> {
  const {
    topicDoubleOptIn,
    existingSubscription,
    contactId,
    contactEmail,
    topicId,
    topicName,
    topicDescription,
    organizationId,
  } = params;

  // Rule 1: No double opt-in required
  if (!topicDoubleOptIn) {
    return { status: "subscribed" };
  }

  // Rule 2: Previously confirmed (re-subscription)
  if (existingSubscription?.confirmedAt) {
    return { status: "subscribed" };
  }

  // Rule 3: Need to send confirmation email
  try {
    const emailSent = await sendTopicConfirmationEmail({
      contactId,
      contactEmail,
      topicId,
      topicName,
      topicDescription,
      organizationId,
    });

    return {
      status: "pending",
      confirmationEmailSent: emailSent,
    };
  } catch (error) {
    console.error("Failed to send confirmation email:", error);
    return {
      status: "pending",
      confirmationEmailSent: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

type SendConfirmationParams = {
  contactId: string;
  contactEmail: string;
  topicId: string;
  topicName: string;
  topicDescription?: string | null;
  organizationId: string;
};

/**
 * Send topic subscription confirmation email via the organization's SES
 */
async function sendTopicConfirmationEmail(
  params: SendConfirmationParams
): Promise<boolean> {
  const {
    contactId,
    contactEmail,
    topicId,
    topicName,
    topicDescription,
    organizationId,
  } = params;

  // Get organization name and AWS account
  const [org] = await db
    .select({
      name: organization.name,
    })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);

  // Get the organization's first AWS account (for SES sending)
  const [account] = await db
    .select({
      id: awsAccount.id,
      roleArn: awsAccount.roleArn,
      externalId: awsAccount.externalId,
      region: awsAccount.region,
    })
    .from(awsAccount)
    .where(eq(awsAccount.organizationId, organizationId))
    .limit(1);

  if (!account) {
    throw new Error("Organization has no AWS account configured");
  }

  // Generate confirmation URL
  const confirmationUrl = await generateConfirmationUrl(
    contactId,
    organizationId,
    topicId
  );

  // Generate email content
  const { subject, html, text } = generateTopicConfirmationEmail({
    url: confirmationUrl,
    topicName,
    topicDescription,
    organizationName: org?.name,
  });

  // Assume role to get SES credentials
  const stsClient = new STSClient({
    region: account.region,
  });

  const assumeRoleResponse = await stsClient.send(
    new AssumeRoleCommand({
      RoleArn: account.roleArn,
      RoleSessionName: `wraps-confirmation-${Date.now()}`,
      ExternalId: account.externalId,
      DurationSeconds: 900, // 15 minutes
    })
  );

  if (!assumeRoleResponse.Credentials) {
    throw new Error("Failed to assume AWS role");
  }

  // Create SES client with assumed credentials
  const sesClient = new SESClient({
    region: account.region,
    credentials: {
      accessKeyId: assumeRoleResponse.Credentials.AccessKeyId!,
      secretAccessKey: assumeRoleResponse.Credentials.SecretAccessKey!,
      sessionToken: assumeRoleResponse.Credentials.SessionToken!,
    },
  });

  // Get a verified sending identity (domain) for the organization
  // For now, use a noreply address with the first verified domain
  // In production, this should be configurable per organization
  const fromAddress = `noreply@${getDefaultDomain(account.region)}`;

  // Send email
  await sesClient.send(
    new SendEmailCommand({
      Source: org?.name ? `${org.name} <${fromAddress}>` : fromAddress,
      Destination: {
        ToAddresses: [contactEmail],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: "UTF-8",
        },
        Body: {
          Html: {
            Data: html,
            Charset: "UTF-8",
          },
          Text: {
            Data: text,
            Charset: "UTF-8",
          },
        },
      },
    })
  );

  return true;
}

function getDefaultDomain(_region: string): string {
  // TODO: Look up organization's verified domains
  // For now, fall back to wraps.dev for confirmation emails
  return process.env.DEFAULT_EMAIL_DOMAIN ?? "wraps.dev";
}
