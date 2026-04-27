/**
 * Bug repro: message_usage_monthly (email send counts) is used as the plan
 * limit indicator in checkMessageUsageLimit(), which means a customer who
 * sends 50K emails via the SDK gets flagged as "at plan limit" and blocked.
 *
 * Email sends should NEVER be plan-gated — users pay AWS directly.
 * Only behavioral events (event_usage_monthly) count against plan limits.
 *
 * See: apps/web/src/lib/usage/message-usage.ts — checkMessageUsageLimit()
 * calls getMessageLimit() against message_usage_monthly counts, but
 * plans.ts states maxMessages is the "tracked events" limit.
 */

import { describe, expect, it, vi } from "vitest";

// Mock the DB so we can inject arbitrary message counts without hitting the
// real database. The mock mirrors the shape used in message-usage.ts.
vi.mock("@wraps/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@wraps/db")>();
  return {
    ...actual,
    db: {
      query: {
        messageUsageMonthly: {
          findFirst: vi.fn(),
        },
      },
    },
  };
});

// Mock organization plan lookup — we control which plan tier is returned.
const mockGetOrganizationPlanId = vi.fn();
vi.mock("@/lib/organization", () => ({
  getOrganizationPlanId: (...args: unknown[]) =>
    mockGetOrganizationPlanId(...args),
}));

import { db } from "@wraps/db";
import { checkMessageUsageLimit } from "@/lib/usage/message-usage";

const mockFindFirst = db.query.messageUsageMonthly.findFirst as ReturnType<
  typeof vi.fn
>;

describe("checkMessageUsageLimit — email sends must not trigger plan gate", () => {
  it("50K email sends on a free plan should NOT set allowed=false", async () => {
    // A free plan has maxMessages=5000 (tracked events limit).
    // A customer sending 50K emails via the SDK populates message_usage_monthly
    // with messageCount=50000. The bug: this makes allowed=false because
    // 50000 >= 5000 * 1.25 (6250), so the org looks like it hit its limit.
    mockGetOrganizationPlanId.mockResolvedValue("free");
    mockFindFirst.mockResolvedValue({ messageCount: 50_000 });

    const result = await checkMessageUsageLimit("org-heavy-sender");

    // Email sends are unlimited — the customer pays AWS directly.
    // This assertion FAILS with current code because checkMessageUsageLimit
    // uses message_usage_monthly counts against the plan's maxMessages cap.
    expect(result.allowed).toBe(true);
  });

  it("50K email sends on a starter plan should NOT set allowed=false", async () => {
    // Starter plan maxMessages=50000. Customer who has sent exactly 50K emails
    // is at 100% of the limit, which puts threshold at "critical" and would
    // approach the 125% hard-block. Sending one more email would hit the block.
    mockGetOrganizationPlanId.mockResolvedValue("starter");
    mockFindFirst.mockResolvedValue({ messageCount: 50_000 });

    const result = await checkMessageUsageLimit("org-starter-sender");

    // Email sends don't count against plan limits — should always be allowed.
    // Fails today: at 100% of maxMessages (50K/50K), threshold is "critical"
    // and allowed=true only because it hasn't crossed 125% yet — but this is
    // the wrong check entirely. The "allowed" flag should not exist for email sends.
    expect(result.threshold).toBe("normal");
  });

  it("high email send count should not affect the plan-gate allowed flag", async () => {
    // 70K sends on starter (maxMessages=50000): 140% — currently triggers hard block.
    mockGetOrganizationPlanId.mockResolvedValue("starter");
    mockFindFirst.mockResolvedValue({ messageCount: 70_000 });

    const result = await checkMessageUsageLimit("org-over-limit-sends");

    // The plan gate must not block email sends regardless of count.
    // Current code: 70000 >= 50000 * 1.25 (62500) → allowed=false. BUG.
    expect(result.allowed).toBe(true);
  });

  it("only event_usage_monthly should determine plan limit status", async () => {
    // This test documents the intended architecture: message_usage_monthly
    // tracks delivery counts for analytics, NOT for plan enforcement.
    // The limit check should use checkEventUsageLimit(), not checkMessageUsageLimit().
    //
    // A customer with 0 behavioral events but 1M email sends is well within
    // their plan limits. checkMessageUsageLimit() should return a result that
    // does not block them, OR the function should not exist in this form at all.
    mockGetOrganizationPlanId.mockResolvedValue("free");
    mockFindFirst.mockResolvedValue({ messageCount: 1_000_000 });

    const result = await checkMessageUsageLimit("org-email-heavy");

    expect(result.allowed).toBe(true);
    expect(result.threshold).toBe("normal");
  });
});
