import {
  generateConfirmationToken,
  generateConfirmationUrl,
  verifyConfirmationToken,
} from "@wraps/email";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Confirmation Token", () => {
  beforeEach(() => {
    vi.stubEnv("UNSUBSCRIBE_SECRET", "test-secret-for-confirmation");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://test.wraps.dev");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("generateConfirmationToken", () => {
    it("should generate a valid JWT token", async () => {
      const token = await generateConfirmationToken(
        "contact-123",
        "org-456",
        "topic-789"
      );

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3); // JWT format: header.payload.signature
    });

    it("should generate different tokens for different inputs", async () => {
      const token1 = await generateConfirmationToken(
        "contact-1",
        "org-1",
        "topic-1"
      );
      const token2 = await generateConfirmationToken(
        "contact-2",
        "org-1",
        "topic-1"
      );

      expect(token1).not.toBe(token2);
    });
  });

  describe("verifyConfirmationToken", () => {
    it("should verify a valid token and return payload", async () => {
      const token = await generateConfirmationToken(
        "contact-123",
        "org-456",
        "topic-789"
      );

      const payload = await verifyConfirmationToken(token);

      expect(payload).not.toBeNull();
      expect(payload?.cid).toBe("contact-123");
      expect(payload?.oid).toBe("org-456");
      expect(payload?.tid).toBe("topic-789");
      expect(payload?.type).toBe("confirm");
    });

    it("should return null for invalid token", async () => {
      const payload = await verifyConfirmationToken("invalid-token");

      expect(payload).toBeNull();
    });

    it("should return null for tampered token", async () => {
      const token = await generateConfirmationToken(
        "contact-123",
        "org-456",
        "topic-789"
      );

      // Tamper with the token
      const tamperedToken = `${token.slice(0, -5)}xxxxx`;

      const payload = await verifyConfirmationToken(tamperedToken);

      expect(payload).toBeNull();
    });

    it("should return null for token signed with different secret", async () => {
      // Generate token with one secret
      const token = await generateConfirmationToken(
        "contact-123",
        "org-456",
        "topic-789"
      );

      // Change the secret
      vi.stubEnv("UNSUBSCRIBE_SECRET", "different-secret");

      const payload = await verifyConfirmationToken(token);

      expect(payload).toBeNull();
    });

    it("should return null for unsubscribe token type", async () => {
      // Create a token that looks like an unsubscribe token (type: "unsub")
      // by importing and using the unsubscribe token generator
      const { generateUnsubscribeToken } = await import("../unsubscribe-token");
      const unsubToken = await generateUnsubscribeToken(
        "contact-123",
        "org-456",
        "topic-789"
      );

      // Verify with confirmation token verifier should fail
      const payload = await verifyConfirmationToken(unsubToken);

      expect(payload).toBeNull();
    });
  });

  describe("generateConfirmationUrl", () => {
    it("should generate a full URL with token", async () => {
      const url = await generateConfirmationUrl(
        "contact-123",
        "org-456",
        "topic-789"
      );

      expect(url).toMatch(/^https:\/\/test\.wraps\.dev\/confirm\/.+$/);
    });

    it("should use default URL when env not set", async () => {
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "");

      const url = await generateConfirmationUrl(
        "contact-123",
        "org-456",
        "topic-789"
      );

      expect(url).toMatch(/^https:\/\/wraps\.dev\/confirm\/.+$/);
    });

    it("should generate URL with verifiable token", async () => {
      const url = await generateConfirmationUrl(
        "contact-123",
        "org-456",
        "topic-789"
      );

      // Extract token from URL
      const token = url.split("/confirm/")[1];

      const payload = await verifyConfirmationToken(token);

      expect(payload).not.toBeNull();
      expect(payload?.cid).toBe("contact-123");
      expect(payload?.oid).toBe("org-456");
      expect(payload?.tid).toBe("topic-789");
    });
  });

  describe("token expiration", () => {
    it("should create token with 48 hour expiration", async () => {
      const token = await generateConfirmationToken(
        "contact-123",
        "org-456",
        "topic-789"
      );

      // Decode token payload (without verification) to check exp
      const [, payloadBase64] = token.split(".");
      const payloadJson = Buffer.from(payloadBase64, "base64url").toString();
      const payload = JSON.parse(payloadJson);

      const expectedExp = Math.floor(Date.now() / 1000) + 48 * 60 * 60;

      // Allow 10 second tolerance
      expect(payload.exp).toBeGreaterThan(expectedExp - 10);
      expect(payload.exp).toBeLessThan(expectedExp + 10);
    });
  });
});
