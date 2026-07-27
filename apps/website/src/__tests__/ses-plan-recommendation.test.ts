import { describe, expect, it } from "vitest";
import { recommendSesPlan } from "@/lib/ses-cost";

describe("recommendSesPlan", () => {
  it("recommends à la carte over Essentials at 50,000 emails/month", () => {
    const result = recommendSesPlan(50_000, "essentials");
    expect(result.cheapest).toBe("alacarte");
    expect(result.selectedMonthlyCost).toBe(8.0);
    expect(result.cheapestMonthlyCost).toBe(5.0);
    expect(result.monthlySavings).toBe(3.0);
    expect(result.annualSavings).toBe(36.0);
  });

  it("reports zero savings when à la carte is already selected", () => {
    const result = recommendSesPlan(50_000, "alacarte");
    expect(result.cheapest).toBe("alacarte");
    expect(result.selectedMonthlyCost).toBe(5.0);
    expect(result.cheapestMonthlyCost).toBe(5.0);
    expect(result.monthlySavings).toBe(0);
    expect(result.annualSavings).toBe(0);
  });

  it("recommends à la carte over Pro's base fee at 1,000,000 emails/month", () => {
    const result = recommendSesPlan(1_000_000, "pro");
    expect(result.cheapest).toBe("alacarte");
    expect(result.selectedMonthlyCost).toBe(325.0);
    expect(result.cheapestMonthlyCost).toBe(100.0);
    expect(result.annualSavings).toBe(2700.0);
  });

  it("still recommends à la carte when a dedicated IP is bundled into Pro", () => {
    const result = recommendSesPlan(100_000, "pro", true);
    expect(result.cheapest).toBe("alacarte");
    expect(result.cheapestMonthlyCost).toBe(34.95);
    expect(result.selectedMonthlyCost).toBe(127.0);
  });

  it("still charges Enterprise's unconditional base fee at zero volume", () => {
    const result = recommendSesPlan(0, "enterprise");
    expect(result.cheapest).toBe("alacarte");
    expect(result.cheapestMonthlyCost).toBe(0);
    expect(result.selectedMonthlyCost).toBe(500.0);
  });
});
