import { describe, expect, it } from "vitest";
import { resolveConfigurationSetName } from "../config-set";
import { WRAPS_CONFIGURATION_SET_NAME } from "../send";

// Config sets are per-domain (wraps-email-<domain>), but their names are NOT
// derivable safely — a verified domain doesn't prove its per-domain set was
// provisioned, and a derived-but-missing name hard-fails the send. So the
// resolver only ever returns a name discovery CONFIRMED exists: the sender
// domain's identity config set, else the stored canonical, else the legacy set.
describe("resolveConfigurationSetName", () => {
  const identity = (
    id: string,
    configSetName?: string,
    type: "DOMAIN" | "EMAIL_ADDRESS" = "DOMAIN"
  ) => ({ identity: id, type, configSetName });

  it("uses the sender domain's own confirmed config set (per-domain routing)", () => {
    expect(
      resolveConfigurationSetName({
        fromDomain: "news.acme.com",
        storedConfigSetName: "wraps-email-acme-com",
        identities: [
          identity("acme.com", "wraps-email-acme-com"),
          identity("news.acme.com", "wraps-email-news-acme-com"),
        ],
      })
    ).toBe("wraps-email-news-acme-com");
  });

  it("matches the sender domain case-insensitively", () => {
    expect(
      resolveConfigurationSetName({
        fromDomain: "ACME.com",
        identities: [identity("acme.com", "wraps-email-acme-com")],
      })
    ).toBe("wraps-email-acme-com");
  });

  it("falls back to the stored canonical when no identity matches the sender domain", () => {
    // Never derive wraps-email-other-com — that set may not exist and would
    // hard-fail the send. The discovery-confirmed canonical always exists.
    expect(
      resolveConfigurationSetName({
        fromDomain: "other.com",
        storedConfigSetName: "wraps-email-acme-com",
        identities: [identity("acme.com", "wraps-email-acme-com")],
      })
    ).toBe("wraps-email-acme-com");
  });

  it("falls back to the stored canonical when the matched identity has no confirmed set (pre-rescan)", () => {
    expect(
      resolveConfigurationSetName({
        fromDomain: "acme.com",
        storedConfigSetName: "wraps-email-acme-com",
        identities: [identity("acme.com", undefined)],
      })
    ).toBe("wraps-email-acme-com");
  });

  it("ignores EMAIL_ADDRESS identities when matching the sender domain", () => {
    expect(
      resolveConfigurationSetName({
        fromDomain: "acme.com",
        storedConfigSetName: "wraps-email-acme-com",
        identities: [
          identity("acme.com", "wraps-email-should-not-use", "EMAIL_ADDRESS"),
        ],
      })
    ).toBe("wraps-email-acme-com");
  });

  it("uses the stored canonical when there are no identities", () => {
    expect(
      resolveConfigurationSetName({
        fromDomain: "acme.com",
        storedConfigSetName: "wraps-email-acme-com",
      })
    ).toBe("wraps-email-acme-com");
  });

  it("respects an explicit non-Wraps override stored on the account", () => {
    expect(
      resolveConfigurationSetName({
        fromDomain: "acme.com",
        storedConfigSetName: "customer-own-config-set",
      })
    ).toBe("customer-own-config-set");
  });

  it("falls back to the legacy global set when nothing else is known — never omits", () => {
    // Omitting would silently disable tracking and break engagement-gated
    // workflows; the legacy set is the safe last resort.
    expect(resolveConfigurationSetName({ fromDomain: "acme.com" })).toBe(
      WRAPS_CONFIGURATION_SET_NAME
    );
    expect(
      resolveConfigurationSetName({
        fromDomain: "acme.com",
        storedConfigSetName: null,
        identities: [],
      })
    ).toBe(WRAPS_CONFIGURATION_SET_NAME);
  });
});
