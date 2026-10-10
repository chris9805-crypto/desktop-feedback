import { DEFAULT_PRESET, PRESETS, SLEEVE_ASSUMPTIONS, type ReferencePresetId } from "./presets";
import { shortfallRate, simulateOutcomes } from "./projection";
import { TOLERANCE_GROWTH, riskProfileLabel } from "./reference";

/**
 * The opening page, in two directions.
 *
 * Someone with no background has one of two questions, and they are the same
 * arithmetic read from opposite ends: "I want this much — what does that take
 * from me?" and "this is what I can do — where does it get me?" Both need the
 * reader to say how much movement they can live with, so risk is an input
 * rather than a row in a table, and both answers carry what the charge does to
 * them.
 *
 * The risk question is the same one the reference model asks, using the same
 * mapping, so an answer here means exactly what it means on the rest of the
 * tool rather than something private to this page.
 */

export type RiskTolerance = 1 | 2 | 3 | 4 | 5;

export const RISK_TOLERANCES: RiskTolerance[] = [1, 2, 3, 4, 5];

/** What the reader is agreeing to, in falls rather than in jargon. */
export const RISK_STATEMENTS: Record<RiskTolerance, string> = {
  1: "A fall of 10% would worry me enough to want out.",
  2: "I could sit through a 15% fall, but not comfortably.",
  3: "A 25% fall would be unpleasant and I would hold on.",
  4: "A 35% fall is the cost of doing business.",
  5: "A 50% fall would not change what I do.",
};

export interface RiskMix {
  tolerance: RiskTolerance;
  /** The same word the reference model uses for this band. */
  label: string;
  statement: string;
  /** Share in shares, 0-1. */
  equityShare: number;
  /** Long-run real return before any charge. */
  realReturn: number;
  volatility: number;
  /** Two standard deviations below the mean: roughly a one-in-forty year. */
  roughBadYear: number;
}

export function riskMix(tolerance: RiskTolerance, presetId?: string): RiskMix {
  const preset = PRESETS[(presetId ?? DEFAULT_PRESET) as ReferencePresetId] ?? PRESETS[DEFAULT_PRESET];
  const { bonds, equityBondCorrelation } = SLEEVE_ASSUMPTIONS;
  const e = TOLERANCE_GROWTH[tolerance];
  const b = 1 - e;
  const realReturn = e * preset.realReturn + b * bonds.realReturn;
  const volatility = Math.sqrt(
    (e * preset.volatility) ** 2 +
      (b * bonds.volatility) ** 2 +
      2 * e * b * preset.volatility * bonds.volatility * equityBondCorrelation,
  );
  return {
    tolerance,
    label: riskProfileLabel(e),
    statement: RISK_STATEMENTS[tolerance],
    equityShare: e,
    realReturn,
    volatility,
    roughBadYear: realReturn - 2 * volatility,
  };
}

/** The outcome spread of one plan, in today's money. */
export interface Spread {
  p10: number;
  p50: number;
  p90: number;
}

/** One rung of the risk ladder, so the chosen answer can be seen in context. */
export interface Alternative extends Spread {
  tolerance: RiskTolerance;
  label: string;
  equityShare: number;
  /** Mode A only: what this rung would ask for each month. */
  monthly: number | null;
  chosen: boolean;
}

const DEFAULT_LOW_CHARGE = 0.0015;
const DEFAULT_HIGH_CHARGE = 0.015;

interface Charges {
  lowCharge: number;
  highCharge: number;
}

function charges(input: Partial<Charges>): Charges {
  return {
    lowCharge: Math.max(0, input.lowCharge ?? DEFAULT_LOW_CHARGE),
    highCharge: Math.max(0, input.highCharge ?? DEFAULT_HIGH_CHARGE),
  };
}

function spreadOf(realReturn: number, volatility: number, years: number, startValue: number, monthly: number): Spread {
  const final = simulateOutcomes({ realReturn, volatility, years, startValue, annualContribution: monthly * 12 })[
    Math.max(1, Math.round(years))
  ]!;
  return { p10: final.p10, p50: final.p50, p90: final.p90 };
}

/**
 * The monthly payment that reaches `goal`, given a starting sum and a rate.
 *
 * Standard future-value algebra rearranged for the payment, with year-end
 * contributions to match the simulator. Zero or less means the starting sum
 * gets there on its own.
 */
function monthlyFor(goal: number, startingAmount: number, rate: number, years: number): number {
  const shortBy = goal - startingAmount * (1 + rate) ** years;
  if (shortBy <= 0) return 0;
  const factor = Math.abs(rate) < 1e-9 ? years : ((1 + rate) ** years - 1) / rate;
  return shortBy / factor / 12;
}

/** Round up to something a person would actually set up a standing order for. */
function roundMonthly(value: number): number {
  if (value <= 0) return 0;
  const step = value < 200 ? 5 : value < 1000 ? 10 : 50;
  return Math.ceil(value / step) * step;
}

/** Compound a fixed payment forward at a fixed rate. */
function grow(startValue: number, monthly: number, rate: number, years: number): number {
  let value = startValue;
  for (let year = 0; year < years; year++) value = value * (1 + rate) + monthly * 12;
  return value;
}

export interface GoalInput extends Partial<Charges> {
  startingAmount?: number;
  years?: number;
  goal?: number;
  tolerance?: RiskTolerance;
  presetId?: string;
}

export interface GoalAnswer extends Spread {
  mode: "goal";
  mix: RiskMix;
  startingAmount: number;
  years: number;
  goal: number;
  lowCharge: number;
  highCharge: number;
  /** What it takes each month at the low charge. */
  monthly: number;
  /** The same goal, bought through a dearer fund. */
  monthlyHighCharge: number;
  monthlyExtra: number;
  /** That extra, over the whole term. */
  feeCostOverTerm: number;
  /** Where the low-charge payment lands if the charge is the dear one. */
  highChargeOutcome: number;
  shortBy: number;
  /** Share of simulated runs that finished below the goal. */
  shortfall: number;
  /** Start plus every payment: the money that came out of your pocket. */
  contributed: number;
  /** The starting sum alone gets there; nothing monthly is needed. */
  alreadyThere: boolean;
  alternatives: Alternative[];
}

/** Mode A: name the number, and find out what it takes. */
export function goalAnswer(input: GoalInput = {}): GoalAnswer {
  const { lowCharge, highCharge } = charges(input);
  const goal = Math.max(0, input.goal ?? 100000);
  const years = Math.min(50, Math.max(1, Math.round(input.years ?? 20)));
  const startingAmount = Math.max(0, input.startingAmount ?? 5000);
  const tolerance = input.tolerance ?? 3;

  const rung = (level: RiskTolerance) => {
    const mix = riskMix(level, input.presetId);
    const monthly = roundMonthly(monthlyFor(goal, startingAmount, mix.realReturn - lowCharge, years));
    return { mix, monthly, spread: spreadOf(mix.realReturn - lowCharge, mix.volatility, years, startingAmount, monthly) };
  };

  const alternatives: Alternative[] = RISK_TOLERANCES.map((level) => {
    const { mix, monthly, spread } = rung(level);
    return {
      tolerance: level,
      label: mix.label,
      equityShare: mix.equityShare,
      monthly,
      ...spread,
      chosen: level === tolerance,
    };
  });

  const { mix, monthly, spread } = rung(tolerance);
  const monthlyHighCharge = roundMonthly(monthlyFor(goal, startingAmount, mix.realReturn - highCharge, years));
  const highChargeOutcome = grow(startingAmount, monthly, mix.realReturn - highCharge, years);
  const monthlyExtra = monthlyHighCharge - monthly;

  return {
    mode: "goal",
    mix,
    startingAmount,
    years,
    goal,
    lowCharge,
    highCharge,
    monthly,
    monthlyHighCharge,
    monthlyExtra,
    feeCostOverTerm: monthlyExtra * 12 * years,
    highChargeOutcome,
    shortBy: goal - highChargeOutcome,
    ...spread,
    shortfall: shortfallRate(
      {
        realReturn: mix.realReturn - lowCharge,
        volatility: mix.volatility,
        years,
        startValue: startingAmount,
        annualContribution: monthly * 12,
      },
      goal,
    ),
    contributed: startingAmount + monthly * 12 * years,
    alreadyThere: monthly === 0,
    alternatives,
  };
}

export interface ForecastInput extends Partial<Charges> {
  startingAmount?: number;
  monthly?: number;
  years?: number;
  tolerance?: RiskTolerance;
  presetId?: string;
}

export interface ForecastAnswer extends Spread {
  mode: "forecast";
  mix: RiskMix;
  startingAmount: number;
  monthly: number;
  years: number;
  lowCharge: number;
  highCharge: number;
  /** Start plus every payment: the money that came out of your pocket. */
  contributed: number;
  /** The same plan held in a dearer fund. */
  dear: Spread;
  /** What the charge costs at the middle outcome. */
  feeCost: number;
  /** That cost as a share of the cheap middle outcome. */
  feeShare: number;
  /** Share of runs that finished below the money paid in. */
  belowContributed: number;
  alternatives: Alternative[];
}

/** Mode B: name what you can do, and find out where it gets you. */
export function forecastAnswer(input: ForecastInput = {}): ForecastAnswer {
  const { lowCharge, highCharge } = charges(input);
  const years = Math.min(50, Math.max(1, Math.round(input.years ?? 20)));
  const startingAmount = Math.max(0, input.startingAmount ?? 5000);
  const monthly = Math.max(0, input.monthly ?? 300);
  const tolerance = input.tolerance ?? 3;

  const alternatives: Alternative[] = RISK_TOLERANCES.map((level) => {
    const mix = riskMix(level, input.presetId);
    return {
      tolerance: level,
      label: mix.label,
      equityShare: mix.equityShare,
      monthly: null,
      ...spreadOf(mix.realReturn - lowCharge, mix.volatility, years, startingAmount, monthly),
      chosen: level === tolerance,
    };
  });

  const mix = riskMix(tolerance, input.presetId);
  const spread = spreadOf(mix.realReturn - lowCharge, mix.volatility, years, startingAmount, monthly);
  const dear = spreadOf(mix.realReturn - highCharge, mix.volatility, years, startingAmount, monthly);
  const contributed = startingAmount + monthly * 12 * years;

  return {
    mode: "forecast",
    mix,
    startingAmount,
    monthly,
    years,
    lowCharge,
    highCharge,
    contributed,
    ...spread,
    dear,
    feeCost: spread.p50 - dear.p50,
    feeShare: spread.p50 > 0 ? (spread.p50 - dear.p50) / spread.p50 : 0,
    belowContributed: shortfallRate(
      {
        realReturn: mix.realReturn - lowCharge,
        volatility: mix.volatility,
        years,
        startValue: startingAmount,
        annualContribution: monthly * 12,
      },
      contributed,
    ),
    alternatives,
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
  difference: number;
  shareOfOutcome: number;
  firstYearCharge: number;
  /** The gap expressed as years of contributions, or null with none. */
  contributionYears: number | null;
}

export interface FeeInput extends Partial<Charges> {
  amount?: number;
  monthlyContribution?: number;
  years?: number;
  growth?: number;
}

export function feeIllustration(input: FeeInput = {}): FeeIllustration {
  const { lowCharge, highCharge } = charges(input);
  const amount = Math.max(0, input.amount ?? 10000);
  const monthlyContribution = Math.max(0, input.monthlyContribution ?? 300);
  const years = Math.min(50, Math.max(1, Math.round(input.years ?? 30)));
  const growth = input.growth ?? 0.05;
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
