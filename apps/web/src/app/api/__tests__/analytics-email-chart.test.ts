import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: () => new Headers(),
}));

vi.mock("@wraps/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => ({
        user: { id: "user-1", email: "test@example.com", name: "Test" },
        session: {
          id: "session-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: "user-1",
          expiresAt: new Date(Date.now() + 86_400_000),
          token: "test-token",
        },
      })),
    },
  },
}));

vi.mock("@/lib/organization", () => ({
  getOrganizationWithMembership: vi.fn(async () => ({
    id: "org-1",
    name: "Test Org",
    slug: "test-org",
  })),
}));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: Function) => (...args: unknown[]) => fn(...args),
}));

const mockGetEmailMetricsFromPostgres = vi.fn();
vi.mock("@/lib/analytics-fallback", () => ({
  getEmailMetricsFromPostgres: (...args: unknown[]) =>
    mockGetEmailMetricsFromPostgres(...args),
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
  serializeError: (e: unknown) => e,
}));

// Mock analytics-utils — return the data as-is
vi.mock("@/lib/analytics-utils", () => ({
  gapFillDates: (
    range: string[],
    map: Map<string, Record<string, number>>,
    defaults: Record<string, number>
  ) =>
    range.map((date) => ({
      date,
      timestamp: new Date(date).getTime(),
      ...(map.get(date) || defaults),
    })),
  generateDateRange: (start: Date, end: Date) => {
    const dates: string[] = [];
    const d = new Date(start);
    while (d <= end) {
      dates.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
    return dates;
  },
  validateTimezone: (tz: string | null | undefined) => tz || "UTC",
}));

function makePostgresMetrics(day: {
  sent: number;
  delivered: number;
  bounced: number;
  complaints: number;
  opens: number;
  clicks: number;
  renderingFailures: number;
}) {
  const map = new Map();
  map.set("2026-04-10", { ...day });
  return map;
}

describe("Email Chart API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns correct deliveryRate in overview when rendering failures exist", async () => {
    mockGetEmailMetricsFromPostgres.mockResolvedValueOnce(
      makePostgresMetrics({
        sent: 124,
        delivered: 110,
        bounced: 1,
        complaints: 0,
        opens: 20,
        clicks: 5,
        renderingFailures: 13,
      })
    );

    const { GET } = await import("../[orgSlug]/analytics/email-chart/route");
    const request = new Request(
      "http://localhost/api/test-org/analytics/email-chart?days=30&tz=UTC"
    );
    const context = { params: Promise.resolve({ orgSlug: "test-org" }) };

    const response = await GET(request, context);
    const data = await response.json();

    // effectiveSent = 124 - 13 = 111
    // deliveryRate = 110/111 * 100 = 99.10
    expect(data.overview.deliveryRate).toBeCloseTo(99.1, 1);
    // NOT the buggy rate
    expect(data.overview.deliveryRate).not.toBeCloseTo(88.71, 1);
  });
});
