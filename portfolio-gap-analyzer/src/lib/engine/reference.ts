import { scale } from "./factors";
import { DEFAULT_PRESET, PRESETS, SLEEVE_ASSUMPTIONS, type ReferencePresetId } from "./presets";
import {
  ASSET_CLASSES,
  REGIONS,
  SECTORS,
  SIZE_BUCKETS,
  type AssetClass,
  type CreditBucket,
  type InvestorProfile,
  type ReferenceModel,
  type Region,
  type Sector,
  type SizeBucket,
} from "./types";

/**
 * Approximate free-float market-capitalisation weights of listed global
 * equities. This is the reference model's anchor and the reason the tool can
 * flag a "gap" without giving advice: the market portfolio is an observable
 * fact about what everyone collectively owns, not an opinion about what anyone
 * should own. Deviating from it is a choice — the tool's job is to show the
 * investor which deviations they have made, deliberately or otherwise.
 */
const MARKET_REGION_WEIGHTS: Record<Region, number> = {
  us: 0.635,
  canada: 0.027,
  uk: 0.034,
  europeExUk: 0.119,
  japan: 0.053,
  asiaPacificDeveloped: 0.037,
  emergingMarkets: 0.095,
};

const MARKET_SECTOR_WEIGHTS: Record<Sector, number> = {
  informationTechnology: 0.263,
  communicationServices: 0.087,
  consumerDiscretionary: 0.104,
  consumerStaples: 0.061,
  energy: 0.038,
  financials: 0.163,
  healthCare: 0.101,
  industrials: 0.112,
  materials: 0.035,
  realEstate: 0.023,
  utilities: 0.029,
};

const MARKET_SIZE_WEIGHTS: Record<SizeBucket, number> = { large: 0.72, mid: 0.19, small: 0.09 };

/** Roughly what a two- or three-fund index portfolio costs to run per year. */
const LOW_COST_INDEX_BENCHMARK = 0.0015;

export interface ReferenceOverrides {
  /** Which published index the equity side is modelled on. */
  presetId?: ReferencePresetId;
  /** Replace the derived growth-asset share, 0-1. */
  growthShare?: number;
  /** Set the bond sleeve directly, 0-1. Growth takes whatever is left after cash. */
  bondShare?: number;
  /** Replace the derived cash floor, 0-1. */
  cashShare?: number;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function pct(x: number): string {
  return `${(x * 100).toFixed(0)}%`;
}

function scaleMap<K extends string>(weights: Record<K, number>, keys: readonly K[], target: number): Record<K, number> {
  const total = keys.reduce((a, k) => a + weights[k], 0);
  const out = {} as Record<K, number>;
  for (const k of keys) out[k] = total > 0 ? (weights[k] / total) * target : 0;
  return out;
}

/**
 * Risk capacity is about circumstances, not feelings: how long the money can be
 * left alone, whether there is a cash buffer in front of it, and how much new
 * money is arriving. It caps the risk tolerance the investor reports, because
 * being comfortable with volatility does not create the ability to sit through it.
 */
function riskCapacity(profile: InvestorProfile, portfolioValue: number): number {
  const horizon = scale(profile.horizonYears, 1, 20);
  const buffer = scale(profile.emergencyFundMonths, 0, 6);
  const annualContribution = profile.monthlyContribution * 12;
  const contributionRatio = portfolioValue > 0 ? annualContribution / portfolioValue : 0;
  const inflows = scale(contributionRatio, 0, 0.15);
  const drawdownPressure = 1 - scale(profile.incomeNeedRate, 0, 0.06);
  return clamp(horizon * 0.5 + buffer * 0.2 + inflows * 0.15 + drawdownPressure * 0.15, 0, 1);
}

export function buildReferenceModel(
  profile: InvestorProfile,
  portfolioValue: number,
  overrides: ReferenceOverrides = {},
): ReferenceModel {
  const preset = PRESETS[overrides.presetId ?? DEFAULT_PRESET];
  const rationale: string[] = [`Equity side modelled on ${preset.label}: ${preset.blurb}`];
  const capacity = riskCapacity(profile, portfolioValue);

  // 1. Growth share from the horizon, then nudged by tolerance and capped by capacity.
  const horizonBase = clamp(0.2 + 0.055 * profile.horizonYears, 0.2, 0.9);
  const toleranceAdjustment = (profile.riskTolerance - 3) * 0.06;
  const capacityCeiling = 0.5 + 0.42 * capacity;
  let growthShare = clamp(Math.min(horizonBase + toleranceAdjustment, capacityCeiling), 0.1, 0.95);

  rationale.push(
    `Horizon of ${profile.horizonYears} year${profile.horizonYears === 1 ? "" : "s"} sets a starting growth share of ${pct(horizonBase)} (20% plus 5.5 points per year, capped at 90%).`,
  );
  rationale.push(
    toleranceAdjustment === 0
      ? "Risk tolerance of 3 out of 5 leaves that unchanged."
      : `Risk tolerance of ${profile.riskTolerance} out of 5 adjusts it by ${toleranceAdjustment > 0 ? "+" : ""}${(toleranceAdjustment * 100).toFixed(0)} points.`,
  );
  rationale.push(
    `Risk capacity scores ${(capacity * 100).toFixed(0)}/100 on horizon, cash buffer, contributions and income needs, which caps growth assets at ${pct(capacityCeiling)}.`,
  );

  // 2. A cash floor for near-term spending, ahead of any market exposure.
  const incomeFloor = Math.min(0.25, profile.incomeNeedRate * 3);
  const bufferGapMonths = Math.max(0, 3 - profile.emergencyFundMonths);
  const bufferFloor = portfolioValue > 0
    ? Math.min(0.2, (bufferGapMonths * profile.monthlyEssentialSpend) / portfolioValue)
    : 0;
  let cashShare = overrides.cashShare ?? clamp(Math.max(0.02, incomeFloor, bufferFloor), 0, 0.35);

  if (incomeFloor > 0.02) {
    rationale.push(
      `Drawing ${(profile.incomeNeedRate * 100).toFixed(1)}% a year sets aside ${pct(incomeFloor)} in cash — about three years of withdrawals held outside markets.`,
    );
  }
  if (bufferFloor > 0.02) {
    rationale.push(
      `The emergency fund is ${profile.emergencyFundMonths} month${profile.emergencyFundMonths === 1 ? "" : "s"} against a 3-month reference, so ${pct(bufferFloor)} is reserved to close that gap before anything else.`,
    );
  }

  if (overrides.bondShare !== undefined) {
    // A bond allocation set directly wins over the glidepath: the investor has
    // answered the question the glidepath exists to estimate.
    const bondShare = clamp(overrides.bondShare, 0, 1);
    cashShare = Math.min(cashShare, Math.max(0, 1 - bondShare));
    growthShare = Math.max(0, 1 - bondShare - cashShare);
    rationale.push(
      `Bond allocation set directly to ${pct(bondShare)}, which leaves ${pct(growthShare)} in growth assets and replaces the horizon glidepath above.`,
    );
  } else if (overrides.growthShare !== undefined) {
    growthShare = clamp(overrides.growthShare, 0, 1);
    rationale.push(`Growth share manually set to ${pct(growthShare)}, replacing the derived figure.`);
  }
  if (growthShare + cashShare > 1) cashShare = Math.max(0, 1 - growthShare);

  const defensiveShare = Math.max(0, 1 - growthShare - cashShare);

  // 3. Split growth between listed equity and listed property at market weights.
  const propertyShareOfMarket = MARKET_SECTOR_WEIGHTS.realEstate;
  const assetClassWeights: Record<AssetClass, number> = {
    equity: growthShare * (1 - propertyShareOfMarket),
    realEstate: growthShare * propertyShareOfMarket,
    bond: defensiveShare,
    cash: cashShare,
    commodity: 0,
    other: 0,
  };
  rationale.push(
    `Growth assets are held as listed equity and listed property at their market weights. Commodities are excluded because they produce no cash flow — change that assumption if you disagree with it.`,
  );

  // 4. Region weights come from the chosen index, plus any home bias on top.
  const equityish = assetClassWeights.equity + assetClassWeights.realEstate;
  const homeTilt = clamp(profile.homeBiasAllowancePp / 100, 0, 0.6);
  const tiltedRegions = { ...preset.region };
  const home = profile.homeRegion;
  const others = REGIONS.filter((r) => r !== home);
  const otherTotal = others.reduce((a, r) => a + preset.region[r], 0);

  if (homeTilt > 0 && otherTotal > 0) {
    tiltedRegions[home] = preset.region[home] + homeTilt;
    for (const r of others) {
      tiltedRegions[r] = preset.region[r] * (1 - homeTilt / otherTotal);
    }
    rationale.push(
      `${preset.label} weights, plus the ${profile.homeBiasAllowancePp} point home tilt you asked for, taken pro rata from every other region.`,
    );
  } else if (homeTilt > 0) {
    // A single-country index has no other region to take the tilt from.
    rationale.push(
      `The ${profile.homeBiasAllowancePp} point home tilt has no effect against ${preset.label}, which holds only one region already.`,
    );
  } else {
    rationale.push(`Regions, sectors and company sizes follow ${preset.label} as published, with no home-country tilt applied.`);
  }

  // 5. Bond sleeve: duration roughly matched to the horizon, credit risk kept low.
  const targetDuration = clamp(profile.horizonYears * 0.6, 1.5, 9);
  const credit: Record<CreditBucket, number> = scaleMap(
    { government: 0.65, investmentGrade: 0.35, highYield: 0 },
    ["government", "investmentGrade", "highYield"] as const,
    defensiveShare + cashShare,
  );
  rationale.push(
    `Bond duration is set near ${targetDuration.toFixed(1)} years, roughly 60% of the horizon, and the sleeve is government and investment-grade only — high yield behaves more like equity than like ballast.`,
  );

  // Blend the sleeve assumptions into one expected return and volatility.
  const bondWeight = defensiveShare;
  const cashWeight = cashShare;
  const equityWeight = equityish;
  const { bonds, cash, equityBondCorrelation } = SLEEVE_ASSUMPTIONS;
  const expectedRealReturn =
    equityWeight * preset.realReturn + bondWeight * bonds.realReturn + cashWeight * cash.realReturn;
  const variance =
    (equityWeight * preset.volatility) ** 2 +
    (bondWeight * bonds.volatility) ** 2 +
    (cashWeight * cash.volatility) ** 2 +
    2 * equityWeight * bondWeight * equityBondCorrelation * preset.volatility * bonds.volatility;

  return {
    id: preset.id,
    label: `${preset.label} reference`,
    presetId: preset.id,
    presetLabel: preset.label,
    indexNote: preset.consequence,
    expectedRealReturn,
    expectedVolatility: Math.sqrt(variance),
    rationale,
    assetClass: scaleMap(assetClassWeights, ASSET_CLASSES, 1),
    region: scaleMap(tiltedRegions, REGIONS, equityish),
    sector: scaleMap(preset.sector, SECTORS, equityish),
    size: scaleMap(preset.size, SIZE_BUCKETS, equityish),
    credit,
    targetDuration,
    costBenchmark: LOW_COST_INDEX_BENCHMARK,
    inputs: {
      growthShare,
      riskCapacityScore: capacity,
      homeRegion: profile.homeRegion,
      homeBiasAllowancePp: profile.homeBiasAllowancePp,
    },
  };
}

export { MARKET_REGION_WEIGHTS, MARKET_SECTOR_WEIGHTS, MARKET_SIZE_WEIGHTS, LOW_COST_INDEX_BENCHMARK };
