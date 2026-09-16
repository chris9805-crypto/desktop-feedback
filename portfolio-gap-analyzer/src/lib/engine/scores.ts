import { inverseScale, scale } from "./factors";
import type { StockSecurity } from "./types";

/**
 * Composite descriptive scores for the research pages.
 *
 * These are arithmetic summaries of published metrics, shown alongside the
 * inputs that produced them. They are not ratings, not forecasts, and not a
 * view on whether anything is worth owning — the point is to make a company's
 * profile quick to read, then send the reader to the underlying numbers.
 */
export interface ScoreBreakdown {
  score: number;
  components: { label: string; value: string; contribution: number }[];
  note: string;
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

function build(components: { label: string; value: string; contribution: number }[], note: string): ScoreBreakdown {
  const score = Math.round((components.reduce((a, c) => a + c.contribution, 0) / components.length) * 100);
  return { score, components, note };
}

export function qualityScore(s: StockSecurity): ScoreBreakdown {
  const f = s.fundamentals;
  return build(
    [
      { label: "Return on invested capital", value: pct(f.returnOnInvestedCapital), contribution: scale(f.returnOnInvestedCapital, 0.05, 0.35) },
      { label: "Operating margin", value: pct(f.operatingMargin), contribution: scale(f.operatingMargin, 0.05, 0.4) },
      { label: "Free cash flow margin", value: pct(f.freeCashFlowMargin), contribution: scale(f.freeCashFlowMargin, 0, 0.3) },
      { label: "Gross margin", value: pct(f.grossMargin), contribution: scale(f.grossMargin, 0.2, 0.7) },
    ],
    "Higher scores mean the business converts revenue into profit and cash at a high rate. It says nothing about the price you would pay for that.",
  );
}

export function financialStrengthScore(s: StockSecurity): ScoreBreakdown {
  const f = s.fundamentals;
  return build(
    [
      { label: "Net debt / EBITDA", value: `${f.netDebtToEbitda.toFixed(1)}x`, contribution: inverseScale(f.netDebtToEbitda, 0, 4) },
      { label: "Interest cover", value: f.interestCover > 0 ? `${f.interestCover.toFixed(0)}x` : "n/a", contribution: scale(f.interestCover, 3, 30) },
      { label: "Current ratio", value: `${f.currentRatio.toFixed(2)}x`, contribution: scale(f.currentRatio, 0.7, 2) },
      { label: "Share count change (5y)", value: pct(f.shareCountCagr5y), contribution: inverseScale(f.shareCountCagr5y, -0.03, 0.04) },
    ],
    "Balance-sheet resilience. Banks and insurers are not comparable on these measures — leverage is their business model, so treat their score as not meaningful.",
  );
}

export function growthScore(s: StockSecurity): ScoreBreakdown {
  const f = s.fundamentals;
  return build(
    [
      { label: "Revenue growth (3y CAGR)", value: pct(f.revenueCagr3y), contribution: scale(f.revenueCagr3y, -0.02, 0.25) },
      { label: "EPS growth (3y CAGR)", value: pct(f.epsCagr3y), contribution: scale(f.epsCagr3y, -0.05, 0.35) },
      { label: "Return on equity", value: pct(f.returnOnEquity), contribution: scale(f.returnOnEquity, 0.05, 0.4) },
    ],
    "Past growth over three years. It is history, not a projection, and fast recent growth is often the reason a share is expensive.",
  );
}

export function valuationScore(s: StockSecurity): ScoreBreakdown {
  const v = s.valuation;
  return build(
    [
      { label: "Free cash flow yield", value: pct(v.freeCashFlowYield), contribution: scale(v.freeCashFlowYield, 0.01, 0.09) },
      { label: "P/E", value: v.priceEarnings > 0 ? v.priceEarnings.toFixed(1) : "n/a", contribution: v.priceEarnings > 0 ? inverseScale(v.priceEarnings, 8, 35) : 0.3 },
      { label: "EV / EBIT", value: v.evToEbit.toFixed(1), contribution: inverseScale(v.evToEbit, 7, 30) },
      { label: "Price / book", value: v.priceToBook > 0 ? v.priceToBook.toFixed(2) : "negative", contribution: v.priceToBook > 0 ? inverseScale(v.priceToBook, 1, 9) : 0.4 },
    ],
    "A higher score means the shares are cheap on these ratios relative to a fixed scale. Cheap is not the same as good value — companies are often cheap for a reason.",
  );
}

/** Below this, the payout is a token one and a durability score would be noise. */
const MEANINGFUL_YIELD = 0.005;

export function dividendDurabilityScore(s: StockSecurity): ScoreBreakdown | null {
  const f = s.fundamentals;
  if (f.dividendYield < MEANINGFUL_YIELD) return null;
  return build(
    [
      { label: "Payout ratio", value: pct(f.payoutRatio), contribution: inverseScale(f.payoutRatio, 0.25, 0.95) },
      { label: "Free cash flow margin", value: pct(f.freeCashFlowMargin), contribution: scale(f.freeCashFlowMargin, 0, 0.25) },
      { label: "Net debt / EBITDA", value: `${f.netDebtToEbitda.toFixed(1)}x`, contribution: inverseScale(f.netDebtToEbitda, 0, 4) },
      { label: "Years of dividend growth", value: `${f.dividendGrowthStreakYears}`, contribution: scale(f.dividendGrowthStreakYears, 0, 25) },
    ],
    "How much slack sits behind the current payout. A high yield with a low score here is the classic shape of a dividend under strain.",
  );
}

export function allScores(s: StockSecurity) {
  return {
    quality: qualityScore(s),
    strength: financialStrengthScore(s),
    growth: growthScore(s),
    valuation: valuationScore(s),
    dividend: dividendDurabilityScore(s),
  };
}
