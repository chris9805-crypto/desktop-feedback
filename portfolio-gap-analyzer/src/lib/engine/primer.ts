import { DEFAULT_PRESET, PRESETS, SLEEVE_ASSUMPTIONS, type ReferencePresetId } from "./presets";
import { shortfallRate, simulateOutcomes } from "./projection";

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

const MIXES: { id: string; label: string; equityShare: number }[] = [
  { id: "none", label: "No shares at all", equityShare: 0 },
  { id: "third", label: "A third in shares", equityShare: 0.33 },
  { id: "twoThirds", label: "Two-thirds in shares", equityShare: 0.67 },
  { id: "all", label: "All in shares", equityShare: 1 },
];

export interface GoalMix {
  id: string;
  /** Plain words. Someone who has never bought an investment reads these. */
  label: string;
  /** Share in shares, 0-1. */
  equityShare: number;
  /** Long-run real return before any charge. */
  realReturn: number;
  volatility: number;
  /** Put aside this much a month to reach the goal on an average run. */
  monthly: number;
  /** The same sum under the dearer charge. */
  monthlyHighCharge: number;
  /** What the dearer charge adds to the monthly figure. */
  monthlyExtra: number;
  /** Where the cheap-charge monthly actually lands if the charge is the dear one. */
  highChargeOutcome: number;
  /** Outcomes when paying `monthly` at the low charge, in today's money. */
  p10: number;
  p50: number;
  p90: number;
  /** Share of simulated runs that finished below the goal. */
  shortfall: number;
  /** The starting sum alone already gets there; nothing monthly is needed. */
  alreadyThere: boolean;
}

export interface GoalPlan {
  goal: number;
  years: number;
  startingAmount: number;
  lowCharge: number;
  highCharge: number;
  mixes: GoalMix[];
  /** Cheapest and dearest monthly across the mixes, for the headline line. */
  mostPerMonth: GoalMix;
  leastPerMonth: GoalMix;
  /** What the dearer charge costs over the whole term on the boldest mix. */
  feeCostOverTerm: number;
}

export interface GoalInput {
  goal?: number;
  years?: number;
  startingAmount?: number;
  lowCharge?: number;
  highCharge?: number;
  presetId?: string;
}

/**
 * The monthly payment that reaches `goal`, given a starting sum and a rate.
 *
 * Standard future-value algebra rearranged for the payment, with year-end
 * contributions to match the simulator. A zero or negative result means the
 * starting sum gets there on its own.
 */
function monthlyFor(goal: number, startingAmount: number, rate: number, years: number): number {
  const grown = startingAmount * (1 + rate) ** years;
  const shortBy = goal - grown;
  if (shortBy <= 0) return 0;
  // At a rate of zero the annuity factor collapses to the number of years.
  const factor = Math.abs(rate) < 1e-9 ? years : ((1 + rate) ** years - 1) / rate;
  return shortBy / factor / 12;
}

/** Round up to something a person would actually set up a standing order for. */
function roundMonthly(value: number): number {
  if (value <= 0) return 0;
  const step = value < 200 ? 5 : value < 1000 ? 10 : 50;
  return Math.ceil(value / step) * step;
}

/**
 * Work backwards from the goal.
 *
 * Asking "what might happen to my money" needs someone to already have money
 * and a mix in mind. Asking "I want this much, by then" needs neither, and the
 * answer carries both lessons at once: the monthly payment falls as the share
 * in shares rises, and rises again with the charge. One question, and the two
 * decisions that matter are visible in the same table.
 */
export function goalPlan(input: GoalInput = {}): GoalPlan {
  const goal = Math.max(0, input.goal ?? 100000);
  const years = Math.min(50, Math.max(1, Math.round(input.years ?? 20)));
  const startingAmount = Math.max(0, input.startingAmount ?? 5000);
  const lowCharge = Math.max(0, input.lowCharge ?? 0.0015);
  const highCharge = Math.max(0, input.highCharge ?? 0.015);
  const preset = PRESETS[(input.presetId ?? DEFAULT_PRESET) as ReferencePresetId] ?? PRESETS[DEFAULT_PRESET];
  const { bonds, equityBondCorrelation } = SLEEVE_ASSUMPTIONS;

  const mixes = MIXES.map((mix) => {
    const e = mix.equityShare;
    const b = 1 - e;
    const realReturn = e * preset.realReturn + b * bonds.realReturn;
    const volatility = Math.sqrt(
      (e * preset.volatility) ** 2 +
        (b * bonds.volatility) ** 2 +
        2 * e * b * preset.volatility * bonds.volatility * equityBondCorrelation,
    );

    const net = realReturn - lowCharge;
    const netHigh = realReturn - highCharge;
    const monthly = roundMonthly(monthlyFor(goal, startingAmount, net, years));
    const monthlyHighCharge = roundMonthly(monthlyFor(goal, startingAmount, netHigh, years));

    // Where the cheap plan's payment lands if the charge turns out to be the
    // dear one: the same effort, a worse result, which is the fee lesson.
    let highChargeOutcome = startingAmount;
    for (let year = 0; year < years; year++) highChargeOutcome = highChargeOutcome * (1 + netHigh) + monthly * 12;

    const simulation = { realReturn: net, volatility, years, startValue: startingAmount, annualContribution: monthly * 12 };
    const final = simulateOutcomes(simulation)[years]!;

    return {
      id: mix.id,
      label: mix.label,
      equityShare: e,
      realReturn,
      volatility,
      monthly,
      monthlyHighCharge,
      monthlyExtra: monthlyHighCharge - monthly,
      highChargeOutcome,
      p10: final.p10,
      p50: final.p50,
      p90: final.p90,
      shortfall: shortfallRate(simulation, goal),
      alreadyThere: monthly === 0,
    };
  });

  const sorted = [...mixes].sort((a, b) => a.monthly - b.monthly);
  const leastPerMonth = sorted[0]!;
  const mostPerMonth = sorted[sorted.length - 1]!;

  return {
    goal,
    years,
    startingAmount,
    lowCharge,
    highCharge,
    mixes,
    leastPerMonth,
    mostPerMonth,
    feeCostOverTerm: leastPerMonth.monthlyExtra * 12 * years,
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
