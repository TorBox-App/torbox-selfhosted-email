/**
 * Bug reproduction: sentAt overwritten by engagement event timestamps
 *
 * When an "open" event arrives for an email sent on March 12, the dashboard
 * showed "Sent" as today's date instead of March 12. This happened because
 * the Lambda stored sentAt = eventTimestamp (event-specific time) as the
 * DynamoDB sort key. The fix adds mailSentAt (the original mail.timestamp)
 * to every record, and the dashboard uses mailSentAt for display.
 */

import { describe, expect, it } from "vitest";
import {
  aggregateEmailEvents,
  findIncompleteMessageIds,
} from "../email-aggregation";

const MARCH_12 = new Date("2026-03-12T10:00:00Z").getTime();
const TODAY = new Date("2026-04-09T14:30:00Z").getTime();

function createEvent(overrides: {
  messageId?: string;
  sentAt: number;
  mailSentAt?: number;
  eventType: string;
  createdAt?: number;
  additionalData?: string;
}) {
  return {
    messageId: overrides.messageId ?? "msg-march-12",
    sentAt: overrides.sentAt,
    mailSentAt: overrides.mailSentAt,
    accountId: "acc-1",
    from: "noreply@example.com",
    to: ["user@example.com"],
    subject: "Welcome to our platform",
    eventType: overrides.eventType,
    eventData: "{}",
    additionalData: overrides.additionalData,
    createdAt: overrides.createdAt ?? overrides.sentAt,
    expiresAt: 9_999_999_999,
  };
}

describe("sentAt displays original mail send time, not event time", () => {
  it("uses mailSentAt when both Send and Open events are present", () => {
    const events = [
      createEvent({
        sentAt: MARCH_12,
        mailSentAt: MARCH_12,
        eventType: "Send",
      }),
      createEvent({
        sentAt: TODAY,
        mailSentAt: MARCH_12,
        eventType: "Open",
        createdAt: TODAY,
      }),
    ];

    const result = aggregateEmailEvents([events]);

    expect(result).toHaveLength(1);
    expect(result[0].sentAt).toBe(MARCH_12);
    expect(result[0].status).toBe("opened");
  });

  it("uses mailSentAt when only Open event is in query window", () => {
    // The real-world scenario: Send event (March 12) is outside
    // the 7-day query window, only the Open event (today) is returned.
    // With mailSentAt, we still know the original send time.
    const eventsInQueryWindow = [
      createEvent({
        sentAt: TODAY,
        mailSentAt: MARCH_12,
        eventType: "Open",
        createdAt: TODAY,
      }),
    ];

    const result = aggregateEmailEvents([eventsInQueryWindow]);

    expect(result).toHaveLength(1);
    expect(result[0].sentAt).toBe(MARCH_12);
  });

  it("falls back to sentAt for old records without mailSentAt", () => {
    // Backward compatibility: records written before the fix
    // don't have mailSentAt, so sentAt is used as-is.
    const events = [
      createEvent({
        sentAt: MARCH_12,
        eventType: "Send",
      }),
    ];

    const result = aggregateEmailEvents([events]);

    expect(result).toHaveLength(1);
    expect(result[0].sentAt).toBe(MARCH_12);
  });

  it("picks earliest mailSentAt across multiple events", () => {
    const events = [
      createEvent({
        sentAt: TODAY,
        mailSentAt: MARCH_12,
        eventType: "Open",
        createdAt: TODAY,
      }),
      createEvent({
        sentAt: TODAY + 1000,
        mailSentAt: MARCH_12,
        eventType: "Click",
        createdAt: TODAY + 1000,
      }),
    ];

    const result = aggregateEmailEvents([events]);

    expect(result).toHaveLength(1);
    expect(result[0].sentAt).toBe(MARCH_12);
    expect(result[0].eventCount).toBe(2);
  });
});

describe("findIncompleteMessageIds", () => {
  it("identifies messageIds missing a Send event", () => {
    const events = [
      [
        createEvent({
          messageId: "msg-complete",
          sentAt: MARCH_12,
          mailSentAt: MARCH_12,
          eventType: "Send",
        }),
        createEvent({
          messageId: "msg-complete",
          sentAt: TODAY,
          mailSentAt: MARCH_12,
          eventType: "Open",
        }),
      ],
      [
        createEvent({
          messageId: "msg-incomplete",
          sentAt: TODAY,
          mailSentAt: MARCH_12,
          eventType: "Open",
        }),
      ],
    ];

    const incomplete = findIncompleteMessageIds(events);
    expect(incomplete.size).toBe(1);
    expect(incomplete.get("msg-incomplete")).toBe("acc-1");
  });

  it("returns empty map when all messages have Send events", () => {
    const events = [
      [
        createEvent({
          sentAt: MARCH_12,
          eventType: "Send",
        }),
        createEvent({
          sentAt: TODAY,
          eventType: "Open",
        }),
      ],
    ];

    const incomplete = findIncompleteMessageIds(events);
    expect(incomplete.size).toBe(0);
  });
});

describe("backfill + re-aggregate produces correct sentAt and eventCount", () => {
  it("shows correct sentAt and eventCount after merging backfilled events", () => {
    // Scenario: 7-day query window returns only the Open event
    const timeWindowEvents = [
      [
        createEvent({
          sentAt: TODAY,
          mailSentAt: undefined, // old event without mailSentAt
          eventType: "Open",
          createdAt: TODAY,
        }),
      ],
    ];

    // Without backfill: sentAt falls back to open time, only 1 event visible
    const withoutBackfill = aggregateEmailEvents(timeWindowEvents);
    expect(withoutBackfill[0].sentAt).toBe(TODAY);
    expect(withoutBackfill[0].eventCount).toBe(1);

    // Simulate backfill: query by messageId returns all events for the message
    const backfilledEvents = [
      createEvent({
        sentAt: MARCH_12,
        mailSentAt: MARCH_12,
        eventType: "Send",
      }),
      createEvent({
        sentAt: MARCH_12 + 5000,
        mailSentAt: MARCH_12,
        eventType: "Delivery",
      }),
      createEvent({
        sentAt: TODAY,
        mailSentAt: MARCH_12,
        eventType: "Open",
        createdAt: TODAY,
      }),
    ];

    // After merging backfilled events, sentAt and eventCount are correct
    const withBackfill = aggregateEmailEvents([
      ...timeWindowEvents,
      backfilledEvents,
    ]);

    expect(withBackfill[0].sentAt).toBe(MARCH_12);
    expect(withBackfill[0].eventCount).toBe(3);
    expect(withBackfill[0].status).toBe("opened");
  });
});

describe("route backfill flow: TTL-expired Send event + no mailSentAt + no PG record", () => {
  /**
   * Full reproduction of the production bug:
   *
   * 1. Email sent March 12 via old Lambda (no mailSentAt on any event).
   * 2. DynamoDB Send/Delivery events are TTL-expired (28+ days old).
   * 3. User opens the email on April 9. Open event written with sentAt=April 9,
   *    mailSentAt=undefined (old Lambda, not yet redeployed).
   * 4. Dashboard queries last 7 days → only the Open event is returned.
   * 5. findIncompleteMessageIds correctly detects the missing Send.
   * 6. Backfill query by messageId returns ONLY the Open event (Send is TTL'd).
   * 7. After re-aggregating, sentAt is still April 9 — the bug.
   * 8. PostgreSQL fallback does NOT help because this email was sent directly via
   *    SES (not through the Wraps SDK), so there is no messageSend record.
   */
  it("sentAt falls back to event time when Send is TTL-expired, no mailSentAt, no PG record", () => {
    // Known limitation: when all three recovery mechanisms fail, sentAt
    // is the Open event's timestamp. Fix requires redeploying the Lambda
    // (which adds mailSentAt to every event).
    const allEvents = [
      [
        createEvent({
          sentAt: TODAY,
          mailSentAt: undefined,
          eventType: "Open",
          createdAt: TODAY,
        }),
      ],
    ];

    const incomplete = findIncompleteMessageIds(allEvents);
    expect(incomplete.size).toBe(1);
    expect(incomplete.has("msg-march-12")).toBe(true);

    // Backfill returns ONLY the Open event — Send is TTL-expired
    allEvents.push([
      createEvent({
        sentAt: TODAY,
        mailSentAt: undefined,
        eventType: "Open",
        createdAt: TODAY,
      }),
    ]);

    const emails = aggregateEmailEvents(allEvents);
    expect(emails).toHaveLength(1);

    // No PG record (email sent directly via SES, not through Wraps SDK)
    const pgSentAt = new Map<string, number>();
    for (const email of emails) {
      const authoritative = pgSentAt.get(email.messageId);
      if (authoritative && authoritative < email.sentAt) {
        email.sentAt = authoritative;
      }
    }

    // Known limitation: sentAt is the Open event time, not the original send time
    expect(emails[0].sentAt).toBe(TODAY);
  });

  it("PG fallback fixes sentAt when messageSend record exists but backfill has no Send", () => {
    // Same scenario as above but this user DID send via Wraps SDK, so PG has a record.
    // The PG fallback at route.ts lines 138-168 should fix sentAt.
    const allEvents = [
      [
        createEvent({
          sentAt: TODAY,
          mailSentAt: undefined,
          eventType: "Open",
          createdAt: TODAY,
        }),
      ],
    ];

    // Backfill only finds the Open event (Send is TTL-expired)
    allEvents.push([
      createEvent({
        sentAt: TODAY,
        mailSentAt: undefined,
        eventType: "Open",
        createdAt: TODAY,
      }),
    ]);

    const emails = aggregateEmailEvents(allEvents);
    expect(emails[0].sentAt).toBe(TODAY); // still wrong before PG fallback

    // Simulate PG fallback — messageSend record exists with correct sentAt
    const pgSentAt = new Map<string, number>([["msg-march-12", MARCH_12]]);

    for (const email of emails) {
      const authoritative = pgSentAt.get(email.messageId);
      if (authoritative && authoritative < email.sentAt) {
        email.sentAt = authoritative;
      }
    }

    // PG fallback should fix it
    expect(emails[0].sentAt).toBe(MARCH_12);
  });

  it("backfill deduplicates the Open event and eventCount stays correct", () => {
    // When backfill returns the same Open event that was in the window,
    // eventTypes Set deduplicates it — eventCount should still be 1, not 2.
    const allEvents = [
      [
        createEvent({
          sentAt: TODAY,
          mailSentAt: undefined,
          eventType: "Open",
          createdAt: TODAY,
        }),
      ],
    ];

    // Backfill returns same Open event again (Send is TTL-expired)
    allEvents.push([
      createEvent({
        sentAt: TODAY,
        mailSentAt: undefined,
        eventType: "Open",
        createdAt: TODAY,
      }),
    ]);

    const emails = aggregateEmailEvents(allEvents);

    expect(emails[0].eventCount).toBe(1);
    // Without mailSentAt or a Send event, sentAt stays as the Open event time
    expect(emails[0].sentAt).toBe(TODAY);
  });
});
