import { beforeEach, describe, expect, it, vi } from "vitest";

const findCloudflareZoneId = vi.fn();

vi.mock("../../../packages/cli/src/utils/dns/credentials.js", () => ({
  findCloudflareZoneId: (...args: unknown[]) => findCloudflareZoneId(...args),
}));

const { resolveDnsConfig } = await import("../dns.js");

describe("resolveDnsConfig", () => {
  beforeEach(() => {
    findCloudflareZoneId.mockReset();
    process.env.CLOUDFLARE_API_TOKEN = undefined;
    // biome-ignore lint/performance/noDelete: must be absent, not "undefined"
    delete process.env.CLOUDFLARE_API_TOKEN;
  });

  it("is a no-op without a web domain (deployment serves on its CloudFront URL)", async () => {
    const result = await resolveDnsConfig({ dnsProvider: "cloudflare" });

    expect(result.envLines).toEqual([]);
    expect(result.sstEnv).toEqual({});
    expect(findCloudflareZoneId).not.toHaveBeenCalled();
  });

  it("defaults to route53 and resolves nothing up front", async () => {
    const result = await resolveDnsConfig({ webDomain: "app.example.com" });

    expect(result.provider).toBe("route53");
    expect(result.envLines).toEqual([]);
    expect(result.sstEnv).toEqual({});
  });

  it("rejects an unknown provider by name", async () => {
    await expect(
      resolveDnsConfig({ webDomain: "app.example.com", dnsProvider: "godaddy" })
    ).rejects.toThrow(/Unknown --dns-provider "godaddy"/);
  });

  it("looks up the Cloudflare zone and forwards the token to the sst subprocess", async () => {
    findCloudflareZoneId.mockResolvedValue("zone-abc");

    const result = await resolveDnsConfig({
      webDomain: "mail.tor.box",
      dnsProvider: "cloudflare",
      cloudflareApiToken: "cf-token",
    });

    expect(findCloudflareZoneId).toHaveBeenCalledWith(
      "cf-token",
      "mail.tor.box"
    );
    // app() runs before the dotenv load, so these must reach SST via the
    // subprocess env, not only the env file.
    expect(result.sstEnv).toEqual({
      CLOUDFLARE_API_TOKEN: "cf-token",
      SELFHOST_CLOUDFLARE_ZONE_ID: "zone-abc",
    });
    expect(result.envLines).toContain("SELFHOST_CLOUDFLARE_ZONE_ID=zone-abc");
  });

  it("skips the lookup when the zone id is supplied", async () => {
    const result = await resolveDnsConfig({
      webDomain: "mail.tor.box",
      dnsProvider: "cloudflare",
      cloudflareApiToken: "cf-token",
      cloudflareZoneId: "zone-explicit",
    });

    expect(findCloudflareZoneId).not.toHaveBeenCalled();
    expect(result.sstEnv.SELFHOST_CLOUDFLARE_ZONE_ID).toBe("zone-explicit");
  });

  it("falls back to CLOUDFLARE_API_TOKEN from the environment", async () => {
    process.env.CLOUDFLARE_API_TOKEN = "env-token";
    findCloudflareZoneId.mockResolvedValue("zone-abc");

    const result = await resolveDnsConfig({
      webDomain: "mail.tor.box",
      dnsProvider: "cloudflare",
    });

    expect(result.sstEnv.CLOUDFLARE_API_TOKEN).toBe("env-token");
  });

  it("names the required permission when the Cloudflare token is missing", async () => {
    await expect(
      resolveDnsConfig({ webDomain: "mail.tor.box", dnsProvider: "cloudflare" })
    ).rejects.toThrow(/Edit zone DNS/);
  });

  it("fails with the domain named when no Cloudflare zone matches", async () => {
    findCloudflareZoneId.mockResolvedValue(null);

    await expect(
      resolveDnsConfig({
        webDomain: "mail.tor.box",
        dnsProvider: "cloudflare",
        cloudflareApiToken: "cf-token",
      })
    ).rejects.toThrow(/No Cloudflare zone found for mail\.tor\.box/);
  });

  it("persists the cert arn for the manual-DNS provider", async () => {
    const result = await resolveDnsConfig({
      webDomain: "mail.tor.box",
      dnsProvider: "none",
      acmCertArn: "arn:aws:acm:us-east-1:1234:certificate/abc",
    });

    expect(result.envLines).toEqual([
      "SELFHOST_ACM_CERT_ARN=arn:aws:acm:us-east-1:1234:certificate/abc",
    ]);
    expect(result.sstEnv).toEqual({});
  });

  it("requires a cert arn for the manual-DNS provider, naming us-east-1", async () => {
    await expect(
      resolveDnsConfig({ webDomain: "mail.tor.box", dnsProvider: "none" })
    ).rejects.toThrow(/us-east-1/);
  });
});
