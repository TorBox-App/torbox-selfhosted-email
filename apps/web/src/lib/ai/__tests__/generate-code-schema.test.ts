import { describe, expect, it } from "vitest";
import { generateCodeBodySchema } from "../generate-code-schema";

const MIN_MESSAGES = [{ role: "user", content: "hello" }];

describe("generateCodeBodySchema", () => {
  describe("conversationId", () => {
    it("accepts a valid UUID", () => {
      const result = generateCodeBodySchema.safeParse({
        messages: MIN_MESSAGES,
        conversationId: "550e8400-e29b-41d4-a716-446655440000",
      });
      expect(result.success).toBe(true);
    });

    it("accepts undefined (no conversationId)", () => {
      const result = generateCodeBodySchema.safeParse({
        messages: MIN_MESSAGES,
        conversationId: undefined,
      });
      expect(result.success).toBe(true);
    });

    it("accepts omitted conversationId", () => {
      const result = generateCodeBodySchema.safeParse({
        messages: MIN_MESSAGES,
      });
      expect(result.success).toBe(true);
    });

    // Regression: null was sent when aiConversationId state was null before the
    // first message, causing Zod to reject with a 400 ("null is not a string").
    it("rejects null conversationId", () => {
      const result = generateCodeBodySchema.safeParse({
        messages: MIN_MESSAGES,
        conversationId: null,
      });
      expect(result.success).toBe(false);
    });

    it("rejects a non-UUID string conversationId", () => {
      const result = generateCodeBodySchema.safeParse({
        messages: MIN_MESSAGES,
        conversationId: "not-a-uuid",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("messages", () => {
    it("requires at least one message", () => {
      const result = generateCodeBodySchema.safeParse({ messages: [] });
      expect(result.success).toBe(false);
    });

    it("accepts a non-empty messages array", () => {
      const result = generateCodeBodySchema.safeParse({
        messages: MIN_MESSAGES,
      });
      expect(result.success).toBe(true);
    });
  });
});
