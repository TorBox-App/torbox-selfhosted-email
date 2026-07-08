/**
 * Event Feed Staleness Worker
 *
 * Scheduled Lambda that detects SES event feeds that have gone silent while
 * the account is still sending mail, flags them on aws_account, and emails
 * the org owner once per staleness episode. Runs hourly in production.
 *
 * Ground truth: aws_account.last_event_received_at is bumped by the SES
 * webhook route every time an authenticated event arrives for an account.
 * See apps/api/src/routes/webhooks.ts.
 *
 * Detection (per connected account):
 *   1. Candidate: webhookSecret IS NOT NULL (account claims to be connected).
 *   2. hasRecentSends: a message_send row with sentAt in the last 24h.
 *   3. feedStale: lastEventReceivedAt IS NULL, or older than 6h.
 *      (An idle org with no recent sends is never flagged — silence is
 *      expected when nothing is being sent.)
 *
 * Transitions:
 *   - stale && eventFeedStaleSince IS NULL -> set eventFeedStaleSince = now.
 *   - stale && staleSince set >1h ago (debounce one cycle) && not yet
 *     alerted -> email the org owner, then set eventFeedAlertedAt. The
 *     timestamp is only set after a successful send so one org's email
 *     failure doesn't suppress next hour's retry.
 *   - !stale && eventFeedStaleSince set -> clear both columns (recovered).
 *
 * Email credentials: infra/cron.ts sets WRAPS_EMAIL_ROLE_ARN to the dogfood
 * account's wraps-email-role (where wraps.dev is SES-verified) and grants
 * this function sts:AssumeRole on it; getWrapsClient() assumes that role
 * from the execution-role credentials. If the assume ever fails (e.g. trust
 * policy drift), the send throws, eventFeedAlertedAt stays unset, and the
 * sweep degrades to detection + flag + dashboard banner — retrying hourly.
 */

import {
  awsAccount,
  db,
  member,
  messageSend,
  notifyOrg,
  organization,
  user,
} from "@wraps/db";
import { sendEventFeedStaleEmail } from "@wraps/email";
import type { Handler } from "aws-lambda";
import { and, eq, gt, isNotNull } from "drizzle-orm";
import { flushLogger, log } from "../lib/logger";

const RECENT_SEND_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h
const STALE_EVENT_THRESHOLD_MS = 6 * 60 * 60 * 1000; // 6h
const ALERT_DEBOUNCE_MS = 60 * 60 * 1000; // 1h

/** Look up the org owner's email. Returns null if not found. */
async function getOrgOwnerEmail(
  organizationId: string
): Promise<string | null> {
  const [row] = await db
    .select({ email: user.email })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(
      and(eq(member.organizationId, organizationId), eq(member.role, "owner"))
    )
    .limit(1);
  return row?.email ?? null;
}

async function hasRecentSends(
  organizationId: string,
  awsAccountId: string,
  now: Date
): Promise<boolean> {
  const cutoff = new Date(now.getTime() - RECENT_SEND_WINDOW_MS);
  const [row] = await db
    .select({ id: messageSend.id })
    .from(messageSend)
    .where(
      and(
        eq(messageSend.organizationId, organizationId),
        eq(messageSend.awsAccountId, awsAccountId),
        gt(messageSend.sentAt, cutoff)
      )
    )
    .limit(1);
  return row !== undefined;
}

async function clearStaleFlags(accountId: string): Promise<void> {
  await db
    .update(awsAccount)
    .set({ eventFeedStaleSince: null, eventFeedAlertedAt: null })
    .where(eq(awsAccount.id, accountId));
}

async function markStaleSince(accountId: string, now: Date): Promise<void> {
  await db
    .update(awsAccount)
    .set({ eventFeedStaleSince: now })
    .where(eq(awsAccount.id, accountId));
}

async function markAlerted(accountId: string, now: Date): Promise<void> {
  await db
    .update(awsAccount)
    .set({ eventFeedAlertedAt: now })
    .where(eq(awsAccount.id, accountId));
}

/** Look up the org's slug for building the settings-page link. */
async function getOrgSlug(organizationId: string): Promise<string | null> {
  const [row] = await db
    .select({ slug: organization.slug })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);
  return row?.slug ?? null;
}

async function alertOwner(account: {
  id: string;
  organizationId: string;
  name: string;
  accountId: string;
  region: string;
  eventFeedStaleSince: Date;
}): Promise<void> {
  const now = new Date();

  try {
    const [ownerEmail, orgSlug] = await Promise.all([
      getOrgOwnerEmail(account.organizationId),
      getOrgSlug(account.organizationId),
    ]);

    if (!(ownerEmail && orgSlug)) {
      log.warn(
        "[event-feed-staleness] Missing owner email or org slug, skipping alert",
        {
          accountId: account.id,
          organizationId: account.organizationId,
          hasOwnerEmail: !!ownerEmail,
          hasOrgSlug: !!orgSlug,
        }
      );
      return;
    }

    await sendEventFeedStaleEmail({
      to: ownerEmail,
      accountName: account.name,
      awsAccountNumber: account.accountId,
      region: account.region,
      orgSlug,
      awsAccountId: account.id,
      staleSince: account.eventFeedStaleSince,
    });

    try {
      await notifyOrg({
        organizationId: account.organizationId,
        roles: ["owner", "admin"],
        type: "events.feed_stale",
        title: `Event feed stale for ${account.name}`,
        body: `No SES events have arrived from AWS account ${account.accountId} (${account.region}) since ${account.eventFeedStaleSince.toISOString()} while mail is still being sent. Delivery, bounce, and complaint tracking are blind until this is fixed.`,
        href: `/${orgSlug}/settings/aws-accounts/${account.id}`,
        data: { awsAccountId: account.id, region: account.region },
      });
    } catch (notifyError) {
      log.error(
        "[event-feed-staleness] Failed to write inbox notification",
        notifyError,
        { accountId: account.id, organizationId: account.organizationId }
      );
    }

    // Set the timestamp only after a successful send.
    await markAlerted(account.id, now);

    log.info("[event-feed-staleness] Alerted org owner", {
      accountId: account.id,
      organizationId: account.organizationId,
    });
  } catch (error) {
    // One org's email failure must not abort the sweep. eventFeedAlertedAt
    // stays unset so the next hourly run retries the send.
    log.error("[event-feed-staleness] Failed to alert org owner", error, {
      accountId: account.id,
      organizationId: account.organizationId,
    });
  }
}

export const handler: Handler = async () => {
  log.info("[event-feed-staleness] Starting sweep");

  const now = new Date();
  const staleEventCutoff = new Date(now.getTime() - STALE_EVENT_THRESHOLD_MS);
  const debounceCutoff = new Date(now.getTime() - ALERT_DEBOUNCE_MS);

  const connectedAccounts = await db
    .select({
      id: awsAccount.id,
      organizationId: awsAccount.organizationId,
      name: awsAccount.name,
      accountId: awsAccount.accountId,
      region: awsAccount.region,
      lastEventReceivedAt: awsAccount.lastEventReceivedAt,
      eventFeedStaleSince: awsAccount.eventFeedStaleSince,
      eventFeedAlertedAt: awsAccount.eventFeedAlertedAt,
    })
    .from(awsAccount)
    .where(isNotNull(awsAccount.webhookSecret));

  let flaggedCount = 0;
  let alertedCount = 0;
  let recoveredCount = 0;

  for (const account of connectedAccounts) {
    const recentSends = await hasRecentSends(
      account.organizationId,
      account.id,
      now
    );

    if (!recentSends) {
      // Idle org — no recent sends means silence is expected, not broken.
      // If a prior episode was flagged (e.g. sends just stopped), leave it;
      // recovery is only declared when events resume, not when sends stop.
      continue;
    }

    const feedStale =
      account.lastEventReceivedAt === null ||
      account.lastEventReceivedAt < staleEventCutoff;

    if (feedStale) {
      if (account.eventFeedStaleSince === null) {
        await markStaleSince(account.id, now);
        flaggedCount++;
        log.info("[event-feed-staleness] Flagged feed as stale", {
          accountId: account.id,
          organizationId: account.organizationId,
        });
        continue;
      }

      const debounced = account.eventFeedStaleSince < debounceCutoff;
      if (debounced && account.eventFeedAlertedAt === null) {
        await alertOwner({
          id: account.id,
          organizationId: account.organizationId,
          name: account.name,
          accountId: account.accountId,
          region: account.region,
          eventFeedStaleSince: account.eventFeedStaleSince,
        });
        alertedCount++;
      }
    } else if (account.eventFeedStaleSince !== null) {
      await clearStaleFlags(account.id);
      recoveredCount++;
      log.info("[event-feed-staleness] Event feed recovered", {
        accountId: account.id,
        organizationId: account.organizationId,
      });
    }
  }

  log.info("[event-feed-staleness] Sweep complete", {
    accountsChecked: connectedAccounts.length,
    flaggedCount,
    alertedCount,
    recoveredCount,
  });
  await flushLogger();
};
