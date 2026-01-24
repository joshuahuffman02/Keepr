/**
 * Discount resolution utility for pricing-v2.
 * Implements deterministic stacking with a configurable cap and priority ordering.
 */

export type DiscountSourceType = "membership" | "promo";
export type DiscountStackingRule = "stackable" | "non_stackable";
export type DiscountKind = "percent_off" | "amount_off";

export interface DiscountCandidate {
  id: string;
  sourceType: DiscountSourceType;
  stackingRule: DiscountStackingRule;
  priority: number; // lower = higher priority
  kind: DiscountKind;
  value: number; // percent (0-100) or amount in currency units
  currency?: string; // optional for amount_off
}

export interface ResolvedDiscount {
  id: string;
  sourceType: DiscountSourceType;
  appliedAmount: number;
  reason?: string;
}

export interface ResolutionResult {
  applied: ResolvedDiscount[];
  rejected: { id: string; reason: string }[];
  totalDiscount: number;
  capped: boolean;
}

export interface ResolveOptions {
  /**
   * Maximum overall discount expressed as a fraction of base (e.g., 0.4 for 40%).
   * Defaults to 0.4.
   */
  maxDiscountFraction?: number;
}

const DEFAULT_MAX_FRACTION = 0.4;

function effectiveValue(base: number, discount: DiscountCandidate): number {
  if (discount.kind === "percent_off") {
    return (discount.value / 100) * base;
  }
  return Math.min(discount.value, base);
}

/**
 * Resolve discounts into a deterministic applied set with stacking and cap enforcement.
 * Non-stackable: keep the single best-value discount (by effective amount, then priority).
 * Stackable: sum all stackable amounts, then cap the total discount by maxDiscountFraction.
 */
export function resolveDiscounts(
  baseAmount: number,
  candidates: DiscountCandidate[],
  options: ResolveOptions = {},
): ResolutionResult {
  const maxFraction = options.maxDiscountFraction ?? DEFAULT_MAX_FRACTION;
  const nonStackable: DiscountCandidate[] = candidates.filter(
    (c) => c.stackingRule === "non_stackable",
  );
  const stackable: DiscountCandidate[] = candidates.filter((c) => c.stackingRule === "stackable");

  // Pick best non-stackable (highest effective value; tie-breaker priority asc)
  const bestNonStackable = nonStackable
    .map((c) => ({ candidate: c, value: effectiveValue(baseAmount, c) }))
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      return a.candidate.priority - b.candidate.priority;
    })[0];

  const applied: ResolvedDiscount[] = [];
  const rejected: { id: string; reason: string }[] = [];
  let total = 0;

  if (bestNonStackable) {
    applied.push({
      id: bestNonStackable.candidate.id,
      sourceType: bestNonStackable.candidate.sourceType,
      appliedAmount: roundCurrency(bestNonStackable.value),
    });
    total += bestNonStackable.value;
    nonStackable
      .filter((c) => c.id !== bestNonStackable.candidate.id)
      .forEach((c) =>
        rejected.push({ id: c.id, reason: "non_stackable_best_value_selected_elsewhere" }),
      );
  }

  for (const cand of stackable) {
    const val = effectiveValue(baseAmount, cand);
    applied.push({
      id: cand.id,
      sourceType: cand.sourceType,
      appliedAmount: roundCurrency(val),
    });
    total += val;
  }

  const maxAllowed = baseAmount * maxFraction;
  let capped = false;
  if (total > maxAllowed) {
    capped = true;
    const scale = maxAllowed / total;
    // Scale down applied amounts proportionally to respect the cap.
    applied.forEach((d) => (d.appliedAmount = roundCurrency(d.appliedAmount * scale)));
    total = applied.reduce((sum, d) => sum + d.appliedAmount, 0);
  } else {
    total = applied.reduce((sum, d) => sum + d.appliedAmount, 0);
  }

  return {
    applied,
    rejected,
    totalDiscount: roundCurrency(total),
    capped,
  };
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
