import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Unsubscribe Token", () => {
  beforeEach(() => {
    vi.stubEnv("UNSUBSCRIBE_SECRET", "test-secret-for-unsubscribe");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  describe("getSecret behavior", () => {
    it("should generate and verify tokens when UNSUBSCRIBE_SECRET is set", async () => {
      const { generateUnsubscribeToken, verifyUnsubscribeToken } = await import(
        "../unsubscribe-token"
      );

      const token = await generateUnsubscribeToken(
        "contact-123",
        "org-456",
        "topic-789"
      );

      const payload = await verifyUnsubscribeToken(token);

      expect(payload).not.toBeNull();
      expect(payload?.cid).toBe("contact-123");
      expect(payload?.oid).toBe("org-456");
      expect(payload?.tid).toBe("topic-789");
      expect(payload?.type).toBe("unsub");
    });

    it("should throw in production when UNSUBSCRIBE_SECRET is not set", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("UNSUBSCRIBE_SECRET", "");

      const { generateUnsubscribeToken } = await import("../unsubscribe-token");

      await expect(
        generateUnsubscribeToken("contact-123", "org-456")
      ).rejects.toThrow(
        "UNSUBSCRIBE_SECRET environment variable is required in production"
      );
    });

    it("should use fallback secret in development when UNSUBSCRIBE_SECRET is not set", async () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("UNSUBSCRIBE_SECRET", "");

      const { generateUnsubscribeToken, verifyUnsubscribeToken } = await import(
        "../unsubscribe-token"
      );

      const token = await generateUnsubscribeToken("contact-123", "org-456");

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");

      const payload = await verifyUnsubscribeToken(token);
      expect(payload).not.toBeNull();
      expect(payload?.cid).toBe("contact-123");
    });
  });

  describe("generateUnsubscribeToken", () => {
    it("should generate a valid JWT token", async () => {
      const { generateUnsubscribeToken } = await import("../unsubscribe-token");

      const token = await generateUnsubscribeToken("contact-123", "org-456");

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);
    });

    it("should generate token without topic ID", async () => {
      const { generateUnsubscribeToken, verifyUnsubscribeToken } = await import(
        "../unsubscribe-token"
      );

      const token = await generateUnsubscribeToken("contact-123", "org-456");
      const payload = await verifyUnsubscribeToken(token);

      expect(payload).not.toBeNull();
      expect(payload?.tid).toBeUndefined();
    });
  });

  describe("verifyUnsubscribeToken", () => {
    it("should return null for invalid token", async () => {
      const { verifyUnsubscribeToken } = await import("../unsubscribe-token");

      const payload = await verifyUnsubscribeToken("invalid-token");
      expect(payload).toBeNull();
    });

    it("should return null for tampered token", async () => {
      const { generateUnsubscribeToken, verifyUnsubscribeToken } = await import(
        "../unsubscribe-token"
      );

      const token = await generateUnsubscribeToken(
        "contact-123",
        "org-456",
        "topic-789"
      );
      const tamperedToken = `${token.slice(0, -5)}xxxxx`;

      const payload = await verifyUnsubscribeToken(tamperedToken);
      expect(payload).toBeNull();
    });

    it("should return null for token signed with different secret", async () => {
      const { generateUnsubscribeToken } = await import("../unsubscribe-token");

      const token = await generateUnsubscribeToken("contact-123", "org-456");

      // Change the secret
      vi.stubEnv("UNSUBSCRIBE_SECRET", "different-secret");

      // Need fresh import to pick up new env
      vi.resetModules();
      const { verifyUnsubscribeToken } = await import("../unsubscribe-token");

      const payload = await verifyUnsubscribeToken(token);
      expect(payload).toBeNull();
    });
  });
});
