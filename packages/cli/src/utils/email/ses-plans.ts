/**
 * SES pricing plans — rate table and cost math.
 *
 * On 2026-07-21 AWS introduced pricing plans for SES. The plan is set per AWS
 * account, per Region, and new accounts (plus accounts with no metered SES
 * activity since 2025-06-01) are DEFAULTED onto Essentials at $0.16/1K rather
 * than the à-la-carte $0.10/1K. Nothing on the bill says "you are paying more
 * than you need to," which is what `wraps email plan` exists to surface.
 *
 * Rates verified 2026-07-24 against https://aws.amazon.com/ses/pricing/.
 * AWS states the tiers are marginal: each rate applies only to the emails
 * inside that tier, not to the whole month's volume.
 *
 * These rates will also live in `apps/website/src/config/ses-pricing.ts`, and
 * the duplication is deliberate — `apps/website` and `packages/cli` share no
 * package, and taking on a dependency for four numbers is a worse trade than
 * two copies with dated headers. When AWS changes rates, both files change.
 *
 * Pure functions only: no AWS calls, no I/O.
 */

/**
 * The four plan values SES reports in `GetAccount`'s
 * `PricingAttributes.CurrentPlan`. Declared locally rather than imported from
 * `@aws-sdk/client-sesv2` so this module stays I/O- and SDK-free; the union is
 * identical to the SDK's `PricingPlan`.
 */
export type SESPricingPlan = "ENTERPRISE" | "ESSENTIALS" | "NONE" | "PRO";

/** Every plan value, in the order they should be rendered (cheapest first). */
export const SES_PRICING_PLANS: readonly SESPricingPlan[] = [
  "NONE",
  "ESSENTIALS",
  "PRO",
  "ENTERPRISE",
] as const;

/** A marginal pricing tier: `per1K` applies to volume up to `upTo`. */
export type SESPlanTier = {
  /** Upper bound of this tier, in emails per month. */
  upTo: number;
  /** USD per 1,000 emails inside this tier. */
  per1K: number;
};

export type SESPlanRate = {
  /** Human-readable plan name for output. */
  label: string;
  /** Fixed USD charged every month regardless of volume. */
  monthlyBase: number;
  /** Marginal sending tiers, ascending. */
  tiers: readonly SESPlanTier[];
  /** What the base fee bundles, for the "cheapest isn't always best" caveat. */
  includes?: string;
};

const TIER_1_LIMIT = 10_000_000;
const TIER_2_LIMIT = 100_000_000;
const UNBOUNDED = Number.POSITIVE_INFINITY;

/**
 * Rate table. Keyed by the `PricingPlan` value the SES API reports, so a
 * response value can be used as a lookup key without translation.
 */
export const SES_PLAN_RATES: Record<SESPricingPlan, SESPlanRate> = {
  NONE: {
    label: "À la carte",
    monthlyBase: 0,
    tiers: [{ upTo: UNBOUNDED, per1K: 0.1 }],
  },
  ESSENTIALS: {
    label: "Essentials",
    monthlyBase: 0,
    tiers: [
      { upTo: TIER_1_LIMIT, per1K: 0.16 },
      { upTo: TIER_2_LIMIT, per1K: 0.14 },
      { upTo: UNBOUNDED, per1K: 0.11 },
    ],
  },
  PRO: {
    label: "Pro",
    monthlyBase: 105,
    tiers: [
      { upTo: TIER_1_LIMIT, per1K: 0.22 },
      { upTo: TIER_2_LIMIT, per1K: 0.17 },
      { upTo: UNBOUNDED, per1K: 0.12 },
    ],
    includes:
      "1 domain, 1 managed dedicated IP, 5 seed-list tests, 2,500 API validations/mo",
  },
  ENTERPRISE: {
    label: "Enterprise",
    monthlyBase: 500,
    tiers: [
      { upTo: TIER_1_LIMIT, per1K: 0.23 },
      { upTo: TIER_2_LIMIT, per1K: 0.18 },
      { upTo: UNBOUNDED, per1K: 0.13 },
    ],
    includes:
      "5 domains, 12 managed dedicated IPs, 25 seed-list tests, 5,000 API validations/mo, multi-Region and tenant support",
  },
};

/** Round to whole cents so money comparisons don't trip on float noise. */
function roundCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** Is this a value SES would actually report? */
export function isSESPricingPlan(value: string): value is SESPricingPlan {
  return (SES_PRICING_PLANS as readonly string[]).includes(value);
}

/**
 * Monthly USD cost of `emailsPerMonth` on `plan`: the base fee plus the
 * graduated per-1K sending cost.
 *
 * The tiers are marginal, not flat — an account sending 20M on Essentials pays
 * $0.16/1K on the first 10M and $0.14/1K on the next 10M, for $3,000. Applying
 * a single rate to the whole volume would understate it as $2,800.
 */
export function monthlyCostForPlan(
  plan: SESPricingPlan,
  emailsPerMonth: number
): number {
  const rate = SES_PLAN_RATES[plan];
  const volume = Math.max(0, emailsPerMonth);

  let remaining = volume;
  let previousLimit = 0;
  let sendingCost = 0;

  for (const tier of rate.tiers) {
    if (remaining <= 0) {
      break;
    }
    const tierCapacity = tier.upTo - previousLimit;
    const inThisTier = Math.min(remaining, tierCapacity);
    sendingCost += (inThisTier / 1000) * tier.per1K;
    remaining -= inThisTier;
    previousLimit = tier.upTo;
  }

  return roundCents(rate.monthlyBase + sendingCost);
}

/**
 * The plan with the lowest monthly cost at this volume.
 *
 * CAVEAT: this compares *sending cost only*. Pro and Enterprise bundle managed
 * dedicated IPs, seed-list tests, and API validations that have real standalone
 * value (a managed dedicated IP alone is ~$15/mo à la carte), and this function
 * gives them no credit. That is precisely why `wraps email plan` recommends
 * rather than auto-applies — a customer already buying those add-ons has a
 * different break-even.
 *
 * Ties resolve toward the earlier entry in `SES_PRICING_PLANS`, i.e. toward the
 * plan with the smaller commitment.
 */
export function cheapestPlan(emailsPerMonth: number): SESPricingPlan {
  let best: SESPricingPlan = "NONE";
  let bestCost = monthlyCostForPlan("NONE", emailsPerMonth);

  for (const plan of SES_PRICING_PLANS) {
    const cost = monthlyCostForPlan(plan, emailsPerMonth);
    if (cost < bestCost) {
      best = plan;
      bestCost = cost;
    }
  }

  return best;
}

export type SESPlanComparisonRow = {
  plan: SESPricingPlan;
  label: string;
  monthlyBase: number;
  /** Total monthly USD at the compared volume. */
  monthlyCost: number;
  /**
   * `monthlyCost` minus the current plan's cost. Negative means this plan is
   * cheaper than what the account is on today. `undefined` when the current
   * plan is unknown.
   */
  deltaVsCurrent?: number;
  isCurrent: boolean;
  isCheapest: boolean;
  includes?: string;
};

export type SESPlanComparison = {
  emailsPerMonth: number;
  currentPlan?: SESPricingPlan;
  cheapestPlan: SESPricingPlan;
  rows: SESPlanComparisonRow[];
  /**
   * Annualized USD saved by moving from `currentPlan` to `cheapestPlan`.
   * `0` when already on the cheapest plan, `undefined` when the current plan
   * is unknown.
   */
  annualSavings?: number;
};

/**
 * All four plans priced at `emailsPerMonth`, with each one's delta against the
 * account's current plan. This is the shape both the human table and the
 * `--json` contract render from.
 */
export function planComparison(
  emailsPerMonth: number,
  currentPlan?: SESPricingPlan
): SESPlanComparison {
  const cheapest = cheapestPlan(emailsPerMonth);
  const currentCost = currentPlan
    ? monthlyCostForPlan(currentPlan, emailsPerMonth)
    : undefined;

  const rows: SESPlanComparisonRow[] = SES_PRICING_PLANS.map((plan) => {
    const rate = SES_PLAN_RATES[plan];
    const monthlyCost = monthlyCostForPlan(plan, emailsPerMonth);
    return {
      plan,
      label: rate.label,
      monthlyBase: rate.monthlyBase,
      monthlyCost,
      deltaVsCurrent:
        currentCost === undefined
          ? undefined
          : roundCents(monthlyCost - currentCost),
      isCurrent: plan === currentPlan,
      isCheapest: plan === cheapest,
      includes: rate.includes,
    };
  });

  const annualSavings =
    currentCost === undefined
      ? undefined
      : roundCents(
          Math.max(
            0,
            (currentCost - monthlyCostForPlan(cheapest, emailsPerMonth)) * 12
          )
        );

  return {
    emailsPerMonth,
    currentPlan,
    cheapestPlan: cheapest,
    rows,
    annualSavings,
  };
}

/** Format a USD amount for CLI output. */
export function formatUSD(amount: number): string {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
