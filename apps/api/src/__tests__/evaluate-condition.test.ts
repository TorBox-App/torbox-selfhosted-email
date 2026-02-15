/**
 * evaluateCondition Tests
 *
 * Tests the condition evaluation function from workflow-processor,
 * focusing on the newly added operators.
 */

import { describe, expect, it } from "vitest";
import { evaluateCondition } from "../(ee)/workers/workflow-processor";

describe("evaluateCondition", () => {
  // ════════════════════════════════════════════════════════
  // Existing operators (regression tests)
  // ════════════════════════════════════════════════════════

  it("equals — matches equal strings", () => {
    expect(evaluateCondition("hello", "equals", "hello")).toBe(true);
    expect(evaluateCondition("hello", "equals", "world")).toBe(false);
  });

  it("not_equals — rejects equal strings", () => {
    expect(evaluateCondition("hello", "not_equals", "world")).toBe(true);
    expect(evaluateCondition("hello", "not_equals", "hello")).toBe(false);
  });

  it("contains — checks substring presence", () => {
    expect(evaluateCondition("hello world", "contains", "world")).toBe(true);
    expect(evaluateCondition("hello", "contains", "xyz")).toBe(false);
  });

  it("greater_than — numeric comparison", () => {
    expect(evaluateCondition(10, "greater_than", 5)).toBe(true);
    expect(evaluateCondition(5, "greater_than", 10)).toBe(false);
    expect(evaluateCondition(5, "greater_than", 5)).toBe(false);
  });

  it("less_than — numeric comparison", () => {
    expect(evaluateCondition(3, "less_than", 5)).toBe(true);
    expect(evaluateCondition(5, "less_than", 3)).toBe(false);
  });

  // ════════════════════════════════════════════════════════
  // New operators
  // ════════════════════════════════════════════════════════

  describe("greater_than_or_equals", () => {
    it("returns true when greater", () => {
      expect(evaluateCondition(10, "greater_than_or_equals", 5)).toBe(true);
    });

    it("returns true when equal", () => {
      expect(evaluateCondition(5, "greater_than_or_equals", 5)).toBe(true);
    });

    it("returns false when less", () => {
      expect(evaluateCondition(3, "greater_than_or_equals", 5)).toBe(false);
    });

    it("handles string numbers", () => {
      expect(evaluateCondition("10", "greater_than_or_equals", "5")).toBe(true);
      expect(evaluateCondition("5", "greater_than_or_equals", "5")).toBe(true);
    });
  });

  describe("less_than_or_equals", () => {
    it("returns true when less", () => {
      expect(evaluateCondition(3, "less_than_or_equals", 5)).toBe(true);
    });

    it("returns true when equal", () => {
      expect(evaluateCondition(5, "less_than_or_equals", 5)).toBe(true);
    });

    it("returns false when greater", () => {
      expect(evaluateCondition(10, "less_than_or_equals", 5)).toBe(false);
    });
  });

  describe("is_true", () => {
    it('returns true for "true" string', () => {
      expect(evaluateCondition("true", "is_true", undefined)).toBe(true);
    });

    it('returns true for "1" string', () => {
      expect(evaluateCondition("1", "is_true", undefined)).toBe(true);
    });

    it("returns true for boolean true", () => {
      expect(evaluateCondition(true, "is_true", undefined)).toBe(true);
    });

    it('returns false for "false" string', () => {
      expect(evaluateCondition("false", "is_true", undefined)).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(evaluateCondition("", "is_true", undefined)).toBe(false);
    });

    it("returns false for null", () => {
      expect(evaluateCondition(null, "is_true", undefined)).toBe(false);
    });
  });

  describe("is_false", () => {
    it('returns true for "false" string', () => {
      expect(evaluateCondition("false", "is_false", undefined)).toBe(true);
    });

    it('returns true for "0" string', () => {
      expect(evaluateCondition("0", "is_false", undefined)).toBe(true);
    });

    it("returns true for empty string", () => {
      expect(evaluateCondition("", "is_false", undefined)).toBe(true);
    });

    it('returns false for "true" string', () => {
      expect(evaluateCondition("true", "is_false", undefined)).toBe(false);
    });

    it("returns false for non-empty non-false string", () => {
      expect(evaluateCondition("hello", "is_false", undefined)).toBe(false);
    });

    it("returns true for boolean false", () => {
      expect(evaluateCondition(false, "is_false", undefined)).toBe(true);
    });

    it("returns true for null", () => {
      expect(evaluateCondition(null, "is_false", undefined)).toBe(true);
    });

    it("returns true for undefined", () => {
      expect(evaluateCondition(undefined, "is_false", undefined)).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════
  // Edge cases
  // ════════════════════════════════════════════════════════

  it("unknown operator returns false", () => {
    expect(evaluateCondition("a", "unknown_op", "b")).toBe(false);
  });

  it("null/undefined field values handled gracefully", () => {
    expect(evaluateCondition(null, "equals", "")).toBe(true);
    expect(evaluateCondition(undefined, "is_not_set", undefined)).toBe(true);
    expect(evaluateCondition(undefined, "is_set", undefined)).toBe(false);
  });
});
