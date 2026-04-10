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
vi.mock("@/lib/aws/cloudwatch", () => ({
  getSESMetricsSummary: (...args: unknown[]) =>
    mockGetSESMetricsSummary(...args),
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
