/**
 * Rate Limit IP Spoofing Prevention Tests
 *
 * Verifies that getClientIp cannot be bypassed by spoofing
 * X-Forwarded-For headers. The trusted source is x-source-ip
 * injected by the Lambda handler from API Gateway's sourceIp.
 */

import { describe, expect, it } from "vitest";

import { getClientIp } from "../middleware/public-rate-limit";

describe("getClientIp", () => {
  it("prefers x-source-ip header over X-Forwarded-For", () => {
    const request = new Request("https://api.wraps.dev/v1/contacts", {
      headers: {
        "x-source-ip": "203.0.113.50",
        "x-forwarded-for": "10.0.0.1, 203.0.113.50",
      },
    });

    expect(getClientIp(request)).toBe("203.0.113.50");
  });

  it("uses rightmost XFF IP when x-source-ip is absent (resists spoofing)", () => {
    // Attacker sends: X-Forwarded-For: 1.2.3.4
    // API Gateway appends real IP: X-Forwarded-For: 1.2.3.4, 203.0.113.99
    const request = new Request("https://api.wraps.dev/v1/contacts", {
      headers: {
        "x-forwarded-for": "1.2.3.4, 203.0.113.99",
      },
    });

    // Must return the rightmost (API Gateway-appended) IP, not the spoofed first one
    expect(getClientIp(request)).toBe("203.0.113.99");
  });

  it("handles single-IP XFF header", () => {
    const request = new Request("https://api.wraps.dev/v1/contacts", {
      headers: {
        "x-forwarded-for": "203.0.113.10",
      },
    });

    expect(getClientIp(request)).toBe("203.0.113.10");
  });
});
