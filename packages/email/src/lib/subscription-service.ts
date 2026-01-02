/**
 * Subscription Confirmation Service
 *
 * Handles double opt-in logic for topic subscriptions.
 * Sends confirmation emails via the organization's AWS SES.
 */

import {
  ListEmailIdentitiesCommand,
  SESv2Client,
  SendEmailCommand,
} from "@aws-sdk/client-sesv2";
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
import { awsAccount, db, eq, organization, topicSettings } from "@wraps/db";
import { generateTopicConfirmationEmail } from "../emails/topic-confirmation";
import { generateConfirmationUrl } from "./confirmation-token";

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
export async function sendTopicConfirmationEmail(
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

  // Get organization name, AWS account, and topic settings in parallel
  const [[org], [account], [settings]] = await Promise.all([
    db
      .select({
        name: organization.name,
      })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1),
    db
      .select({
        id: awsAccount.id,
        roleArn: awsAccount.roleArn,
        externalId: awsAccount.externalId,
        region: awsAccount.region,
      })
      .from(awsAccount)
      .where(eq(awsAccount.organizationId, organizationId))
      .limit(1),
    db
      .select()
      .from(topicSettings)
      .where(eq(topicSettings.organizationId, organizationId))
      .limit(1),
  ]);

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

  // Create SES v2 client with assumed credentials
  const sesClient = new SESv2Client({
    region: account.region,
    credentials: {
      accessKeyId: assumeRoleResponse.Credentials.AccessKeyId!,
      secretAccessKey: assumeRoleResponse.Credentials.SecretAccessKey!,
      sessionToken: assumeRoleResponse.Credentials.SessionToken!,
    },
  });

  // Get verified email identities from the organization's SES
  const identitiesResponse = await sesClient.send(
    new ListEmailIdentitiesCommand({
      PageSize: 100,
    })
  );

  // Determine from address - use custom settings if configured, otherwise auto-detect
  let fromAddress: string;
  let fromName: string | undefined;
  let replyToAddress: string | undefined;

  if (settings?.confirmationFromEmail) {
    // Use custom from email from settings
    fromAddress = settings.confirmationFromEmail;
    fromName = settings.confirmationFromName || org?.name;
    replyToAddress = settings.confirmationReplyToEmail || undefined;
  } else {
    // Fall back to auto-detected verified domain
    const verifiedDomain = identitiesResponse.EmailIdentities?.find(
      (identity) =>
        identity.IdentityType === "DOMAIN" && identity.SendingEnabled === true
    );

    if (!verifiedDomain?.IdentityName) {
      throw new Error(
        "No verified sending domain found. Please configure a from email in Topics settings or verify a domain in your AWS SES account."
      );
    }

    fromAddress = `noreply@${verifiedDomain.IdentityName}`;
    fromName = org?.name;
  }

  // Build the formatted from address
  const formattedFromAddress = fromName
    ? `${fromName} <${fromAddress}>`
    : fromAddress;

  // Send email using SES v2
  await sesClient.send(
    new SendEmailCommand({
      FromEmailAddress: formattedFromAddress,
      ReplyToAddresses: replyToAddress ? [replyToAddress] : undefined,
      Destination: {
        ToAddresses: [contactEmail],
      },
      Content: {
        Simple: {
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
      },
    })
  );

  return true;
}
