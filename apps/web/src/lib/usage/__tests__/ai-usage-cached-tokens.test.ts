import { aiUsageLog, db } from "@wraps/db";
import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { testOrganization, testUser } from "@/app/api/__tests__/setup";
import { logAiUsage } from "../ai-usage";

const TEST_PREFIX = "cached-tokens-test";

afterEach(async () => {
  await db
    .delete(aiUsageLog)
    .where(
      and(
        eq(aiUsageLog.organizationId, testOrganization.id),
        eq(aiUsageLog.featureType, TEST_PREFIX)
      )
    );
});

async function lastRow() {
  return await db.query.aiUsageLog.findFirst({
    where: and(
      eq(aiUsageLog.organizationId, testOrganization.id),
      eq(aiUsageLog.featureType, TEST_PREFIX)
    ),
  });
}

describe("logAiUsage — prompt-cache metering", () => {
  it("persists cached reads separately from uncached input tokens", async () => {
    // The whole point of the column: with caching on, input_tokens drops and
    // the difference has to land somewhere or it reads as a billing regression.
    await logAiUsage({
      organizationId: testOrganization.id,
      userId: testUser.id,
      featureType: TEST_PREFIX,
      inputTokens: 1240,
      cachedInputTokens: 46_800,
      outputTokens: 2100,
      totalTokens: 50_140,
      model: "anthropic/claude-sonnet-4",
    });

    const row = await lastRow();
    expect(row?.inputTokens).toBe(1240);
    expect(row?.cachedInputTokens).toBe(46_800);
    expect(row?.outputTokens).toBe(2100);
  });

  it("stores null, not zero, when the provider reports no cache field", async () => {
    // Zero would claim a measured cache miss. Null correctly means "unknown",
    // which is also what every pre-migration row holds.
    await logAiUsage({
      organizationId: testOrganization.id,
      userId: testUser.id,
      featureType: TEST_PREFIX,
      inputTokens: 900,
      outputTokens: 300,
      model: "xai/grok-code-fast-1",
    });

    const row = await lastRow();
    expect(row?.cachedInputTokens).toBeNull();
    expect(row?.inputTokens).toBe(900);
  });

  it("records a genuine zero when the provider reports one", async () => {
    await logAiUsage({
      organizationId: testOrganization.id,
      userId: testUser.id,
      featureType: TEST_PREFIX,
      inputTokens: 900,
      cachedInputTokens: 0,
      model: "anthropic/claude-sonnet-4",
    });

    const row = await lastRow();
    expect(row?.cachedInputTokens).toBe(0);
  });
});
