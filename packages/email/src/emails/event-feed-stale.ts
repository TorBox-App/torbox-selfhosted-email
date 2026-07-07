import { getWrapsClient } from "../lib/client";

export type EventFeedStaleContent = {
  accountName: string;
  awsAccountNumber: string;
  region: string;
  orgSlug: string;
  awsAccountId: string;
  staleSince: Date;
};

export type SendEventFeedStaleEmailParams = EventFeedStaleContent & {
  to: string;
};

function formatTimestamp(date: Date): string {
  return `${date.toISOString().replace("T", " ").slice(0, 16)} UTC`;
}

/**
 * Build the subject/html/text for the event-feed-stale alert.
 * Pure content builder — no network calls — so it's testable without SES.
 */
export function buildEventFeedStaleEmail({
  accountName,
  awsAccountNumber,
  region,
  orgSlug,
  awsAccountId,
  staleSince,
}: EventFeedStaleContent): { subject: string; html: string; text: string } {
  const settingsUrl = `https://app.wraps.dev/${orgSlug}/settings/aws-accounts/${awsAccountId}`;
  const since = formatTimestamp(staleSince);

  const subject = `SES event feed stalled for ${accountName} (${awsAccountNumber})`;

  const text = [
    `Your AWS account "${accountName}" (${awsAccountNumber}, ${region}) is still sending email, but no delivery events have arrived since ${since}.`,
    "",
    "Impact: the email timeline and analytics for this account are frozen, and bounce/complaint handling is blind until the feed recovers.",
    "",
    "To fix this, run `wraps email doctor` or visit your account settings:",
    settingsUrl,
  ].join("\n");

  const html = [
    `<p>Your AWS account <strong>${accountName}</strong> (${awsAccountNumber}, ${region}) is still sending email, but no delivery events have arrived since <strong>${since}</strong>.</p>`,
    "<p>Impact: the email timeline and analytics for this account are frozen, and bounce/complaint handling is blind until the feed recovers.</p>",
    `<p>To fix this, run <code>wraps email doctor</code> or visit your <a href="${settingsUrl}">account settings</a>.</p>`,
  ].join("\n");

  return { subject, html, text };
}

export async function sendEventFeedStaleEmail({
  to,
  ...content
}: SendEventFeedStaleEmailParams) {
  const { subject, html, text } = buildEventFeedStaleEmail(content);
  const wraps = await getWrapsClient();

  return wraps.send({
    from: process.env.EMAIL_FROM || "Wraps <hello@wraps.dev>",
    to,
    subject,
    html,
    text,
  });
}
