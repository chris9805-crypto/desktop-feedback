/**
 * What a quoted charge actually costs, in money.
 *
 * A percentage is the least intuitive way to express a fee, which is part of
 * why fees are quoted that way. "1.5% a year" sounds like a rounding error;
 * the same figure over thirty years is often a third of the final pot. This
 * converts one into the other and does nothing else — it takes no view on
 * whether a product is worth its charge, only on what the charge costs.
 */

export interface FeeOutcome {
  /** Total annual charge as a decimal. */
  charge: number;
  endValue: number;
  /** The charge plus everything it would have earned had it stayed invested. */
  totalCost: number;
}

export interface FeeComparison {
  years: number;
  amount: number;
  monthlyContribution: number;
  growth: number;
  /** What the money would be worth with no charges at all. */
  grossValue: number;
  offered: FeeOutcome;
  lowCost: FeeOutcome;
  /** Difference in end value between the two. */
  difference: number;
  /** That difference as a share of the low-cost outcome. */
  shareOfOutcome: number;
  /** First-year charge in money, which is the figure people are quoted. */
  firstYearCharge: number;
}

/** Future value of a starting sum plus year-end contributions at a net rate. */
function futureValue(amount: number, monthly: number, netRate: number, years: number): number {
  let value = amount;
  for (let year = 0; year < years; year++) {
    value = value * (1 + netRate) + monthly * 12;
  }
  return value;
}

export function compareFees(input: {
  amount: number;
  monthlyContribution?: number;
  /** Everything the product charges each year, as a decimal. */
  offeredCharge: number;
  /** What a plain index portfolio costs. Defaults to 15 basis points. */
  lowCostCharge?: number;
  years: number;
  /** Assumed return before charges. An assumption, shown to the reader. */
  growth?: number;
}): FeeComparison {
  const amount = Math.max(0, input.amount);
  const monthly = Math.max(0, input.monthlyContribution ?? 0);
  const years = Math.max(1, Math.round(input.years));
  const growth = input.growth ?? 0.05;
  const offeredCharge = Math.max(0, input.offeredCharge);
  const lowCostCharge = Math.max(0, input.lowCostCharge ?? 0.0015);

  const grossValue = futureValue(amount, monthly, growth, years);
  const build = (charge: number): FeeOutcome => {
    const endValue = futureValue(amount, monthly, growth - charge, years);
    return { charge, endValue, totalCost: grossValue - endValue };
  };

  const offered = build(offeredCharge);
  const lowCost = build(lowCostCharge);
  const difference = lowCost.endValue - offered.endValue;

  return {
    years,
    amount,
    monthlyContribution: monthly,
    growth,
    grossValue,
    offered,
    lowCost,
    difference,
    shareOfOutcome: lowCost.endValue > 0 ? difference / lowCost.endValue : 0,
    firstYearCharge: amount * offeredCharge,
  };
}
