import { describe, expect, it } from "vitest";
import {
  cheapestPlan,
  formatUSD,
  isSESPricingPlan,
  monthlyCostForPlan,
  planComparison,
  SES_PLAN_RATES,
  SES_PRICING_PLANS,
} from "../ses-plans.js";

/**
 * Every expected number below is written out longhand from the published rates
 * (verified 2026-07-24 at https://aws.amazon.com/ses/pricing/) so that an AWS
 * rate change fails loudly here instead of silently producing a wrong
 * recommendation in front of a customer.
 *
 * Tiers are marginal: 0–10M, 10M–100M, >100M.
 *
 *   À la carte  $0/mo   $0.10 / $0.10 / $0.10 per 1K
 *   Essentials  $0/mo   $0.16 / $0.14 / $0.11 per 1K
 *   Pro         $105/mo $0.22 / $0.17 / $0.12 per 1K
 *   Enterprise  $500/mo $0.23 / $0.18 / $0.13 per 1K
 */

describe("SES_PLAN_RATES", () => {
  it("matches the published base fees and first-tier rates", () => {
    expect(SES_PLAN_RATES.NONE.monthlyBase).toBe(0);
    expect(SES_PLAN_RATES.ESSENTIALS.monthlyBase).toBe(0);
    expect(SES_PLAN_RATES.PRO.monthlyBase).toBe(105);
    expect(SES_PLAN_RATES.ENTERPRISE.monthlyBase).toBe(500);

    expect(SES_PLAN_RATES.NONE.tiers[0].per1K).toBe(0.1);
    expect(SES_PLAN_RATES.ESSENTIALS.tiers[0].per1K).toBe(0.16);
    expect(SES_PLAN_RATES.PRO.tiers[0].per1K).toBe(0.22);
    expect(SES_PLAN_RATES.ENTERPRISE.tiers[0].per1K).toBe(0.23);
  });

  it("covers exactly the four plan values the SES API reports", () => {
    expect([...SES_PRICING_PLANS]).toEqual([
      "NONE",
      "ESSENTIALS",
      "PRO",
      "ENTERPRISE",
    ]);
    expect(Object.keys(SES_PLAN_RATES).sort()).toEqual([
      "ENTERPRISE",
      "ESSENTIALS",
      "NONE",
      "PRO",
    ]);
  });
});

describe("monthlyCostForPlan", () => {
  it("prices a 50,000/mo sender on every plan", () => {
    // 50 thousand-blocks, all inside tier 1.
    expect(monthlyCostForPlan("NONE", 50_000)).toBe(5.0); // 50 * 0.10
    expect(monthlyCostForPlan("ESSENTIALS", 50_000)).toBe(8.0); // 50 * 0.16
    expect(monthlyCostForPlan("PRO", 50_000)).toBe(116.0); // 105 + 50 * 0.22
    expect(monthlyCostForPlan("ENTERPRISE", 50_000)).toBe(511.5); // 500 + 50 * 0.23
  });

  it("charges the base fee unconditionally at zero volume", () => {
    expect(monthlyCostForPlan("NONE", 0)).toBe(0);
    expect(monthlyCostForPlan("ESSENTIALS", 0)).toBe(0);
    expect(monthlyCostForPlan("PRO", 0)).toBe(105);
    expect(monthlyCostForPlan("ENTERPRISE", 0)).toBe(500);
  });

  it("applies tiers marginally, not as a flat rate on the whole volume", () => {
    // 20M on Essentials: first 10M at $0.16/1K = $1,600, next 10M at
    // $0.14/1K = $1,400, total $3,000. A flat-rate implementation would
    // charge 20,000 * 0.14 = $2,800 and fail here. This is the single most
    // likely implementation bug, so it is asserted on every plan.
    expect(monthlyCostForPlan("ESSENTIALS", 20_000_000)).toBe(3000);
    expect(monthlyCostForPlan("ESSENTIALS", 20_000_000)).not.toBe(2800);

    expect(monthlyCostForPlan("NONE", 20_000_000)).toBe(2000); // 20,000 * 0.10
    expect(monthlyCostForPlan("PRO", 20_000_000)).toBe(4005); // 105 + 2,200 + 1,700
    expect(monthlyCostForPlan("ENTERPRISE", 20_000_000)).toBe(4600); // 500 + 2,300 + 1,800
  });

  it("prices the tier-1 boundary at exactly 10M with no tier-2 spill", () => {
    expect(monthlyCostForPlan("NONE", 10_000_000)).toBe(1000); // 10,000 * 0.10
    expect(monthlyCostForPlan("ESSENTIALS", 10_000_000)).toBe(1600); // 10,000 * 0.16
    expect(monthlyCostForPlan("PRO", 10_000_000)).toBe(2305); // 105 + 2,200
    expect(monthlyCostForPlan("ENTERPRISE", 10_000_000)).toBe(2800); // 500 + 2,300
  });

  it("bills only the overage into tier 2 just past the boundary", () => {
    // 10,001,000 on Essentials: $1,600 for the first 10M plus one
    // thousand-block at $0.14 = $1,600.14.
    expect(monthlyCostForPlan("ESSENTIALS", 10_001_000)).toBe(1600.14);
    // The same one-block overage on à la carte stays at $0.10.
    expect(monthlyCostForPlan("NONE", 10_001_000)).toBe(1000.1);
  });

  it("prices 100M — the tier-2 ceiling", () => {
    expect(monthlyCostForPlan("NONE", 100_000_000)).toBe(10_000); // 100,000 * 0.10
    expect(monthlyCostForPlan("ESSENTIALS", 100_000_000)).toBe(14_200); // 1,600 + 12,600
    expect(monthlyCostForPlan("PRO", 100_000_000)).toBe(17_605); // 105 + 2,200 + 15,300
    expect(monthlyCostForPlan("ENTERPRISE", 100_000_000)).toBe(19_000); // 500 + 2,300 + 16,200
  });

  it("reaches the third tier above 100M", () => {
    // 200M: tier 1 (10M) + tier 2 (90M) + tier 3 (100M).
    expect(monthlyCostForPlan("NONE", 200_000_000)).toBe(20_000); // 200,000 * 0.10
    expect(monthlyCostForPlan("ESSENTIALS", 200_000_000)).toBe(25_200); // 14,200 + 11,000
    expect(monthlyCostForPlan("PRO", 200_000_000)).toBe(29_605); // 17,605 + 12,000
    expect(monthlyCostForPlan("ENTERPRISE", 200_000_000)).toBe(32_000); // 19,000 + 13,000
  });

  it("clamps negative volume to zero rather than crediting the bill", () => {
    expect(monthlyCostForPlan("NONE", -1_000_000)).toBe(0);
    expect(monthlyCostForPlan("PRO", -1_000_000)).toBe(105);
  });

  it("returns exact cents instead of leaking binary-float noise", () => {
    // The per-1K rates are not representable in binary floating point, so the
    // unrounded products below come back as 0.30000000000000004,
    // 5.6000000000000005 and 114.46000000000001. Each assertion here fails on
    // an implementation that skips the round-to-cents step.
    expect(monthlyCostForPlan("NONE", 3000)).toBe(0.3); // 3 * 0.10
    expect(monthlyCostForPlan("ESSENTIALS", 35_000)).toBe(5.6); // 35 * 0.16
    expect(monthlyCostForPlan("PRO", 43_000)).toBe(114.46); // 105 + 43 * 0.22
    expect(monthlyCostForPlan("ENTERPRISE", 291_000)).toBe(566.93); // 500 + 291 * 0.23
  });
});

describe("cheapestPlan", () => {
  it("picks à la carte for a 50,000/mo sender", () => {
    expect(cheapestPlan(50_000)).toBe("NONE");
  });

  it("still picks à la carte at 100M, where Pro's base fee is fully amortized", () => {
    // Longhand so a rate change fails loudly:
    //   NONE       $10,000.00
    //   ESSENTIALS $14,200.00
    //   PRO        $17,605.00
    //   ENTERPRISE $19,000.00
    // Amortizing Pro's $105 base over 100M emails costs ~$0.001/1K, which is
    // nowhere near closing a $0.10-vs-$0.22 first-tier gap.
    expect(cheapestPlan(100_000_000)).toBe("NONE");
    expect(monthlyCostForPlan("NONE", 100_000_000)).toBe(10_000);
    expect(monthlyCostForPlan("ESSENTIALS", 100_000_000)).toBe(14_200);
    expect(monthlyCostForPlan("PRO", 100_000_000)).toBe(17_605);
    expect(monthlyCostForPlan("ENTERPRISE", 100_000_000)).toBe(19_000);
  });

  it("picks à la carte at every volume, because $0.10 flat undercuts every tier of every other plan", () => {
    // This is the finding the command exists to surface. If AWS ever prices a
    // tier below $0.10/1K this test breaks, which is the intent.
    for (const volume of [
      0, 1, 1000, 50_000, 1_000_000, 9_999_999, 10_000_000, 10_000_001,
      20_000_000, 99_999_999, 100_000_000, 100_000_001, 500_000_000,
      1_000_000_000,
    ]) {
      expect(cheapestPlan(volume)).toBe("NONE");
    }
  });

  it("never returns a plan that costs more than another plan", () => {
    for (const volume of [0, 250_000, 50_000_000, 750_000_000]) {
      const winner = monthlyCostForPlan(cheapestPlan(volume), volume);
      for (const plan of SES_PRICING_PLANS) {
        expect(winner).toBeLessThanOrEqual(monthlyCostForPlan(plan, volume));
      }
    }
  });
});

describe("planComparison", () => {
  it("prices all four plans and flags the current and cheapest rows", () => {
    const comparison = planComparison(50_000, "ESSENTIALS");

    expect(comparison.emailsPerMonth).toBe(50_000);
    expect(comparison.currentPlan).toBe("ESSENTIALS");
    expect(comparison.cheapestPlan).toBe("NONE");
    expect(comparison.rows.map((r) => r.plan)).toEqual([
      "NONE",
      "ESSENTIALS",
      "PRO",
      "ENTERPRISE",
    ]);
    expect(comparison.rows.map((r) => r.monthlyCost)).toEqual([
      5.0, 8.0, 116.0, 511.5,
    ]);
    expect(
      comparison.rows.filter((r) => r.isCurrent).map((r) => r.plan)
    ).toEqual(["ESSENTIALS"]);
    expect(
      comparison.rows.filter((r) => r.isCheapest).map((r) => r.plan)
    ).toEqual(["NONE"]);
  });

  it("computes each plan's delta against the current plan", () => {
    const comparison = planComparison(50_000, "ESSENTIALS");
    const delta = (plan: string) =>
      comparison.rows.find((r) => r.plan === plan)?.deltaVsCurrent;

    expect(delta("NONE")).toBe(-3.0); // $5.00 - $8.00
    expect(delta("ESSENTIALS")).toBe(0); // the current plan is its own baseline
    expect(delta("PRO")).toBe(108.0); // $116.00 - $8.00
    expect(delta("ENTERPRISE")).toBe(503.5); // $511.50 - $8.00
  });

  it("annualizes the savings from the defaulted-Essentials case", () => {
    // The headline number the command puts in front of a customer.
    const comparison = planComparison(50_000, "ESSENTIALS");
    expect(comparison.annualSavings).toBe(36); // ($8.00 - $5.00) * 12

    // A 500K/mo sender: $80.00 vs $50.00 => $360/yr per Region.
    const bigger = planComparison(500_000, "ESSENTIALS");
    expect(bigger.rows.find((r) => r.plan === "ESSENTIALS")?.monthlyCost).toBe(
      80
    );
    expect(bigger.rows.find((r) => r.plan === "NONE")?.monthlyCost).toBe(50);
    expect(bigger.annualSavings).toBe(360);
  });

  it("reports zero savings when the account is already on the cheapest plan", () => {
    const comparison = planComparison(50_000, "NONE");
    expect(comparison.annualSavings).toBe(0);
    expect(comparison.rows.find((r) => r.plan === "NONE")?.deltaVsCurrent).toBe(
      0
    );
  });

  it("omits deltas and savings when the current plan could not be determined", () => {
    // The realistic degraded case: GetAccount returned no PricingAttributes.
    const comparison = planComparison(50_000);

    expect(comparison.currentPlan).toBeUndefined();
    expect(comparison.annualSavings).toBeUndefined();
    expect(comparison.rows.every((r) => r.deltaVsCurrent === undefined)).toBe(
      true
    );
    expect(comparison.rows.every((r) => r.isCurrent === false)).toBe(true);
    // Costs and the recommendation are still usable without a current plan.
    expect(comparison.cheapestPlan).toBe("NONE");
    expect(comparison.rows.map((r) => r.monthlyCost)).toEqual([
      5.0, 8.0, 116.0, 511.5,
    ]);
  });

  it("carries the bundled-inclusions caveat for the base-fee plans", () => {
    const comparison = planComparison(50_000, "ESSENTIALS");
    const includes = (plan: string) =>
      comparison.rows.find((r) => r.plan === plan)?.includes;

    // Pro and Enterprise bundle add-ons the cost math gives no credit for,
    // which is why the command recommends rather than auto-applies.
    expect(includes("PRO")).toContain("dedicated IP");
    expect(includes("ENTERPRISE")).toContain("dedicated IP");
    expect(includes("NONE")).toBeUndefined();
    expect(includes("ESSENTIALS")).toBeUndefined();
  });
});

describe("isSESPricingPlan", () => {
  it("accepts the four API values", () => {
    expect(isSESPricingPlan("NONE")).toBe(true);
    expect(isSESPricingPlan("ESSENTIALS")).toBe(true);
    expect(isSESPricingPlan("PRO")).toBe(true);
    expect(isSESPricingPlan("ENTERPRISE")).toBe(true);
  });

  it("rejects anything else, including case variants and near-misses", () => {
    expect(isSESPricingPlan("BOGUS")).toBe(false);
    expect(isSESPricingPlan("none")).toBe(false);
    expect(isSESPricingPlan("Essentials")).toBe(false);
    expect(isSESPricingPlan("A_LA_CARTE")).toBe(false);
    expect(isSESPricingPlan("")).toBe(false);
  });
});

describe("formatUSD", () => {
  it("always shows cents and thousands separators", () => {
    expect(formatUSD(5)).toBe("$5.00");
    expect(formatUSD(511.5)).toBe("$511.50");
    expect(formatUSD(14_200)).toBe("$14,200.00");
    expect(formatUSD(0)).toBe("$0.00");
  });

  it("renders a negative delta with the sign ahead of the amount", () => {
    expect(formatUSD(-3)).toBe("$-3.00");
  });
});
