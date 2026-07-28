import { describe, expect, it } from "vitest";
import { SES_PLANS, type SesPlanId, sesSendingCost } from "@/lib/ses-cost";

/**
 * AWS prices the SES plans as marginal volume bands, not a flat rate. These
 * expectations are computed by hand from the published tier table so a
 * refactor that reintroduces flat-rate math fails here.
 */
describe("sesSendingCost", () => {
  it("prices à la carte at a single rate with no tiers", () => {
    expect(sesSendingCost(SES_PLANS.alacarte, 1_000_000)).toBeCloseTo(100, 2);
    expect(sesSendingCost(SES_PLANS.alacarte, 500_000_000)).toBeCloseTo(
      50_000,
      2
    );
  });

  it("charges the headline rate up to the first tier ceiling", () => {
    expect(sesSendingCost(SES_PLANS.essentials, 10_000_000)).toBeCloseTo(
      1600,
      2
    );
  });

  it("charges the second tier only on volume above 10M", () => {
    // 10M x $0.16/1K = $1,600, then 10M x $0.14/1K = $1,400.
    expect(sesSendingCost(SES_PLANS.essentials, 20_000_000)).toBeCloseTo(
      3000,
      2
    );
  });

  it("walks all three tiers past 100M", () => {
    // 10M x $0.23 + 90M x $0.18 + 50M x $0.13, per 1K.
    expect(sesSendingCost(SES_PLANS.enterprise, 150_000_000)).toBeCloseTo(
      25_000,
      2
    );
  });

  it("never applies the headline rate to the whole volume above the first tier", () => {
    const flat = (20_000_000 / 1000) * SES_PLANS.pro.perThousandEmails;
    expect(sesSendingCost(SES_PLANS.pro, 20_000_000)).toBeLessThan(flat);
  });

  it("returns zero for zero and negative volume", () => {
    expect(sesSendingCost(SES_PLANS.essentials, 0)).toBe(0);
    expect(sesSendingCost(SES_PLANS.essentials, -1)).toBe(0);
  });
});

describe("SES_PLANS tier tables", () => {
  const ids = Object.keys(SES_PLANS) as SesPlanId[];

  it.each(ids)(
    "%s headline rate equals its first tier rate",
    (id: SesPlanId) => {
      const plan = SES_PLANS[id];
      expect(plan.tiers[0].perThousandEmails).toBe(plan.perThousandEmails);
    }
  );

  it.each(ids)("%s tier ceilings ascend and end unbounded", (id: SesPlanId) => {
    const { tiers } = SES_PLANS[id];
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i].upTo).toBeGreaterThan(tiers[i - 1].upTo);
    }
    expect(tiers.at(-1)?.upTo).toBe(Number.POSITIVE_INFINITY);
  });

  it.each(ids)("%s rates decrease as volume grows", (id: SesPlanId) => {
    const { tiers } = SES_PLANS[id];
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i].perThousandEmails).toBeLessThan(
        tiers[i - 1].perThousandEmails
      );
    }
  });
});
