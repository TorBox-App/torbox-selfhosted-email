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

const mockGetSESMetricsSummary = vi.fn();
const mockGetSESReputationMetrics = vi.fn();
vi.mock("@/lib/aws/cloudwatch", () => ({
  getSESMetricsSummary: (...args: unknown[]) =>
    mockGetSESMetricsSummary(...args),
  getSESReputationMetrics: (...args: unknown[]) =>
    mockGetSESReputationMetrics(...args),
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

function makeMetrics(values: {
  sends: number;
  deliveries: number;
  bounces: number;
  complaints: number;
  renderingFailures: number;
}) {
  const metric = (val: number) => [{ Timestamps: [new Date()], Values: [val] }];
  return {
    sends: metric(values.sends),
    deliveries: metric(values.deliveries),
    bounces: metric(values.bounces),
    complaints: metric(values.complaints),
    renderingFailures: metric(values.renderingFailures),
  };
}

describe("Analytics Overview API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no reputation data (new account fallback)
    mockGetSESReputationMetrics.mockResolvedValue({
      bounceRate: null,
      complaintRate: null,
    });
  });

  it("returns correct deliveryRate when rendering failures exist", async () => {
    // 124 sends, 13 rendering failures → effectiveSent = 111
    // 110 deliveries → deliveryRate = 110/111 * 100 = 99.10%
    mockGetSESMetricsSummary.mockResolvedValueOnce(
      makeMetrics({
        sends: 124,
        deliveries: 110,
        bounces: 1,
        complaints: 0,
        renderingFailures: 13,
      })
    );

    const { GET } = await import("../[orgSlug]/analytics/overview/route");
    const request = new Request(
      "http://localhost/api/test-org/analytics/overview"
    );
    const context = { params: Promise.resolve({ orgSlug: "test-org" }) };

    const response = await GET(request, context);
    const data = await response.json();

    // effectiveSent = 124 - 13 = 111
    // deliveryRate = 110 / 111 * 100 = 99.10 (rounded to 2 decimal places)
    expect(data.deliveryRate).toBeCloseTo(99.1, 1);
    // NOT the old incorrect rate of 88.71
    expect(data.deliveryRate).not.toBeCloseTo(88.71, 1);
  });

  it("returns deliveryRate 0 when 100% rendering failures (no division by zero)", async () => {
    // All sends are rendering failures → effectiveSent = 0 → rates = 0
    mockGetSESMetricsSummary.mockResolvedValueOnce(
      makeMetrics({
        sends: 50,
        deliveries: 0,
        bounces: 0,
        complaints: 0,
        renderingFailures: 50,
      })
    );

    const { GET } = await import("../[orgSlug]/analytics/overview/route");
    const request = new Request(
      "http://localhost/api/test-org/analytics/overview"
    );
    const context = { params: Promise.resolve({ orgSlug: "test-org" }) };

    const response = await GET(request, context);
    const data = await response.json();

    expect(data.deliveryRate).toBe(0);
    expect(data.bounceRate).toBe(0);
    expect(data.complaintRate).toBe(0);
  });

  it("uses SES reputation metrics for bounce/complaint rates when available", async () => {
    // Simulates the real-world bug: low recent send volume inflates computed rates,
    // but SES reputation covers the full account history.
    // 3 bounces / 13 sends = 23% computed, but SES shows 0.02% from full history.
    mockGetSESMetricsSummary.mockResolvedValueOnce(
      makeMetrics({
        sends: 13,
        deliveries: 10,
        bounces: 3,
        complaints: 0,
        renderingFailures: 0,
      })
    );
    mockGetSESReputationMetrics.mockResolvedValueOnce({
      bounceRate: 0.0002,
      complaintRate: 0.001, // 0.1% — rounds to 0.10 with toFixed(2)
    });

    const { GET } = await import("../[orgSlug]/analytics/overview/route");
    const request = new Request(
      "http://localhost/api/test-org/analytics/overview"
    );
    const context = { params: Promise.resolve({ orgSlug: "test-org" }) };

    const response = await GET(request, context);
    const data = await response.json();

    // Should use SES reputation rate (0.0002 * 100 = 0.02%), not computed (3/13 = 23%)
    expect(data.bounceRate).toBeCloseTo(0.02, 2);
    expect(data.complaintRate).toBeCloseTo(0.1, 1);
  });

  it("falls back to computed rates when reputation metrics unavailable", async () => {
    mockGetSESMetricsSummary.mockResolvedValueOnce(
      makeMetrics({
        sends: 100,
        deliveries: 95,
        bounces: 3,
        complaints: 1,
        renderingFailures: 0,
      })
    );
    // mockGetSESReputationMetrics already returns null,null from beforeEach

    const { GET } = await import("../[orgSlug]/analytics/overview/route");
    const request = new Request(
      "http://localhost/api/test-org/analytics/overview"
    );
    const context = { params: Promise.resolve({ orgSlug: "test-org" }) };

    const response = await GET(request, context);
    const data = await response.json();

    expect(data.bounceRate).toBeCloseTo(3, 0);
    expect(data.complaintRate).toBeCloseTo(1, 0);
  });

  it("includes totalRenderingFailures in response", async () => {
    mockGetSESMetricsSummary.mockResolvedValueOnce(
      makeMetrics({
        sends: 124,
        deliveries: 110,
        bounces: 1,
        complaints: 0,
        renderingFailures: 13,
      })
    );

    const { GET } = await import("../[orgSlug]/analytics/overview/route");
    const request = new Request(
      "http://localhost/api/test-org/analytics/overview"
    );
    const context = { params: Promise.resolve({ orgSlug: "test-org" }) };

    const response = await GET(request, context);
    const data = await response.json();

    expect(data).toHaveProperty("totalRenderingFailures");
    expect(data.totalRenderingFailures).toBe(13);
  });
});
