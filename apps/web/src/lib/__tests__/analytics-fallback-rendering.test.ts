import { describe, expect, it, vi } from "vitest";

// Mock Drizzle DB to capture and verify the SQL query shape
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockGroupBy = vi.fn();

mockSelect.mockReturnValue({ from: mockFrom });
mockFrom.mockReturnValue({ where: mockWhere });
mockWhere.mockReturnValue({ groupBy: mockGroupBy });
mockGroupBy.mockResolvedValue([
  {
    date: "2026-04-10",
    sent: 111,
    delivered: 110,
    bounced: 1,
    complaints: 0,
    opens: 20,
    clicks: 5,
    renderingFailures: 13,
  },
]);

vi.mock("@wraps/db", () => ({
  db: { select: mockSelect },
}));

// Mock schema and operators
vi.mock("@wraps/db/schema/batch", () => ({
  messageSend: {
    sentAt: "sentAt",
    organizationId: "organizationId",
    channel: "channel",
    deliveredAt: "deliveredAt",
    bouncedAt: "bouncedAt",
    complainedAt: "complainedAt",
    openedAt: "openedAt",
    clickedAt: "clickedAt",
    status: "status",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => args,
  eq: (a: unknown, b: unknown) => [a, b],
  gte: (a: unknown, b: unknown) => [a, b],
  lte: (a: unknown, b: unknown) => [a, b],
  isNotNull: (a: unknown) => a,
  desc: (a: unknown) => a,
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings,
      values,
    }),
    { raw: (s: string) => s }
  ),
}));

describe("getEmailMetricsFromPostgres", () => {
  it("returns renderingFailures in the DailyEmailMetrics type", async () => {
    const { getEmailMetricsFromPostgres } = await import(
      "../analytics-fallback"
    );

    const result = await getEmailMetricsFromPostgres(
      "org-1",
      new Date("2026-04-01"),
      new Date("2026-04-10")
    );

    const entry = result.get("2026-04-10");
    expect(entry).toBeDefined();
    expect(entry).toHaveProperty("renderingFailures");
    expect(entry!.renderingFailures).toBe(13);
    // sent should NOT include rendering failures (111, not 124)
    expect(entry!.sent).toBe(111);
  });
});
