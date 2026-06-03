import { describe, expect, it } from "vitest";
import { aggregateEmailEvents, STATUS_PRIORITY } from "../email-aggregation";

describe("aggregateEmailEvents", () => {
  it("excludes bot opens from hasOpened", () => {
    const events = [
      {
        messageId: "msg-1",
        sentAt: 1000,
        accountId: "acc-1",
        from: "sender@test.com",
        to: ["recipient@test.com"],
        subject: "Test",
        eventType: "Send",
        eventData: "{}",
        createdAt: 1000,
        expiresAt: 9_999_999,
      },
      {
        messageId: "msg-1",
        sentAt: 1001,
        accountId: "acc-1",
        from: "sender@test.com",
        to: ["recipient@test.com"],
        subject: "Test",
        eventType: "Open",
        eventData: "{}",
        additionalData: JSON.stringify({
          userAgent: "Barracuda/5.0",
          ipAddress: "1.2.3.4",
        }),
        createdAt: 1001,
        expiresAt: 9_999_999,
      },
    ];

    const result = aggregateEmailEvents([events]);
    expect(result).toHaveLength(1);
    expect(result[0].hasOpened).toBe(false);
    // Status should not be promoted to "opened" for bot opens
    expect(result[0].status).toBe("sent");
  });

  it("includes real opens in hasOpened", () => {
    const events = [
      {
        messageId: "msg-1",
        sentAt: 1000,
        accountId: "acc-1",
        from: "sender@test.com",
        to: ["recipient@test.com"],
        subject: "Test",
        eventType: "Send",
        eventData: "{}",
        createdAt: 1000,
        expiresAt: 9_999_999,
      },
      {
        messageId: "msg-1",
        sentAt: 1001,
        accountId: "acc-1",
        from: "sender@test.com",
        to: ["recipient@test.com"],
        subject: "Test",
        eventType: "Open",
        eventData: "{}",
        additionalData: JSON.stringify({
          userAgent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
          ipAddress: "203.0.113.42",
        }),
        createdAt: 1001,
        expiresAt: 9_999_999,
      },
    ];

    const result = aggregateEmailEvents([events]);
    expect(result).toHaveLength(1);
    expect(result[0].hasOpened).toBe(true);
    expect(result[0].status).toBe("opened");
  });

  it("returns lastActivityAt as the latest createdAt across all events", () => {
    const events = [
      {
        messageId: "msg-1",
        sentAt: 1000,
        accountId: "acc-1",
        from: "sender@test.com",
        to: ["recipient@test.com"],
        subject: "Test",
        eventType: "Send",
        eventData: "{}",
        createdAt: 1000,
        expiresAt: 9_999_999,
      },
      {
        messageId: "msg-1",
        sentAt: 2000,
        accountId: "acc-1",
        from: "sender@test.com",
        to: ["recipient@test.com"],
        subject: "Test",
        eventType: "Delivery",
        eventData: "{}",
        createdAt: 2000,
        expiresAt: 9_999_999,
      },
      {
        messageId: "msg-1",
        sentAt: 5000,
        accountId: "acc-1",
        from: "sender@test.com",
        to: ["recipient@test.com"],
        subject: "Test",
        eventType: "Open",
        eventData: "{}",
        createdAt: 5000,
        expiresAt: 9_999_999,
      },
    ];

    const result = aggregateEmailEvents([events]);
    expect(result[0].lastActivityAt).toBe(5000);
  });

  it("lastActivityAt equals sentAt when only a Send event exists", () => {
    const events = [
      {
        messageId: "msg-1",
        sentAt: 1000,
        accountId: "acc-1",
        from: "sender@test.com",
        to: ["recipient@test.com"],
        subject: "Test",
        eventType: "Send",
        eventData: "{}",
        createdAt: 1000,
        expiresAt: 9_999_999,
      },
    ];

    const result = aggregateEmailEvents([events]);
    expect(result[0].lastActivityAt).toBe(1000);
    expect(result[0].sentAt).toBe(1000);
  });

  it("treats opens without additionalData as real opens", () => {
    const events = [
      {
        messageId: "msg-1",
        sentAt: 1000,
        accountId: "acc-1",
        from: "sender@test.com",
        to: ["recipient@test.com"],
        subject: "Test",
        eventType: "Open",
        eventData: "{}",
        createdAt: 1000,
        expiresAt: 9_999_999,
      },
    ];

    const result = aggregateEmailEvents([events]);
    expect(result[0].hasOpened).toBe(true);
  });

  it("complaint beats delivered when Complaint arrives after Delivery", () => {
    const events = [
      {
        messageId: "msg-1",
        sentAt: 1000,
        accountId: "acc-1",
        from: "sender@test.com",
        to: ["recipient@test.com"],
        subject: "Test",
        eventType: "Delivery",
        eventData: "{}",
        createdAt: 1000,
        expiresAt: 9_999_999,
      },
      {
        messageId: "msg-1",
        sentAt: 1001,
        accountId: "acc-1",
        from: "sender@test.com",
        to: ["recipient@test.com"],
        subject: "Test",
        eventType: "Complaint",
        eventData: "{}",
        createdAt: 1001,
        expiresAt: 9_999_999,
      },
    ];

    const result = aggregateEmailEvents([events]);
    expect(result[0].status).toBe("complained");
  });

  it("complaint beats delivered when Complaint arrives before Delivery in event array", () => {
    const events = [
      {
        messageId: "msg-1",
        sentAt: 1001,
        accountId: "acc-1",
        from: "sender@test.com",
        to: ["recipient@test.com"],
        subject: "Test",
        eventType: "Complaint",
        eventData: "{}",
        createdAt: 1001,
        expiresAt: 9_999_999,
      },
      {
        messageId: "msg-1",
        sentAt: 1000,
        accountId: "acc-1",
        from: "sender@test.com",
        to: ["recipient@test.com"],
        subject: "Test",
        eventType: "Delivery",
        eventData: "{}",
        createdAt: 1000,
        expiresAt: 9_999_999,
      },
    ];

    const result = aggregateEmailEvents([events]);
    expect(result[0].status).toBe("complained");
  });

  it("suppressed has higher priority than bounced so PG suppressed-via-bounce overrides DynamoDB raw Bounce", () => {
    const suppressedIdx = STATUS_PRIORITY.indexOf("suppressed");
    const bouncedIdx = STATUS_PRIORITY.indexOf("bounced");
    expect(suppressedIdx).toBeLessThan(bouncedIdx);
  });

  it("suppressed maps correctly and beats delivered", () => {
    const events = [
      {
        messageId: "msg-1",
        sentAt: 1000,
        accountId: "acc-1",
        from: "sender@test.com",
        to: ["recipient@test.com"],
        subject: "Test",
        eventType: "Delivery",
        eventData: "{}",
        createdAt: 1000,
        expiresAt: 9_999_999,
      },
      {
        messageId: "msg-1",
        sentAt: 1001,
        accountId: "acc-1",
        from: "sender@test.com",
        to: ["recipient@test.com"],
        subject: "Test",
        eventType: "Suppressed",
        eventData: "{}",
        createdAt: 1001,
        expiresAt: 9_999_999,
      },
    ];

    const result = aggregateEmailEvents([events]);
    expect(result[0].status).toBe("suppressed");
  });
});
