import { describe, expect, it } from "vitest";
import { FEATURE_PLANS } from "../middleware/plan-gate";

describe("FEATURE_PLANS", () => {
  it("maps sso to scale", () => {
    expect(FEATURE_PLANS["sso"]).toBe("scale");
  });
});
