import { describe, expect, it } from "vitest";
import { FILTER_FIELDS } from "@/lib/segments";

describe("FILTER_FIELDS properties entry", () => {
  const propertiesField = FILTER_FIELDS.find((f) => f.id === "properties");

  it("contains greaterThan operator", () => {
    expect(propertiesField?.operators).toContain("greaterThan");
  });

  it("contains all four numeric operators", () => {
    expect(propertiesField?.operators).toContain("greaterThan");
    expect(propertiesField?.operators).toContain("lessThan");
    expect(propertiesField?.operators).toContain("greaterThanOrEqual");
    expect(propertiesField?.operators).toContain("lessThanOrEqual");
  });
});
