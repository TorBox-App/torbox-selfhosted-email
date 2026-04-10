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
import { aggregateEmailEvents } from "../email-aggregation";

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
