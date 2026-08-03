import { describe, expect, it } from "vitest";
import { resolveRedirect } from "../resolve-redirect";

describe("resolveRedirect", () => {
  describe("signin mode", () => {
    it("sends a bare visit to the app root", () => {
      expect(resolveRedirect({})).toBe("/");
      expect(resolveRedirect({ mode: "signin" })).toBe("/");
    });

    it("honors a safe redirect param", () => {
      expect(resolveRedirect({ redirect: "/wraps/contacts" })).toBe(
        "/wraps/contacts"
      );
    });

    it("rejects an off-site redirect", () => {
      expect(resolveRedirect({ redirect: "https://evil.test/steal" })).toBe(
        "/"
      );
      expect(resolveRedirect({ redirect: "//evil.test" })).toBe("/");
      expect(resolveRedirect({ redirect: "/javascript:alert(1)" })).toBe("/");
    });
  });

  describe("signup mode", () => {
    it("defaults to onboarding with a monthly interval", () => {
      expect(resolveRedirect({ mode: "signup" })).toBe(
        "/onboarding?interval=monthly"
      );
    });

    it("carries plan and interval through to onboarding", () => {
      expect(
        resolveRedirect({ mode: "signup", plan: "scale", interval: "yearly" })
      ).toBe("/onboarding?plan=scale&interval=yearly");
    });

    it("passes through invitation and device redirects", () => {
      expect(
        resolveRedirect({ mode: "signup", redirect: "/invitations/abc123" })
      ).toBe("/invitations/abc123");
      expect(resolveRedirect({ mode: "signup", redirect: "/device" })).toBe(
        "/device"
      );
    });

    it("ignores a non-special redirect in favor of onboarding", () => {
      expect(
        resolveRedirect({ mode: "signup", redirect: "/wraps/contacts" })
      ).toBe("/onboarding?interval=monthly");
    });

    it("does not let an unsafe redirect escape onboarding", () => {
      expect(
        resolveRedirect({ mode: "signup", redirect: "https://evil.test" })
      ).toBe("/onboarding?interval=monthly");
    });
  });

  it("takes the first value when a param is repeated", () => {
    expect(resolveRedirect({ redirect: ["/first", "/second"] })).toBe("/first");
    expect(resolveRedirect({ mode: ["signup"], plan: ["pro"] })).toBe(
      "/onboarding?plan=pro&interval=monthly"
    );
  });
});
