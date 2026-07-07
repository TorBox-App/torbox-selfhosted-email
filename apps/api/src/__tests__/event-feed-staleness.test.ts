/**
 * Event Feed Staleness Worker Tests
 *
 * Covers the detection + flag lifecycle + alert-once semantics described in
 * plan 113: an account's SES event feed is "stale" when it's connected,
 * still sending mail, but no event has arrived in >6h. The worker flags it,
 * debounces one cycle, alerts the org owner exactly once per episode, and
 * clears the flags when events resume.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();

vi.mock("../lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  flushLogger: vi.fn().mockResolvedValue(undefined),
}));

const mockSendEventFeedStaleEmail = vi.fn().mockResolvedValue(undefined);
vi.mock("@wraps/email", () => ({
  sendEventFeedStaleEmail: (...args: unknown[]) =>
    mockSendEventFeedStaleEmail(...args),
}));

vi.mock("@wraps/db", async () => {
  const actual = await vi.importActual<typeof import("@wraps/db")>("@wraps/db");
  return {
    ...actual,
    db: {
      select: (...args: unknown[]) => mockDbSelect(...args),
      update: (...args: unknown[]) => mockDbUpdate(...args),
    },
  };
});

const { awsAccount, member, messageSend, organization } = await import(
  "@wraps/db"
);
const { handler } = await import("../workers/event-feed-staleness");

const NOW = new Date("2026-07-07T12:00:00.000Z");
const SEVEN_HOURS_AGO = new Date(NOW.getTime() - 7 * 60 * 60 * 1000);
const TWO_HOURS_AGO = new Date(NOW.getTime() - 2 * 60 * 60 * 1000);
const THIRTY_MIN_AGO = new Date(NOW.getTime() - 30 * 60 * 1000);

const BASE_ACCOUNT = {
  id: "aws-account-1",
  organizationId: "org-1",
  name: "Production",
  accountId: "123456789012",
  region: "us-east-1",
  lastEventReceivedAt: SEVEN_HOURS_AGO,
  eventFeedStaleSince: null as Date | null,
  eventFeedAlertedAt: null as Date | null,
};

const OWNER_ROW = { email: "owner@example.com" };
const ORG_ROW = { slug: "acme" };

/** Thenable chain builder: from()/innerJoin()/where()/limit() all return
 * itself, and awaiting the chain resolves to whatever result was set once
 * .from(table) matched a configured table -> rows mapping. */
function makeSelectDispatcher(resultsByTable: Map<unknown, unknown[]>) {
  return () => {
    let result: unknown[] = [];
    const chain: PromiseLike<unknown[]> & Record<string, unknown> = {
      from: vi.fn((table: unknown) => {
        result = resultsByTable.get(table) ?? [];
        return chain;
      }),
      innerJoin: vi.fn(() => chain),
      where: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      then: (<TResult1 = unknown[], TResult2 = never>(
        onFulfilled?:
          | ((value: unknown[]) => TResult1 | PromiseLike<TResult1>)
          | null,
        onRejected?:
          | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
          | null
      ) =>
        Promise.resolve(result).then(
          onFulfilled ?? undefined,
          onRejected ?? undefined
        )) as PromiseLike<unknown[]>["then"],
    };
    return chain;
  };
}

type UpdateCall = {
  table: unknown;
  set: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
};

function setupUpdateCapture(): UpdateCall[] {
  const calls: UpdateCall[] = [];
  mockDbUpdate.mockImplementation((table: unknown) => {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    calls.push({ table, set, where });
    return { set };
  });
  return calls;
}

/** Configure db.select to answer per-table with the given fixture rows. */
function setupSelects(opts: {
  connectedAccounts: (typeof BASE_ACCOUNT)[];
  recentSends?: boolean;
  ownerEmail?: string | null;
  orgSlug?: string | null;
}) {
  const resultsByTable = new Map<unknown, unknown[]>([
    [awsAccount, opts.connectedAccounts],
    [messageSend, opts.recentSends === false ? [] : [{ id: "send-1" }]],
    // getOrgOwnerEmail selects .from(member).innerJoin(user, ...) — the
    // dispatch key is the `.from()` table, i.e. `member`, not `user`.
    [
      member,
      opts.ownerEmail === null
        ? []
        : [{ email: opts.ownerEmail ?? OWNER_ROW.email }],
    ],
    [
      organization,
      opts.orgSlug === null ? [] : [{ slug: opts.orgSlug ?? ORG_ROW.slug }],
    ],
  ]);
  mockDbSelect.mockImplementation(makeSelectDispatcher(resultsByTable));
}

describe("event-feed-staleness worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Pin the clock to the fixture anchor. The worker under test compares
    // against `new Date()` at call time, so without this, fixtures anchored
    // to NOW (e.g. "5 min ago" / "fresh") silently age past the 6h staleness
    // threshold once the real wall clock drifts past NOW + 6h.
    vi.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("flags a connected account with recent sends and no events for >6h", async () => {
    setupSelects({
      connectedAccounts: [{ ...BASE_ACCOUNT }],
      recentSends: true,
    });
    const updateCalls = setupUpdateCapture();

    await handler({} as never, {} as never, {} as never);

    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].table).toBe(awsAccount);
    expect(updateCalls[0].set).toHaveBeenCalledWith(
      expect.objectContaining({ eventFeedStaleSince: expect.any(Date) })
    );
    expect(mockSendEventFeedStaleEmail).not.toHaveBeenCalled();
  });

  it("alerts the owner once when flagged for over an hour and not yet alerted", async () => {
    setupSelects({
      connectedAccounts: [
        {
          ...BASE_ACCOUNT,
          eventFeedStaleSince: TWO_HOURS_AGO,
          eventFeedAlertedAt: null,
        },
      ],
      recentSends: true,
      ownerEmail: OWNER_ROW.email,
      orgSlug: ORG_ROW.slug,
    });
    const updateCalls = setupUpdateCapture();

    await handler({} as never, {} as never, {} as never);

    expect(mockSendEventFeedStaleEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEventFeedStaleEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: OWNER_ROW.email,
        accountName: BASE_ACCOUNT.name,
        awsAccountNumber: BASE_ACCOUNT.accountId,
        region: BASE_ACCOUNT.region,
        orgSlug: ORG_ROW.slug,
        awsAccountId: BASE_ACCOUNT.id,
        staleSince: TWO_HOURS_AGO,
      })
    );

    const alertedUpdate = updateCalls.find((c) =>
      c.set.mock.calls.some(
        (args) => (args[0] as Record<string, unknown>).eventFeedAlertedAt
      )
    );
    expect(alertedUpdate).toBeDefined();
    expect(alertedUpdate?.set).toHaveBeenCalledWith(
      expect.objectContaining({ eventFeedAlertedAt: expect.any(Date) })
    );
  });

  it("does not send a second alert once eventFeedAlertedAt is already set", async () => {
    setupSelects({
      connectedAccounts: [
        {
          ...BASE_ACCOUNT,
          eventFeedStaleSince: TWO_HOURS_AGO,
          eventFeedAlertedAt: THIRTY_MIN_AGO,
        },
      ],
      recentSends: true,
      ownerEmail: OWNER_ROW.email,
      orgSlug: ORG_ROW.slug,
    });
    const updateCalls = setupUpdateCapture();

    await handler({} as never, {} as never, {} as never);

    expect(mockSendEventFeedStaleEmail).not.toHaveBeenCalled();
    expect(updateCalls).toHaveLength(0);
  });

  it("clears both columns once events resume", async () => {
    setupSelects({
      connectedAccounts: [
        {
          ...BASE_ACCOUNT,
          lastEventReceivedAt: new Date(NOW.getTime() - 5 * 60 * 1000), // 5 min ago — fresh
          eventFeedStaleSince: TWO_HOURS_AGO,
          eventFeedAlertedAt: THIRTY_MIN_AGO,
        },
      ],
      recentSends: true,
    });
    const updateCalls = setupUpdateCapture();

    await handler({} as never, {} as never, {} as never);

    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].table).toBe(awsAccount);
    expect(updateCalls[0].set).toHaveBeenCalledWith({
      eventFeedStaleSince: null,
      eventFeedAlertedAt: null,
    });
    expect(mockSendEventFeedStaleEmail).not.toHaveBeenCalled();
  });

  it("never flags an account with no recent sends (idle org, not a broken feed)", async () => {
    setupSelects({
      connectedAccounts: [{ ...BASE_ACCOUNT }],
      recentSends: false,
    });
    const updateCalls = setupUpdateCapture();

    await handler({} as never, {} as never, {} as never);

    expect(updateCalls).toHaveLength(0);
    expect(mockSendEventFeedStaleEmail).not.toHaveBeenCalled();
  });

  it("continues the sweep when one org's email send throws, and does not set eventFeedAlertedAt for it", async () => {
    mockSendEventFeedStaleEmail.mockRejectedValueOnce(new Error("SES down"));

    const throwingAccount = {
      ...BASE_ACCOUNT,
      id: "aws-account-throws",
      organizationId: "org-throws",
      eventFeedStaleSince: TWO_HOURS_AGO,
      eventFeedAlertedAt: null,
    };
    const nextAccount = {
      ...BASE_ACCOUNT,
      id: "aws-account-next",
      organizationId: "org-next",
      eventFeedStaleSince: null,
      eventFeedAlertedAt: null,
    };

    setupSelects({
      connectedAccounts: [throwingAccount, nextAccount],
      recentSends: true,
      ownerEmail: OWNER_ROW.email,
      orgSlug: ORG_ROW.slug,
    });
    const updateCalls = setupUpdateCapture();

    await handler({} as never, {} as never, {} as never);

    // The throwing account's alert was attempted but never marked alerted.
    const throwingAccountUpdates = updateCalls.filter((c) =>
      c.set.mock.calls.some(
        (args) => (args[0] as Record<string, unknown>).eventFeedAlertedAt
      )
    );
    expect(throwingAccountUpdates).toHaveLength(0);

    // The sweep continued: the next account still got flagged.
    const staleSinceUpdates = updateCalls.filter((c) =>
      c.set.mock.calls.some(
        (args) => (args[0] as Record<string, unknown>).eventFeedStaleSince
      )
    );
    expect(staleSinceUpdates.length).toBeGreaterThanOrEqual(1);
  });
});
