/**
 * Event Feed Stale Email Content Tests
 *
 * buildEventFeedStaleEmail is a pure content builder (no network calls) used
 * by the event-feed-staleness cron to notify org owners when their SES
 * event feed goes silent while sends are still happening.
 */

import { describe, expect, it } from "vitest";
import { buildEventFeedStaleEmail } from "./event-feed-stale";

const BASE_PARAMS = {
  accountName: "Production",
  awsAccountNumber: "123456789012",
  region: "us-east-1",
  orgSlug: "acme",
  awsAccountId: "aws-account-1",
  staleSince: new Date("2026-07-01T12:00:00.000Z"),
};

describe("buildEventFeedStaleEmail", () => {
  it("includes account name, AWS account number, and region", () => {
    const { html, text } = buildEventFeedStaleEmail(BASE_PARAMS);

    for (const content of [html, text]) {
      expect(content).toContain("Production");
      expect(content).toContain("123456789012");
      expect(content).toContain("us-east-1");
    }
  });

  it("includes the staleSince timestamp", () => {
    const { html, text } = buildEventFeedStaleEmail(BASE_PARAMS);

    expect(html).toContain("2026-07-01 12:00 UTC");
    expect(text).toContain("2026-07-01 12:00 UTC");
  });

  it("links to the account settings page scoped by orgSlug and awsAccountId", () => {
    const { html, text } = buildEventFeedStaleEmail(BASE_PARAMS);
    const expectedUrl =
      "https://app.wraps.dev/acme/settings/aws-accounts/aws-account-1";

    expect(html).toContain(expectedUrl);
    expect(text).toContain(expectedUrl);
  });

  it("mentions the wraps email doctor remediation command", () => {
    const { html, text } = buildEventFeedStaleEmail(BASE_PARAMS);

    expect(html).toContain("wraps email doctor");
    expect(text).toContain("wraps email doctor");
  });

  it("subject line names the account and its AWS account number", () => {
    const { subject } = buildEventFeedStaleEmail(BASE_PARAMS);

    expect(subject).toContain("Production");
    expect(subject).toContain("123456789012");
  });
});
