import type { Factor, Fundamentals, Valuation } from "./types";

/** Clamp x into 0..1 by where it falls between lo and hi. */
export function scale(x: number, lo: number, hi: number): number {
  if (!Number.isFinite(x)) return 0;
  if (hi === lo) return 0;
  return Math.max(0, Math.min(1, (x - lo) / (hi - lo)));
}

/** Same as `scale`, but higher raw values produce lower scores. */
export function inverseScale(x: number, lo: number, hi: number): number {
  return 1 - scale(x, lo, hi);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Turn a company's published metrics into factor loadings on the same 0-1
 * scale the fund breakdowns use, so a directly held stock and a factor ETF can
 * be added together in one exposure vector.
 */
export function deriveFactorTilts(input: {
  marketCapUsd: number;
  valuation: Valuation;
  fundamentals: Fundamentals;
  volatility3y: number;
  trailing: { return3m: number; return12m: number };
}): Partial<Record<Factor, number>> {
  const { valuation: v, fundamentals: f } = input;

  const value = mean([
    scale(v.freeCashFlowYield, 0.01, 0.09),
    v.priceToBook > 0 ? inverseScale(v.priceToBook, 1, 9) : 0.4,
    v.priceEarnings > 0 ? inverseScale(v.priceEarnings, 8, 35) : 0.3,
    v.evToEbit > 0 ? inverseScale(v.evToEbit, 7, 30) : 0.3,
  ]);

  const quality = mean([
    scale(f.returnOnInvestedCapital, 0.05, 0.35),
    scale(f.operatingMargin, 0.05, 0.4),
    inverseScale(f.netDebtToEbitda, 0, 4),
    scale(f.freeCashFlowMargin, 0, 0.3),
  ]);

  // Twelve-month return carries most of the weight, with the most recent
  // quarter included so a name that has just rolled over scores lower than one
  // still climbing.
  const momentum = mean([
    scale(input.trailing.return12m, -0.15, 0.45),
    scale(input.trailing.return3m, -0.06, 0.1),
  ]);

  const smallSize = inverseScale(Math.log10(Math.max(input.marketCapUsd, 1e8)), 9, 12.5);
  const lowVolatility = inverseScale(input.volatility3y, 0.1, 0.45);
  const dividendYield = scale(f.dividendYield, 0.005, 0.055);

  return { value, quality, momentum, smallSize, lowVolatility, dividendYield };
}
