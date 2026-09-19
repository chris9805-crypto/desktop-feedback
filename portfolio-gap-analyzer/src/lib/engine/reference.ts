import { scale } from "./factors";
import { DEFAULT_PRESET, INFLATION_STANCES, PRESETS, SLEEVE_ASSUMPTIONS, type ReferencePresetId } from "./presets";
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

/**
 * The growth share each tolerance answer allows, from "a 10% fall would worry
 * me" to "a 50% fall would not change what I do". These are the volatility
 * someone says they can live with, translated into an allocation.
 */
const TOLERANCE_GROWTH: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 0.25,
  2: 0.42,
  3: 0.6,
  4: 0.78,
  5: 0.92,
};

/** Names the band a growth share falls into, so the model is describable in a word. */
function riskProfileLabel(growthShare: number): string {
  if (growthShare < 0.35) return "Defensive";
  if (growthShare < 0.52) return "Cautious";
  if (growthShare < 0.68) return "Balanced";
  if (growthShare < 0.85) return "Growth";
  return "Adventurous";
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

  // 1. Three independent constraints on the growth share; the tightest wins.
  //
  // Taking the minimum rather than blending is the point. Each one is a real
  // limit on its own terms: what you would sit through, what your circumstances
  // can absorb, and how long the money has to recover. Averaging them lets a
  // long horizon talk a cautious investor into an allocation they will abandon
  // in the first bad year, which is how the earlier residual model behaved.
  const toleranceLimit = TOLERANCE_GROWTH[profile.riskTolerance];
  const capacityLimit = clamp(0.2 + 0.75 * capacity, 0.2, 0.95);
  const horizonLimit = clamp(0.15 + 0.06 * profile.horizonYears, 0.15, 0.95);

  const limits = [
    { name: "tolerance" as const, value: toleranceLimit },
    { name: "capacity" as const, value: capacityLimit },
    { name: "horizon" as const, value: horizonLimit },
  ].sort((a, b) => a.value - b.value);
  const binding = limits[0]!;
  let growthShare = clamp(binding.value, 0.05, 0.95);
  let bindingConstraint: "tolerance" | "capacity" | "horizon" = binding.name;

  rationale.push(
    `Three limits on growth assets: risk tolerance ${profile.riskTolerance}/5 allows ${pct(toleranceLimit)}, your circumstances allow ${pct(capacityLimit)}, and a ${profile.horizonYears}-year horizon allows ${pct(horizonLimit)}.`,
  );
  rationale.push(
    `The tightest wins, so ${binding.name === "tolerance" ? "risk tolerance" : binding.name === "capacity" ? "risk capacity" : "the horizon"} sets growth assets at ${pct(growthShare)}. Raising the other two would not move it.`,
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
    bindingConstraint = "tolerance";
    rationale.push(
      `Bond allocation set directly to ${pct(bondShare)}, which leaves ${pct(growthShare)} in growth assets and replaces the three limits above.`,
    );
  } else if (overrides.growthShare !== undefined) {
    growthShare = clamp(overrides.growthShare, 0, 1);
    bindingConstraint = "tolerance";
    rationale.push(`Growth share manually set to ${pct(growthShare)}, replacing the derived figure.`);
  }
  if (growthShare + cashShare > 1) cashShare = Math.max(0, 1 - growthShare);

  const defensiveShare = Math.max(0, 1 - growthShare - cashShare);

  // 3. Split growth between listed equity and listed property at market weights,
  //    then carve any commodity sleeve out of the defensive side rather than
  //    the growth side — it is held instead of bonds, not instead of shares.
  const stance = INFLATION_STANCES[profile.inflationConcern] ?? INFLATION_STANCES[0]!;
  const commodityShare = Math.min(stance.commodityShare, defensiveShare * 0.45);
  const bondShareFinal = Math.max(0, defensiveShare - commodityShare);

  const propertyShareOfMarket = MARKET_SECTOR_WEIGHTS.realEstate;
  const assetClassWeights: Record<AssetClass, number> = {
    equity: growthShare * (1 - propertyShareOfMarket),
    realEstate: growthShare * propertyShareOfMarket,
    bond: bondShareFinal,
    cash: cashShare,
    commodity: commodityShare,
    other: 0,
  };
  rationale.push("Growth assets are held as listed equity and listed property at their market weights.");

  if (commodityShare > 0.001) {
    rationale.push(
      `Inflation concern is ${stance.label.toLowerCase()}, so ${pct(stance.linkerShareOfBonds)} of the bond sleeve is inflation-linked and ${pct(commodityShare)} of the portfolio is commodities. The commodities come out of the bond sleeve, which makes that sleeve a less reliable cushion against an equity fall — that is the trade.`,
    );
  } else {
    rationale.push(
      "Inflation concern is low, so the defensive sleeve is nominal bonds only. Those cushion an equity fall well and lose purchasing power in an inflation shock.",
    );
  }

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
  const linker = stance.linkerShareOfBonds;
  const credit: Record<CreditBucket, number> = scaleMap(
    {
      government: (1 - linker) * 0.65,
      inflationLinked: linker,
      investmentGrade: (1 - linker) * 0.35,
      highYield: 0,
    },
    ["government", "inflationLinked", "investmentGrade", "highYield"] as const,
    bondShareFinal + cashShare,
  );
  rationale.push(
    `Bond duration is near ${targetDuration.toFixed(1)} years, roughly 60% of the horizon. No high yield — it behaves more like equity than like ballast.`,
  );

  // Blend the sleeve assumptions into one expected return and volatility.
  const { bonds, inflationLinked, commodities, cash, equityBondCorrelation, equityCommodityCorrelation } =
    SLEEVE_ASSUMPTIONS;
  const equityWeight = equityish;
  const nominalWeight = bondShareFinal * (1 - linker);
  const linkerWeight = bondShareFinal * linker;
  const cashWeight = cashShare;

  const expectedRealReturn =
    equityWeight * preset.realReturn +
    nominalWeight * bonds.realReturn +
    linkerWeight * inflationLinked.realReturn +
    commodityShare * commodities.realReturn +
    cashWeight * cash.realReturn;

  const bondWeight = nominalWeight + linkerWeight;
  const blendedBondVol =
    bondWeight > 0 ? (nominalWeight * bonds.volatility + linkerWeight * inflationLinked.volatility) / bondWeight : 0;
  const variance =
    (equityWeight * preset.volatility) ** 2 +
    (bondWeight * blendedBondVol) ** 2 +
    (commodityShare * commodities.volatility) ** 2 +
    (cashWeight * cash.volatility) ** 2 +
    2 * equityWeight * bondWeight * equityBondCorrelation * preset.volatility * blendedBondVol +
    2 * equityWeight * commodityShare * equityCommodityCorrelation * preset.volatility * commodities.volatility;

  return {
    id: preset.id,
    label: `${preset.label} reference`,
    presetId: preset.id,
    presetLabel: preset.label,
    riskProfileLabel: riskProfileLabel(growthShare),
    bindingConstraint,
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
