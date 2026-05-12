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

// Mock unstable_cache to just call the function directly (no caching)
vi.mock("next/cache", () => ({
  unstable_cache: (fn: Function) => () => fn(),
}));

const mockGetCloudWatchMetricsBatch = vi.fn();
const mockGetSESReputationMetrics = vi.fn();
vi.mock("@/lib/aws/cloudwatch", () => ({
  getCloudWatchMetricsBatch: (...args: unknown[]) =>
    mockGetCloudWatchMetricsBatch(...args),
  getSESReputationMetrics: (...args: unknown[]) =>
    mockGetSESReputationMetrics(...args),
  SES_METRICS: {
    SEND: "Send",
    DELIVERY: "Delivery",
    BOUNCE: "Bounce",
    COMPLAINT: "Complaint",
    OPEN: "Open",
    CLICK: "Click",
    RENDERING_FAILURE: "RenderingFailure",
  },
}));

const mockGetEmailMetricsFromPostgres = vi.fn();
vi.mock("@/lib/analytics-fallback", () => ({
  getEmailMetricsFromPostgres: (...args: unknown[]) =>
    mockGetEmailMetricsFromPostgres(...args),
}));

vi.mock("@wraps/db", () => ({
  db: {
    query: {
      awsAccount: {
        findMany: vi.fn(async () => [{ id: "acc-1", organizationId: "org-1" }]),
      },
    },
  },
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
  aggregateByDate: (
    timestamps: Date[],
    valueSets: number[][],
    keys: string[]
  ) => {
    const map = new Map();
    for (let i = 0; i < timestamps.length; i++) {
      const date = timestamps[i].toISOString().slice(0, 10);
      const entry: Record<string, number> = {};
      for (let k = 0; k < keys.length; k++) {
        entry[keys[k]] = valueSets[k]?.[i] || 0;
      }
      map.set(date, entry);
    }
    return map;
  },
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

function makeCloudWatchBatchResult(day: {
  sends: number;
  deliveries: number;
  bounces: number;
  complaints: number;
  opens: number;
  clicks: number;
  renderingFailures: number;
}) {
  const ts = [new Date("2026-04-10")];
  return {
    Send: [{ Timestamps: ts, Values: [day.sends] }],
    Delivery: [{ Timestamps: ts, Values: [day.deliveries] }],
    Bounce: [{ Timestamps: ts, Values: [day.bounces] }],
    Complaint: [{ Timestamps: ts, Values: [day.complaints] }],
    Open: [{ Timestamps: ts, Values: [day.opens] }],
    Click: [{ Timestamps: ts, Values: [day.clicks] }],
    RenderingFailure: [{ Timestamps: ts, Values: [day.renderingFailures] }],
  };
}

describe("Email Chart API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSESReputationMetrics.mockResolvedValue({
      bounceRate: null,
      complaintRate: null,
    });
  });

  it("returns correct deliveryRate in overview when rendering failures exist", async () => {
    mockGetCloudWatchMetricsBatch.mockResolvedValueOnce(
      makeCloudWatchBatchResult({
        sends: 124,
        deliveries: 110,
        bounces: 1,
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

  it("uses SES reputation bounceRate/complaintRate over period-based calculation", async () => {
    mockGetCloudWatchMetricsBatch.mockResolvedValueOnce(
      makeCloudWatchBatchResult({
        sends: 24,
        deliveries: 20,
        bounces: 1,
        complaints: 1,
        opens: 5,
        clicks: 1,
        renderingFailures: 0,
      })
    );
    // SES reputation shows much lower rates based on full account history
    mockGetSESReputationMetrics.mockResolvedValueOnce({
      bounceRate: 0.0002,
      complaintRate: 0.0003,
    });

    const { GET } = await import("../[orgSlug]/analytics/email-chart/route");
    const request = new Request(
      "http://localhost/api/test-org/analytics/email-chart?days=30&tz=UTC"
    );
    const context = { params: Promise.resolve({ orgSlug: "test-org" }) };

    const response = await GET(request, context);
    const data = await response.json();

    // period-based would be 1/24*100 = 4.17% — reputation should win
    expect(data.overview.bounceRate).toBeCloseTo(0.02, 2);
    expect(data.overview.bounceRate).not.toBeCloseTo(4.17, 1);
    // 0.0003 * 100 = 0.03%, rounded to 2 decimals
    expect(data.overview.complaintRate).toBeCloseTo(0.03, 2);
  });
});
