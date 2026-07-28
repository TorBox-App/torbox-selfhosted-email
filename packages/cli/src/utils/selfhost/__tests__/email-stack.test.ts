import { describe, expect, it } from "vitest";
import { domainFromUrl, resolveAuthEmailFrom } from "../email-stack.js";

/**
 * AUTH_EMAIL_FROM used to be `noreply@${webDomain}` — the DASHBOARD's domain,
 * which is only sendable when it happens to also be the verified SES domain.
 * Everywhere else that produced an unverified identity, and every signup,
 * invitation and password reset failed with "Email address is not verified"
 * with nothing in the deploy output hinting at it.
 */

describe("resolveAuthEmailFrom", () => {
  it("sends from the dashboard domain when SES has verified it", () => {
    // The nicest outcome, and the shape the demo runs: dashboard domain and
    // sending domain are the same, so recipients see noreply@<dashboard>.
    expect(
      resolveAuthEmailFrom({
        webDomain: "demo.wraps.dev",
        verifiedDomains: ["demo.wraps.dev"],
      })
    ).toBe("noreply@demo.wraps.dev");
  });

  it("falls back to the verified domain when the dashboard domain is not sendable", () => {
    // The regression this function exists for: the old derivation returned
    // noreply@app.example.com here, which SES refuses to send.
    expect(
      resolveAuthEmailFrom({
        webDomain: "app.example.com",
        verifiedDomains: ["mail.example.net"],
      })
    ).toBe("noreply@mail.example.net");
  });

  it("treats a verified parent domain as covering the dashboard subdomain", () => {
    // SES domain verification extends to subdomains, so app.example.com is
    // sendable under a verified example.com and the nicer address wins.
    expect(
      resolveAuthEmailFrom({
        webDomain: "app.example.com",
        verifiedDomains: ["example.com"],
      })
    ).toBe("noreply@app.example.com");
  });

  it("does not treat a suffix match as a subdomain", () => {
    // "notexample.com".endsWith("example.com") is true — without the dot the
    // check would authorise an unrelated domain.
    expect(
      resolveAuthEmailFrom({
        webDomain: "notexample.com",
        verifiedDomains: ["example.com"],
      })
    ).toBe("noreply@example.com");
  });

  it("returns null when nothing is verified", () => {
    // A missing var is a visible misconfiguration; a guessed one is a silent
    // bounce at the first signup.
    expect(
      resolveAuthEmailFrom({
        webDomain: "app.example.com",
        verifiedDomains: [],
      })
    ).toBeNull();
  });

  it("picks a verified domain when the deployment has no dashboard domain", () => {
    expect(resolveAuthEmailFrom({ verifiedDomains: ["example.com"] })).toBe(
      "noreply@example.com"
    );
  });
});

describe("domainFromUrl", () => {
  it("extracts the host a dashboard URL is served from", () => {
    expect(domainFromUrl("https://app.example.com/dashboard")).toBe(
      "app.example.com"
    );
  });

  it("returns undefined for a missing or unparseable URL", () => {
    // Metadata written by an older deploy may carry neither.
    expect(domainFromUrl(undefined)).toBeUndefined();
    expect(domainFromUrl("not a url")).toBeUndefined();
  });
});
