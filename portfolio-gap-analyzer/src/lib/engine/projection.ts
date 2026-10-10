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

export interface SimulationInput {
  realReturn: number;
  volatility: number;
  years: number;
  startValue: number;
  annualContribution: number;
}

/**
 * The simulation itself, separated from the reference model that usually
 * supplies its inputs.
 *
 * The primer illustrates several hypothetical mixes rather than one portfolio,
 * and it has to use the same machinery: an illustration built on a different
 * simulator than the one behind the real projection would be a second, quieter
 * set of assumptions. Callers with a `ReferenceModel` go through
 * `buildProjection` below, which adds the notes a reader needs.
 */
/** Seeded standard normals, so the same inputs always draw the same paths. */
function makeGaussian(seed: number): () => number {
  const random = mulberry32(seed);
  let spare: number | null = null;
  return () => {
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
}

export function simulateOutcomes(input: SimulationInput): ProjectionPoint[] {
  const { realReturn, volatility, startValue, annualContribution } = input;
  const years = Math.max(1, Math.round(input.years));

  const gaussian = makeGaussian(hashSeed([realReturn, volatility, years, startValue, annualContribution]));

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

  return byYear.map((values, year) => {
    const sorted = values.slice().sort((a, b) => a - b);
    return {
      year,
      p10: percentile(sorted, 0.1),
      p50: percentile(sorted, 0.5),
      p90: percentile(sorted, 0.9),
      contributed: startValue + annualContribution * year,
    };
  });
}

/**
 * A handful of whole paths, drawn from across the same distribution.
 *
 * Percentiles describe the spread but hide the shape: they make growth look
 * like a smooth widening cone, when the point a beginner most needs is that
 * no single run is smooth. These are real paths out of the same 2,000, picked
 * by where their final value sits so the sample spans the band rather than
 * flattering it, and replayed from the same seed so they are the very runs the
 * band is drawn from.
 */
export function samplePaths(input: SimulationInput, count = 7): number[][] {
  const { realReturn, volatility, startValue, annualContribution } = input;
  const years = Math.max(1, Math.round(input.years));
  const seed = hashSeed([realReturn, volatility, years, startValue, annualContribution]);

  // Pass one: every path's final value, so the sample can be chosen by
  // outcome rather than by whichever paths happen to be drawn first.
  const first = makeGaussian(seed);
  const finals: { index: number; value: number }[] = [];
  for (let path = 0; path < PATHS; path++) {
    let value = startValue;
    for (let year = 1; year <= years; year++) {
      value = Math.max(0, value * (1 + realReturn + volatility * first()) + annualContribution);
    }
    finals.push({ index: path, value });
  }
  finals.sort((a, b) => a.value - b.value);

  const wanted = new Set<number>();
  for (let i = 0; i < count; i++) {
    // Spread across the 5th to 95th percentile: the extremes of 2,000 runs are
    // noise, and drawing them would overstate the width of the plausible range.
    const q = count === 1 ? 0.5 : 0.05 + (0.9 * i) / (count - 1);
    wanted.add(finals[Math.round(q * (PATHS - 1))]!.index);
  }

  // Pass two: the same seed replayed, keeping only the chosen paths whole.
  const second = makeGaussian(seed);
  const out: number[][] = [];
  for (let path = 0; path < PATHS; path++) {
    const keep = wanted.has(path);
    const trace = keep ? [startValue] : [];
    let value = startValue;
    for (let year = 1; year <= years; year++) {
      value = Math.max(0, value * (1 + realReturn + volatility * second()) + annualContribution);
      if (keep) trace.push(value);
    }
    if (keep) out.push(trace);
  }
  return out;
}

/**
 * The share of simulated paths that finish below a target.
 *
 * A plan sized on an average return reaches its goal on an average run, and
 * says nothing about the others. This counts them: it is the number that stops
 * "put aside this much and you get there" from being read as a promise, and it
 * is the honest counterweight to a bolder mix asking for less money each month.
 */
export function shortfallRate(input: SimulationInput, target: number): number {
  const { realReturn, volatility, startValue, annualContribution } = input;
  const years = Math.max(1, Math.round(input.years));
  if (target <= 0) return 0;

  const gaussian = makeGaussian(hashSeed([realReturn, volatility, years, startValue, annualContribution, target]));

  let short = 0;
  for (let path = 0; path < PATHS; path++) {
    let value = startValue;
    for (let year = 1; year <= years; year++) {
      value = Math.max(0, value * (1 + realReturn + volatility * gaussian()) + annualContribution);
    }
    if (value < target) short++;
  }
  return short / PATHS;
}

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

  const points = simulateOutcomes({ realReturn, volatility, years, startValue, annualContribution });

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
