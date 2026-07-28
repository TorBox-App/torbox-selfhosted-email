/**
 * Event Feed Staleness Worker — detection against a real DB
 *
 * The mocked sibling (event-feed-staleness.test.ts) stubs the send probe, so
 * it can only prove the worker reacts correctly to an answer it is handed —
 * not that the query asks the right question. The regression this file exists
 * for lived entirely in the predicate: pairing "sent in the last 24h" with
 * "no event in the last 6h" flagged healthy accounts that send in daily
 * batches, because those two windows disagree for any sender slower than one
 * message every 6 hours. Only real rows can catch that.
 *
 * File suffix `-db.test.ts` = real Neon test branch (no DB mocks). Email is
 * mocked at the @wraps/email boundary.
 */

import { awsAccount, db, messageSend, notification } from "@wraps/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanupBaseOrg,
  messageSendRow,
  seedBaseOrg,
} from "../(ee)/__tests__/fixtures/real-db";

vi.mock("../lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  flushLogger: vi.fn().mockResolvedValue(undefined),
}));

const mockSendEventFeedStaleEmail = vi.fn().mockResolvedValue(undefined);
vi.mock("@wraps/email", () => ({
  sendEventFeedStaleEmail: (...args: unknown[]) =>
    mockSendEventFeedStaleEmail(...args),
}));

const { handler } = await import("../workers/event-feed-staleness");

const PREFIX = `feed-stale-db-${crypto.randomUUID().slice(0, 8)}`;

const fixture = await seedBaseOrg(PREFIX);
const { ids } = fixture;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

function ago(ms: number): Date {
  return new Date(Date.now() - ms);
}

/** Seed one send for the primary org's AWS account at the given time. */
async function seedSend(sentAt: Date, label: string): Promise<void> {
  await db.insert(messageSend).values(
    messageSendRow(ids, {
      id: `${PREFIX}-${label}`,
      messageId: `${PREFIX}-${label}-ses-id`,
      sentAt,
      createdAt: sentAt,
    })
  );
}

/** Put the account's three feed columns into a known state. */
async function setFeedState(state: {
  lastEventReceivedAt: Date | null;
  eventFeedStaleSince?: Date | null;
  eventFeedAlertedAt?: Date | null;
}): Promise<void> {
  await db
    .update(awsAccount)
    .set({
      lastEventReceivedAt: state.lastEventReceivedAt,
      eventFeedStaleSince: state.eventFeedStaleSince ?? null,
      eventFeedAlertedAt: state.eventFeedAlertedAt ?? null,
    })
    .where(eq(awsAccount.id, ids.awsAccount));
}

async function readFeedState() {
  const [row] = await db
    .select({
      lastEventReceivedAt: awsAccount.lastEventReceivedAt,
      eventFeedStaleSince: awsAccount.eventFeedStaleSince,
      eventFeedAlertedAt: awsAccount.eventFeedAlertedAt,
    })
    .from(awsAccount)
    .where(eq(awsAccount.id, ids.awsAccount));
  return row;
}

async function runSweep(): Promise<void> {
  await handler({} as never, {} as never, {} as never);
}

beforeEach(async () => {
  vi.clearAllMocks();
  await db.delete(messageSend).where(eq(messageSend.organizationId, ids.org));
  await db.delete(notification).where(eq(notification.organizationId, ids.org));
  // The fixture's second account also carries a webhook secret, so the sweep
  // would pick it up too. Drop it so this file only exercises its own account.
  await db
    .update(awsAccount)
    .set({ webhookSecret: null })
    .where(eq(awsAccount.id, ids.otherAwsAccount));
});

afterAll(async () => {
  await db.delete(notification).where(eq(notification.organizationId, ids.org));
  await cleanupBaseOrg(PREFIX);
});

describe("event-feed-staleness detection (real DB)", () => {
  it("leaves an infrequent sender alone when every send was acknowledged", async () => {
    // The regression case: one batch a day, each acknowledged seconds later.
    // The last event is 20h old — well past the old 6h threshold — but no send
    // is waiting on anything, so the feed is healthy.
    await seedSend(ago(20 * HOUR), "daily-batch");
    await setFeedState({
      lastEventReceivedAt: new Date(Date.now() - 20 * HOUR + 2000),
    });

    await runSweep();

    expect((await readFeedState())?.eventFeedStaleSince).toBeNull();
    expect(mockSendEventFeedStaleEmail).not.toHaveBeenCalled();
  });

  it("flags an account whose sends have never been acknowledged", async () => {
    await seedSend(ago(3 * HOUR), "unacked-old");
    await seedSend(ago(45 * MINUTE), "unacked-recent");
    await setFeedState({ lastEventReceivedAt: null });

    await runSweep();

    expect((await readFeedState())?.eventFeedStaleSince).toBeInstanceOf(Date);
  });

  it("flags a feed that stops mid-stream, with events trailing the sends", async () => {
    // Events flowed until 4h ago; sends kept going after that.
    await seedSend(ago(5 * HOUR), "acked");
    await seedSend(ago(2 * HOUR), "orphaned");
    await setFeedState({ lastEventReceivedAt: ago(4 * HOUR) });

    await runSweep();

    expect((await readFeedState())?.eventFeedStaleSince).toBeInstanceOf(Date);
  });

  it("holds off on a send still inside the grace period", async () => {
    await seedSend(ago(5 * MINUTE), "just-sent");
    await setFeedState({ lastEventReceivedAt: null });

    await runSweep();

    expect((await readFeedState())?.eventFeedStaleSince).toBeNull();
  });

  it("ignores sends older than the 24h lookback window", async () => {
    await seedSend(ago(30 * HOUR), "ancient");
    await setFeedState({ lastEventReceivedAt: null });

    await runSweep();

    expect((await readFeedState())?.eventFeedStaleSince).toBeNull();
  });

  it("ignores SMS sends, which the SES cursor never acknowledges", async () => {
    // lastEventReceivedAt only moves for SES email events. An SMS send has no
    // business making the email feed look broken.
    await db.insert(messageSend).values(
      messageSendRow(ids, {
        id: `${PREFIX}-sms`,
        messageId: `${PREFIX}-sms-ses-id`,
        channel: "sms",
        recipient: "+15555550123",
        sentAt: ago(3 * HOUR),
        createdAt: ago(3 * HOUR),
      })
    );
    await setFeedState({ lastEventReceivedAt: null });

    await runSweep();

    expect((await readFeedState())?.eventFeedStaleSince).toBeNull();
  });

  it("never flags an idle account with no sends at all", async () => {
    await setFeedState({ lastEventReceivedAt: ago(20 * HOUR) });

    await runSweep();

    expect((await readFeedState())?.eventFeedStaleSince).toBeNull();
  });

  it("clears the flags once an event arrives after the episode began", async () => {
    await seedSend(ago(3 * HOUR), "recovered-send");
    await setFeedState({
      lastEventReceivedAt: ago(10 * MINUTE),
      eventFeedStaleSince: ago(2 * HOUR),
      eventFeedAlertedAt: ago(30 * MINUTE),
    });

    await runSweep();

    const state = await readFeedState();
    expect(state?.eventFeedStaleSince).toBeNull();
    expect(state?.eventFeedAlertedAt).toBeNull();
  });

  it("keeps the flags when sends stop without the feed coming back", async () => {
    // No sends in the window, so nothing is waiting on an event — but the last
    // event still predates the flag, so the feed never proved it recovered.
    await setFeedState({
      lastEventReceivedAt: ago(6 * HOUR),
      eventFeedStaleSince: ago(2 * HOUR),
      eventFeedAlertedAt: ago(30 * MINUTE),
    });

    await runSweep();

    const state = await readFeedState();
    expect(state?.eventFeedStaleSince).toBeInstanceOf(Date);
    expect(state?.eventFeedAlertedAt).toBeInstanceOf(Date);
  });

  it("alerts the org owner once the flag has aged past the debounce", async () => {
    await seedSend(ago(3 * HOUR), "alerting-send");
    await setFeedState({
      lastEventReceivedAt: null,
      eventFeedStaleSince: ago(2 * HOUR),
    });

    await runSweep();

    expect(mockSendEventFeedStaleEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEventFeedStaleEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: `${PREFIX}@example.com`,
        awsAccountNumber: fixture.accountNumber,
        orgSlug: `${PREFIX}-org`,
      })
    );
    expect((await readFeedState())?.eventFeedAlertedAt).toBeInstanceOf(Date);

    const inbox = await db
      .select({ type: notification.type })
      .from(notification)
      .where(eq(notification.organizationId, ids.org));
    expect(inbox.map((n) => n.type)).toContain("events.feed_stale");
  });

  it("does not re-alert an account already alerted in this episode", async () => {
    await seedSend(ago(3 * HOUR), "already-alerted-send");
    await setFeedState({
      lastEventReceivedAt: null,
      eventFeedStaleSince: ago(2 * HOUR),
      eventFeedAlertedAt: ago(30 * MINUTE),
    });

    await runSweep();

    expect(mockSendEventFeedStaleEmail).not.toHaveBeenCalled();
  });
});
