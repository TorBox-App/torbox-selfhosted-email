import { ALL_EVENT_TYPES } from "@wraps/core";
import { describe, expect, it } from "vitest";
import { WrapsError } from "../../../utils/shared/errors.js";
import { resolveMatchingEventTypes, validateEventTypes } from "../ses.js";

/**
 * Plan 182: `eventTracking.events` was declared on the type but never read —
 * `createSESResources` always sent the same hardcoded ten-type array to SES
 * regardless of what the customer configured. These tests pin the fix:
 * `config.eventTypes` now drives `matchingEventTypes`, defaulting to all ten
 * (byte-identical to the old hardcoded behavior), with an empty array also
 * meaning "all" (matching packages/pulumi), and BOUNCE/COMPLAINT guarded
 * against being dropped since a Suppressed webhook event arrives as a Bounce
 * with bounceSubType === "Suppressed".
 */

describe("resolveMatchingEventTypes", () => {
  it("defaults to all ten event types, in order, when eventTypes is undefined", () => {
    expect(resolveMatchingEventTypes(undefined)).toEqual([
      "SEND",
      "DELIVERY",
      "OPEN",
      "CLICK",
      "BOUNCE",
      "COMPLAINT",
      "REJECT",
      "RENDERING_FAILURE",
      "DELIVERY_DELAY",
      "SUBSCRIPTION",
    ]);
  });

  it("matches the ALL_EVENT_TYPES constant exactly (regression guard for the default)", () => {
    expect(resolveMatchingEventTypes(undefined)).toEqual(ALL_EVENT_TYPES);
    expect(resolveMatchingEventTypes(undefined)).toHaveLength(10);
  });

  it("returns all ten event types when eventTypes is an empty array", () => {
    expect(resolveMatchingEventTypes([])).toEqual(ALL_EVENT_TYPES);
  });

  it("returns exactly the configured subset when eventTypes is non-empty", () => {
    const subset = resolveMatchingEventTypes([
      "SEND",
      "DELIVERY",
      "BOUNCE",
      "COMPLAINT",
    ]);
    expect(subset).toEqual(["SEND", "DELIVERY", "BOUNCE", "COMPLAINT"]);
  });

  it("drops OPEN/CLICK without dropping anything else when only those are excluded", () => {
    const withoutEngagement = ALL_EVENT_TYPES.filter(
      (t) => t !== "OPEN" && t !== "CLICK"
    );
    expect(resolveMatchingEventTypes(withoutEngagement)).toEqual(
      withoutEngagement
    );
  });
});

describe("validateEventTypes", () => {
  it("does not throw when eventTypes is undefined (defaults to all)", () => {
    expect(() => validateEventTypes(undefined)).not.toThrow();
  });

  it("does not throw when eventTypes is an empty array (means all)", () => {
    expect(() => validateEventTypes([])).not.toThrow();
  });

  it("does not throw when eventTypes includes both BOUNCE and COMPLAINT", () => {
    expect(() =>
      validateEventTypes(["SEND", "BOUNCE", "COMPLAINT"])
    ).not.toThrow();
  });

  it("rejects a config that omits BOUNCE", () => {
    expect(() => validateEventTypes(["SEND", "DELIVERY", "COMPLAINT"])).toThrow(
      WrapsError
    );
    try {
      validateEventTypes(["SEND", "DELIVERY", "COMPLAINT"]);
      throw new Error("expected validateEventTypes to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(WrapsError);
      expect((error as WrapsError).code).toBe(
        "EVENT_TYPES_MISSING_SUPPRESSION_EVENTS"
      );
      expect((error as WrapsError).message).toContain("BOUNCE");
    }
  });

  it("rejects a config that omits COMPLAINT", () => {
    expect(() => validateEventTypes(["SEND", "DELIVERY", "BOUNCE"])).toThrow(
      WrapsError
    );
    try {
      validateEventTypes(["SEND", "DELIVERY", "BOUNCE"]);
      throw new Error("expected validateEventTypes to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(WrapsError);
      expect((error as WrapsError).message).toContain("COMPLAINT");
    }
  });

  it("does not require SUBSCRIPTION (unrelated to suppression — preference-center changes only)", () => {
    expect(() =>
      validateEventTypes(["SEND", "DELIVERY", "BOUNCE", "COMPLAINT"])
    ).not.toThrow();
  });
});
