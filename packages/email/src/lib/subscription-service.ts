/**
 * Subscription Confirmation Service
 *
 * Handles double opt-in logic for topic subscriptions.
 * Sends confirmation emails via the organization's AWS SES using the Wraps email SDK.
 */

import { ListEmailIdentitiesCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
import { WrapsEmail } from "@wraps.dev/email";
import { awsAccount, db, eq, organization, template, topicSettings } from "@wraps/db";
import { generateTopicConfirmationEmail } from "../emails/topic-confirmation";
import { generateConfirmationUrl } from "./confirmation-token";

/**
 * Substitute variables in template content.
 * Variables are in the format {{variableName}} or {{object.property}}
 */
function substituteVariables(
  content: string,
  variables: Record<string, string | undefined>
): string {
  return content.replace(
    /\{\{\s*([^}]+)\s*\}\}/g,
    (match, key) => variables[key.trim()] ?? match
  );
}

/**
 * Convert HTML to plain text for email fallback
 */
function stripHtmlForPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

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
 * using the @wraps.dev/email SDK
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

  console.log(
    `[CONFIRMATION_EMAIL] Starting for contact=${contactId} topic=${topicId} org=${organizationId}`
  );

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

  console.log(
    `[CONFIRMATION_EMAIL] Loaded org=${org?.name} account=${account?.id || "NONE"} settings=${settings?.organizationId || "NONE"}`
  );

  if (!account) {
    console.error(
      `[CONFIRMATION_EMAIL] No AWS account configured for org=${organizationId}`
    );
    throw new Error("Organization has no AWS account configured");
  }

  // Generate confirmation URL
  const confirmationUrl = await generateConfirmationUrl(
    contactId,
    organizationId,
    topicId
  );

  // Generate email content - use custom template if configured
  let subject: string;
  let html: string;
  let text: string;

  if (settings?.confirmationTemplateId) {
    // Load the custom confirmation template
    const [customTemplate] = await db
      .select({
        subject: template.subject,
        compiledHtml: template.compiledHtml,
        compiledText: template.compiledText,
      })
      .from(template)
      .where(eq(template.id, settings.confirmationTemplateId))
      .limit(1);

    if (customTemplate?.compiledHtml && customTemplate?.subject) {
      console.log(
        `[CONFIRMATION_EMAIL] Using custom template ${settings.confirmationTemplateId}`
      );

      // Define variables for substitution
      const variables: Record<string, string | undefined> = {
        confirmationUrl,
        "topic.name": topicName,
        "topic.description": topicDescription ?? undefined,
        "contact.email": contactEmail,
        "organization.name": org?.name ?? undefined,
      };

      subject = substituteVariables(customTemplate.subject, variables);
      html = substituteVariables(customTemplate.compiledHtml, variables);
      text = customTemplate.compiledText
        ? substituteVariables(customTemplate.compiledText, variables)
        : stripHtmlForPlainText(html);
    } else {
      console.log(
        `[CONFIRMATION_EMAIL] Custom template ${settings.confirmationTemplateId} not found or not compiled, using default`
      );
      const defaultEmail = generateTopicConfirmationEmail({
        url: confirmationUrl,
        topicName,
        topicDescription,
        organizationName: org?.name,
      });
      subject = defaultEmail.subject;
      html = defaultEmail.html;
      text = defaultEmail.text;
    }
  } else {
    // Use default confirmation email template
    const defaultEmail = generateTopicConfirmationEmail({
      url: confirmationUrl,
      topicName,
      topicDescription,
      organizationName: org?.name,
    });
    subject = defaultEmail.subject;
    html = defaultEmail.html;
    text = defaultEmail.text;
  }

  // Assume role to get SES credentials
  console.log(
    `[CONFIRMATION_EMAIL] Assuming role ${account.roleArn} in ${account.region}`
  );

  const stsClient = new STSClient({
    region: account.region,
  });

  let assumeRoleResponse;
  try {
    assumeRoleResponse = await stsClient.send(
      new AssumeRoleCommand({
        RoleArn: account.roleArn,
        RoleSessionName: `wraps-confirmation-${Date.now()}`,
        ExternalId: account.externalId,
        DurationSeconds: 900, // 15 minutes
      })
    );
  } catch (error) {
    console.error(`[CONFIRMATION_EMAIL] Failed to assume role:`, error);
    throw error;
  }

  if (!assumeRoleResponse.Credentials) {
    console.error(
      `[CONFIRMATION_EMAIL] No credentials returned from assume role`
    );
    throw new Error("Failed to assume AWS role");
  }

  console.log(`[CONFIRMATION_EMAIL] Role assumed successfully`);

  const credentials = {
    accessKeyId: assumeRoleResponse.Credentials.AccessKeyId!,
    secretAccessKey: assumeRoleResponse.Credentials.SecretAccessKey!,
    sessionToken: assumeRoleResponse.Credentials.SessionToken!,
  };

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
    // Need to list identities to auto-detect verified domain
    console.log(`[CONFIRMATION_EMAIL] Listing email identities`);
    const sesClient = new SESv2Client({
      region: account.region,
      credentials,
    });

    const identitiesResponse = await sesClient.send(
      new ListEmailIdentitiesCommand({
        PageSize: 100,
      })
    );
    console.log(
      `[CONFIRMATION_EMAIL] Found ${identitiesResponse.EmailIdentities?.length || 0} identities`
    );

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

  // Build from address with display name
  const from = fromName ? { name: fromName, email: fromAddress } : fromAddress;

  // Create Wraps email client with assumed credentials
  const wrapsEmail = new WrapsEmail({
    region: account.region,
    credentials,
  });

  console.log(
    `[CONFIRMATION_EMAIL] Sending email from=${fromName ? `${fromName} <${fromAddress}>` : fromAddress} to=${contactEmail}`
  );

  try {
    const result = await wrapsEmail.send({
      from,
      to: contactEmail,
      subject,
      html,
      text,
      replyTo: replyToAddress,
    });

    console.log(
      `[CONFIRMATION_EMAIL] Email sent successfully, messageId=${result.messageId}`
    );
    return true;
  } catch (error) {
    console.error(`[CONFIRMATION_EMAIL] Failed to send email:`, error);
    throw error;
  } finally {
    // Clean up the client
    wrapsEmail.destroy();
  }
}
