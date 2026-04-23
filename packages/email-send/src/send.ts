import { type SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

/**
 * The configuration set every Wraps send goes through. Owns event tracking
 * (opens, clicks, bounces, complaints) and feeds CloudWatch + EventBridge.
 */
export const WRAPS_CONFIGURATION_SET_NAME = "wraps-email-tracking";

export type EmailTag = {
  name: string;
  value: string;
};

export type SendEmailInput = {
  client: SESv2Client;
  /** Display address: either `email@example.com` or `Name <email@example.com>`. */
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  /**
   * Present for marketing mail. When set, RFC 8058 List-Unsubscribe and
   * List-Unsubscribe-Post headers are attached so Gmail/Yahoo render the
   * one-click unsubscribe affordance and don't penalize sender reputation.
   */
  marketing?: {
    unsubscribeUrl: string;
  };
  /** EmailTags forwarded to SES → EventBridge → analytics. */
  tags: readonly EmailTag[];
  /** Override the configuration set. Defaults to the Wraps tracking set. */
  configurationSetName?: string;
};

export type SendEmailOutput = {
  messageId: string;
};

/**
 * Send a single email through the canonical Wraps SES v2 pipeline.
 *
 * Use this from every send path (test sends, broadcasts, workflow steps) so
 * recipients get identical headers, configuration set, and tagging regardless
 * of how the send was initiated.
 *
 * Throws if SES returns no MessageId on a 2xx response. SES is contractually
 * required to return one; the SDK types it as optional only because the
 * upstream API definition does. Treating its absence as a failure is more
 * honest than substituting a fake identifier — a phantom MessageId would
 * silently break correlation with the open/click/bounce events that arrive
 * later through the configuration set.
 */
export async function sendEmail(
  input: SendEmailInput
): Promise<SendEmailOutput> {
  const headers = buildListUnsubscribeHeaders(input.marketing?.unsubscribeUrl);

  const response = await input.client.send(
    new SendEmailCommand({
      FromEmailAddress: input.from,
      ReplyToAddresses: input.replyTo ? [input.replyTo] : undefined,
      Destination: { ToAddresses: [input.to] },
      Content: {
        Simple: {
          Subject: { Data: input.subject },
          Body: {
            Html: { Data: input.html },
            Text: { Data: input.text },
          },
          Headers: headers.length > 0 ? headers : undefined,
        },
      },
      ConfigurationSetName:
        input.configurationSetName ?? WRAPS_CONFIGURATION_SET_NAME,
      EmailTags: input.tags.map((tag) => ({
        Name: tag.name,
        Value: tag.value,
      })),
    })
  );

  if (!response.MessageId) {
    throw new Error("SES SendEmail returned no MessageId");
  }

  return { messageId: response.MessageId };
}

function buildListUnsubscribeHeaders(
  unsubscribeUrl: string | undefined
): Array<{ Name: string; Value: string }> {
  if (!unsubscribeUrl) {
    return [];
  }
  return [
    { Name: "List-Unsubscribe", Value: `<${unsubscribeUrl}>` },
    { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
  ];
}
