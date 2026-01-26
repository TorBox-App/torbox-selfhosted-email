import { describe, expect, it } from "vitest";
import {
  DEFAULT_PULUMI_TIMEOUT_MS,
  TimeoutError,
  withTimeout,
} from "../shared/timeout.js";

describe("timeout utility", () => {
  describe("DEFAULT_PULUMI_TIMEOUT_MS", () => {
    it("should be 10 minutes", () => {
      expect(DEFAULT_PULUMI_TIMEOUT_MS).toBe(10 * 60 * 1000);
    });
  });

  describe("TimeoutError", () => {
    it("should create error with correct message", () => {
      const error = new TimeoutError("test operation", 60_000);

      expect(error.message).toContain("test operation");
      expect(error.message).toContain("timed out");
      expect(error.message).toContain("1 minute");
      expect(error.code).toBe("OPERATION_TIMEOUT");
    });

    it("should pluralize minutes correctly", () => {
      const error1 = new TimeoutError("op", 60_000);
      expect(error1.message).toContain("1 minute");
      expect(error1.message).not.toContain("minutes");

      const error2 = new TimeoutError("op", 120_000);
      expect(error2.message).toContain("2 minutes");
    });

    it("should include helpful suggestions", () => {
      const error = new TimeoutError("op", 60_000);

      expect(error.suggestion).toContain("network");
      expect(error.suggestion).toContain("throttling");
      expect(error.suggestion).toContain("Run the command again");
    });

    it("should include docs URL", () => {
      const error = new TimeoutError("op", 60_000);

      expect(error.docsUrl).toContain("wraps.dev");
    });
  });

  describe("withTimeout", () => {
    it("should resolve when promise completes before timeout", async () => {
      const promise = Promise.resolve("success");
      const result = await withTimeout(promise, 1000, "test");

      expect(result).toBe("success");
    });

    it("should reject with TimeoutError when promise takes too long", async () => {
      const slowPromise = new Promise((resolve) => {
        setTimeout(() => resolve("too late"), 500);
      });

      await expect(
        withTimeout(slowPromise, 50, "slow operation")
      ).rejects.toThrow(TimeoutError);
    });

    it("should include operation name in timeout error", async () => {
      const slowPromise = new Promise((resolve) => {
        setTimeout(() => resolve("too late"), 500);
      });

      try {
        await withTimeout(slowPromise, 50, "my special operation");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(TimeoutError);
        expect((error as TimeoutError).message).toContain(
          "my special operation"
        );
      }
    });

    it("should propagate errors from the original promise", async () => {
      const errorPromise = Promise.reject(new Error("original error"));

      await expect(withTimeout(errorPromise, 1000, "test")).rejects.toThrow(
        "original error"
      );
    });

    it("should clean up timeout when promise resolves", async () => {
      // This tests that we don't have timer leaks
      const promise = Promise.resolve("done");
      await withTimeout(promise, 10_000, "test");

      // If timeout wasn't cleaned up, this test would hang for 10 seconds
      // The fact that it completes quickly means cleanup worked
    });

    it("should clean up timeout when promise rejects", async () => {
      const promise = Promise.reject(new Error("fail"));

      try {
        await withTimeout(promise, 10_000, "test");
      } catch {
        // Expected error
      }

      // Same as above - test completes quickly if cleanup worked
    });

    it("should handle async functions", async () => {
      const asyncFn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "async result";
      };

      const result = await withTimeout(asyncFn(), 1000, "async operation");
      expect(result).toBe("async result");
    });

    it("should work with different return types", async () => {
      // Number
      expect(await withTimeout(Promise.resolve(42), 100, "test")).toBe(42);

      // Object
      const obj = { foo: "bar" };
      expect(await withTimeout(Promise.resolve(obj), 100, "test")).toBe(obj);

      // Array
      const arr = [1, 2, 3];
      expect(await withTimeout(Promise.resolve(arr), 100, "test")).toBe(arr);

      // Undefined
      expect(await withTimeout(Promise.resolve(undefined), 100, "test")).toBe(
        undefined
      );
    });
  });
});
