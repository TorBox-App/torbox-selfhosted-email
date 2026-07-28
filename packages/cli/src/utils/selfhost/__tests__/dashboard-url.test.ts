import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLoad = vi.hoisted(() => vi.fn());
vi.mock("../../shared/metadata.js", () => ({
  loadConnectionMetadata: mockLoad,
}));

const { resolveDashboardUrl } = await import("../dashboard-url.js");

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.WRAPS_APP_URL;
});

describe("resolveDashboardUrl", () => {
  it("points a self-hosted account at its own dashboard", async () => {
    // The whole point: a customer paying for data sovereignty must not be told
    // to go and look at app.wraps.dev, which holds none of their sends.
    mockLoad.mockResolvedValue({
      services: { selfhost: { config: { appUrl: "https://mail.acme.com" } } },
    });

    await expect(
      resolveDashboardUrl("123456789012", "us-east-1")
    ).resolves.toBe("https://mail.acme.com");
  });

  it("falls back to the platform for an account with no control plane", async () => {
    mockLoad.mockResolvedValue({ services: { email: {} } });

    await expect(
      resolveDashboardUrl("123456789012", "us-east-1")
    ).resolves.toBe("https://app.wraps.dev");
  });

  it("falls back when there is no metadata at all", async () => {
    mockLoad.mockResolvedValue(null);

    await expect(
      resolveDashboardUrl("123456789012", "us-east-1")
    ).resolves.toBe("https://app.wraps.dev");
  });

  it("falls back rather than throwing when metadata cannot be read", async () => {
    // This runs after a command has already succeeded — a cosmetic lookup must
    // never turn a completed deploy into an error.
    mockLoad.mockRejectedValue(new Error("S3 unreachable"));

    await expect(
      resolveDashboardUrl("123456789012", "us-east-1")
    ).resolves.toBe("https://app.wraps.dev");
  });

  it("honours WRAPS_APP_URL for the platform fallback", async () => {
    mockLoad.mockResolvedValue(null);
    process.env.WRAPS_APP_URL = "http://localhost:3000";

    await expect(
      resolveDashboardUrl("123456789012", "us-east-1")
    ).resolves.toBe("http://localhost:3000");
  });

  it("reads the deployment for the region it was asked about", async () => {
    mockLoad.mockResolvedValue(null);

    await resolveDashboardUrl("123456789012", "eu-west-1");

    // Deployments are per-account/per-region; the wrong pair silently returns
    // the platform URL for an account that does have a control plane.
    expect(mockLoad).toHaveBeenCalledWith("123456789012", "eu-west-1");
  });
});
