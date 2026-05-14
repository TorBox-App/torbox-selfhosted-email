import { describe, expect, it } from "vitest";
import {
  ALL_EVENT_TYPES,
  DEFAULT_CONFIG_SET_NAME,
  DEFAULT_EVENT_TYPES,
  DEFAULT_HISTORY_RETENTION,
  DEFAULT_MAIL_FROM_SUBDOMAIN,
  DEFAULT_SUPPRESSION_REASONS,
  DEFAULT_TAGS,
  EXTERNAL_ID_PREFIX,
  RESOURCE_PREFIX,
  VERCEL_OIDC_THUMBPRINT,
  VERCEL_OIDC_URL,
} from "./constants.js";

describe("DEFAULT_EVENT_TYPES", () => {
  it("contains expected default event types", () => {
    expect(DEFAULT_EVENT_TYPES).toContain("SEND");
    expect(DEFAULT_EVENT_TYPES).toContain("DELIVERY");
    expect(DEFAULT_EVENT_TYPES).toContain("BOUNCE");
    expect(DEFAULT_EVENT_TYPES).toContain("COMPLAINT");
    expect(DEFAULT_EVENT_TYPES).toContain("OPEN");
    expect(DEFAULT_EVENT_TYPES).toContain("CLICK");
  });

  it("has 6 default event types", () => {
    expect(DEFAULT_EVENT_TYPES).toHaveLength(6);
  });
});

describe("ALL_EVENT_TYPES", () => {
  it("contains all 10 SES event types", () => {
    expect(ALL_EVENT_TYPES).toContain("SEND");
    expect(ALL_EVENT_TYPES).toContain("DELIVERY");
    expect(ALL_EVENT_TYPES).toContain("BOUNCE");
    expect(ALL_EVENT_TYPES).toContain("COMPLAINT");
    expect(ALL_EVENT_TYPES).toContain("OPEN");
    expect(ALL_EVENT_TYPES).toContain("CLICK");
    expect(ALL_EVENT_TYPES).toContain("REJECT");
    expect(ALL_EVENT_TYPES).toContain("RENDERING_FAILURE");
    expect(ALL_EVENT_TYPES).toContain("DELIVERY_DELAY");
    expect(ALL_EVENT_TYPES).toContain("SUBSCRIPTION");
  });

  it("has 10 event types", () => {
    expect(ALL_EVENT_TYPES).toHaveLength(10);
  });

  it("includes all default event types", () => {
    for (const eventType of DEFAULT_EVENT_TYPES) {
      expect(ALL_EVENT_TYPES).toContain(eventType);
    }
  });
});

describe("DEFAULT_SUPPRESSION_REASONS", () => {
  it("contains BOUNCE and COMPLAINT", () => {
    expect(DEFAULT_SUPPRESSION_REASONS).toContain("BOUNCE");
    expect(DEFAULT_SUPPRESSION_REASONS).toContain("COMPLAINT");
  });

  it("has 2 suppression reasons", () => {
    expect(DEFAULT_SUPPRESSION_REASONS).toHaveLength(2);
  });
});

describe("Vercel OIDC constants", () => {
  it("has correct OIDC URL", () => {
    expect(VERCEL_OIDC_URL).toBe("https://oidc.vercel.com");
  });

  it("has OIDC thumbprint", () => {
    expect(VERCEL_OIDC_THUMBPRINT).toBeDefined();
    expect(typeof VERCEL_OIDC_THUMBPRINT).toBe("string");
    // Thumbprint should be a hex string (40 characters for SHA-1)
    expect(VERCEL_OIDC_THUMBPRINT).toMatch(/^[a-f0-9]+$/);
  });
});

describe("Resource naming constants", () => {
  it("has correct config set name", () => {
    expect(DEFAULT_CONFIG_SET_NAME).toBe("wraps-email-tracking");
  });

  it("has correct mail from subdomain", () => {
    expect(DEFAULT_MAIL_FROM_SUBDOMAIN).toBe("mail");
  });

  it("has correct resource prefix", () => {
    expect(RESOURCE_PREFIX).toBe("wraps-email");
  });

  it("has correct default history retention", () => {
    expect(DEFAULT_HISTORY_RETENTION).toBe("90days");
  });
});

describe("DEFAULT_TAGS", () => {
  it("has ManagedBy tag", () => {
    expect(DEFAULT_TAGS).toHaveProperty("ManagedBy");
    expect(DEFAULT_TAGS.ManagedBy).toBe("wraps");
  });
});

describe("EXTERNAL_ID_PREFIX", () => {
  it("is exactly wraps_ — changing this breaks customer IAM trust policies", () => {
    expect(EXTERNAL_ID_PREFIX).toBe("wraps_");
  });
});
