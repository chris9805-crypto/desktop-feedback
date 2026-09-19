import type { InvestorProfile, ReferenceModel } from "./types";

export interface ProjectionPoint {
  year: number;
  p10: number;
  p50: number;
  p90: number;
  /** Money actually put in by this year: the starting balance plus contributions. */
  contributed: number;
}

export interface Projection {
  points: ProjectionPoint[];
  final: ProjectionPoint;
  assumptions: {
    realReturn: number;
    volatility: number;
    years: number;
    startValue: number;
    annualContribution: number;
    paths: number;
  };
  /** Everything the reader needs in order to not over-read the numbers. */
  notes: string[];
}

/** Deterministic PRNG, so the same inputs always draw the same paths. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(parts: number[]): number {
  let h = 2166136261;
  for (const part of parts) {
    const scaled = Math.round(part * 1000);
    h = Math.imul(h ^ scaled, 16777619);
  }
  return h >>> 0;
}

function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const index = (sorted.length - 1) * q;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const value = sorted[lower];
  if (lower === upper || value === undefined) return value ?? 0;
  const next = sorted[upper];
  return next === undefined ? value : value + (next - value) * (index - lower);
}

const PATHS = 2000;

/**
 * Illustrate the range of outcomes a reference mix has historically produced.
 *
 * This is a simulation, not a forecast. It draws each year's return independently
 * from a normal distribution around the reference mix's long-run historical real
 * return, runs 2,000 paths, and reports the 10th, 50th and 90th percentiles.
 *
 * Two deliberate choices about honesty:
 *
 *  - Everything is in today's money. The return assumption is real rather than
 *    nominal and contributions are assumed to rise with inflation, so a figure
 *    thirty years out means what it would buy today. Nominal projections look
 *    far more impressive and tell the reader much less.
 *  - It reports a band, never a single number. The median is one outcome out of
 *    two thousand, and the distance between the 10th and 90th percentile is the
 *    actual content of the exercise.
 */
export function buildProjection(
  reference: ReferenceModel,
  profile: InvestorProfile,
  startValue: number,
  overrides: { realReturn?: number; volatility?: number; years?: number } = {},
): Projection {
  const realReturn = overrides.realReturn ?? reference.expectedRealReturn;
  const volatility = overrides.volatility ?? reference.expectedVolatility;
  const years = Math.max(1, Math.round(overrides.years ?? profile.horizonYears));
  const annualContribution = Math.max(0, profile.monthlyContribution) * 12;

  const random = mulberry32(hashSeed([realReturn, volatility, years, startValue, annualContribution]));
  let spare: number | null = null;
  const gaussian = () => {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return value;
    }
    // Box-Muller, keeping the second variate rather than discarding it.
    let u = 0;
    let v = 0;
    while (u === 0) u = random();
    while (v === 0) v = random();
    const radius = Math.sqrt(-2 * Math.log(u));
    const theta = 2 * Math.PI * v;
    spare = radius * Math.sin(theta);
    return radius * Math.cos(theta);
  };

  const byYear: number[][] = Array.from({ length: years + 1 }, () => []);
  for (let path = 0; path < PATHS; path++) {
    let value = startValue;
    byYear[0]!.push(value);
    for (let year = 1; year <= years; year++) {
      value = value * (1 + realReturn + volatility * gaussian()) + annualContribution;
      // A portfolio cannot go below zero, and a simulated draw occasionally tries.
      value = Math.max(0, value);
      byYear[year]!.push(value);
    }
  }

  const points: ProjectionPoint[] = byYear.map((values, year) => {
    const sorted = values.slice().sort((a, b) => a - b);
    return {
      year,
      p10: percentile(sorted, 0.1),
      p50: percentile(sorted, 0.5),
      p90: percentile(sorted, 0.9),
      contributed: startValue + annualContribution * year,
    };
  });

  return {
    points,
    final: points[points.length - 1]!,
    assumptions: { realReturn, volatility, years, startValue, annualContribution, paths: PATHS },
    notes: [
      `In today's money: the ${(realReturn * 100).toFixed(1)}% return is after inflation and contributions rise with it, so a figure ${years} years out means what it would buy today.`,
      `The rate is the long-run historical record of ${reference.presetLabel} and a bond sleeve at this model's weights. An assumption, not a forecast — change it and see.`,
      `The band is the 10th to 90th percentile of ${PATHS.toLocaleString()} paths. Its width is the point, not the middle line.`,
      "Returns are drawn independently from a normal distribution. Real markets have fatter tails, some mean reversion, and no fixed order — so use this to feel the range, not to predict.",
      "It illustrates the reference mix, not the holdings you actually own.",
    ],
  };
}
