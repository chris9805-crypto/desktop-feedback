import { DEFAULT_PRESET, PRESETS, SLEEVE_ASSUMPTIONS, type ReferencePresetId } from "./presets";
import { simulateOutcomes } from "./projection";

/**
 * The two things to understand before picking anything.
 *
 * Someone opening this tool for the first time usually wants to know which
 * fund to buy. That is the last question, not the first: the split between
 * shares and bonds sets the range of outcomes they are signing up for, and the
 * charge decides how much of that range they keep. Both are arithmetic, both
 * can be shown rather than asserted, and both are settled before any ticker
 * matters.
 *
 * Everything here is an illustration of published long-run figures on a
 * hypothetical sum. None of it describes anyone's portfolio, and none of it is
 * a forecast — it runs the same simulator as the real projection precisely so
 * that the primer cannot quietly carry a softer set of assumptions.
 */

export interface AllocationBand {
  id: string;
  /** Plain words. Someone who has never bought an investment reads these. */
  label: string;
  /** Share in shares, 0-1. */
  equityShare: number;
  realReturn: number;
  volatility: number;
  /** Outcome percentiles in today's money at the end of the horizon. */
  p10: number;
  p50: number;
  p90: number;
  /**
   * A rough bad-year fall: two standard deviations below the mean return,
   * which is about a one-in-forty year. Stated as an order of magnitude.
   */
  roughBadYear: number;
}

export interface AllocationIllustration {
  bands: AllocationBand[];
  amount: number;
  monthlyContribution: number;
  years: number;
  /** Total actually paid in, so the bands can be read against it. */
  contributed: number;
  /** How much wider the all-shares middle outcome is than the no-shares one. */
  medianMultiple: number;
  presetLabel: string;
}

const MIXES: { id: string; label: string; equityShare: number }[] = [
  { id: "none", label: "No shares at all", equityShare: 0 },
  { id: "third", label: "A third in shares", equityShare: 0.33 },
  { id: "twoThirds", label: "Two-thirds in shares", equityShare: 0.67 },
  { id: "all", label: "All in shares", equityShare: 1 },
];

export interface AllocationInput {
  amount?: number;
  monthlyContribution?: number;
  years?: number;
  presetId?: string;
}

export function allocationIllustration(input: AllocationInput = {}): AllocationIllustration {
  const amount = Math.max(0, input.amount ?? 10000);
  const monthlyContribution = Math.max(0, input.monthlyContribution ?? 300);
  const years = Math.min(50, Math.max(1, Math.round(input.years ?? 30)));
  const preset = PRESETS[(input.presetId ?? DEFAULT_PRESET) as ReferencePresetId] ?? PRESETS[DEFAULT_PRESET];
  const { bonds, equityBondCorrelation } = SLEEVE_ASSUMPTIONS;
  const annualContribution = monthlyContribution * 12;

  const bands = MIXES.map((mix) => {
    const e = mix.equityShare;
    const b = 1 - e;
    const realReturn = e * preset.realReturn + b * bonds.realReturn;
    const volatility = Math.sqrt(
      (e * preset.volatility) ** 2 +
        (b * bonds.volatility) ** 2 +
        2 * e * b * preset.volatility * bonds.volatility * equityBondCorrelation,
    );
    const points = simulateOutcomes({ realReturn, volatility, years, startValue: amount, annualContribution });
    const final = points[points.length - 1]!;
    return {
      id: mix.id,
      label: mix.label,
      equityShare: e,
      realReturn,
      volatility,
      p10: final.p10,
      p50: final.p50,
      p90: final.p90,
      roughBadYear: realReturn - 2 * volatility,
    };
  });

  const lowest = bands[0]!;
  const highest = bands[bands.length - 1]!;

  return {
    bands,
    amount,
    monthlyContribution,
    years,
    contributed: amount + annualContribution * years,
    medianMultiple: lowest.p50 > 0 ? highest.p50 / lowest.p50 : 0,
    presetLabel: preset.label,
  };
}

/** One year of the two fee paths, for the chart. */
export interface FeePoint {
  year: number;
  /** Balance under the low charge. */
  low: number;
  /** Balance under the high charge. */
  high: number;
}

export interface FeeIllustration {
  points: FeePoint[];
  amount: number;
  monthlyContribution: number;
  years: number;
  /** Return before charges. An assumption, and printed as one. */
  growth: number;
  lowCharge: number;
  highCharge: number;
  lowEnd: number;
  highEnd: number;
  /** What the charge difference costs by the end. */
  difference: number;
  /** That difference as a share of the low-charge outcome. */
  shareOfOutcome: number;
  /** The first-year charge on the high option: the number people are quoted. */
  firstYearCharge: number;
  /** The gap expressed as years of contributions, or null with none. */
  contributionYears: number | null;
}

export interface FeeInput {
  amount?: number;
  monthlyContribution?: number;
  years?: number;
  growth?: number;
  lowCharge?: number;
  highCharge?: number;
}

export function feeIllustration(input: FeeInput = {}): FeeIllustration {
  const amount = Math.max(0, input.amount ?? 10000);
  const monthlyContribution = Math.max(0, input.monthlyContribution ?? 300);
  const years = Math.min(50, Math.max(1, Math.round(input.years ?? 30)));
  const growth = input.growth ?? 0.05;
  const lowCharge = Math.max(0, input.lowCharge ?? 0.0015);
  const highCharge = Math.max(0, input.highCharge ?? 0.015);
  const annual = monthlyContribution * 12;

  const points: FeePoint[] = [{ year: 0, low: amount, high: amount }];
  let low = amount;
  let high = amount;
  for (let year = 1; year <= years; year++) {
    low = low * (1 + growth - lowCharge) + annual;
    high = high * (1 + growth - highCharge) + annual;
    points.push({ year, low, high });
  }

  const difference = low - high;
  return {
    points,
    amount,
    monthlyContribution,
    years,
    growth,
    lowCharge,
    highCharge,
    lowEnd: low,
    highEnd: high,
    difference,
    shareOfOutcome: low > 0 ? difference / low : 0,
    firstYearCharge: amount * highCharge,
    contributionYears: annual > 0 ? difference / annual : null,
  };
}
