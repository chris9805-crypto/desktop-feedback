import { describe, expect, it } from "vitest";
import { buildReferenceModel } from "@/lib/engine/reference";
import { ASSET_CLASSES, REGIONS, SECTORS } from "@/lib/engine/types";
import { profile } from "./fixtures";

function sum(map: Record<string, number>, keys: readonly string[]): number {
  return keys.reduce((a, k) => a + (map[k] ?? 0), 0);
}

describe("buildReferenceModel", () => {
  it("allocates exactly the whole portfolio", () => {
    const model = buildReferenceModel(profile(), 100000);
    expect(sum(model.assetClass, ASSET_CLASSES)).toBeCloseTo(1, 6);
  });

  it("scales region and sector weights to the equity-and-property share", () => {
    const model = buildReferenceModel(profile({ horizonYears: 10 }), 100000);
    const equityish = model.assetClass.equity + model.assetClass.realEstate;
    expect(sum(model.region, REGIONS)).toBeCloseTo(equityish, 6);
    expect(sum(model.sector, SECTORS)).toBeCloseTo(equityish, 6);
  });

  it("raises the growth share as the horizon lengthens", () => {
    const short = buildReferenceModel(profile({ horizonYears: 3 }), 100000);
    const long = buildReferenceModel(profile({ horizonYears: 30 }), 100000);
    expect(long.inputs.growthShare).toBeGreaterThan(short.inputs.growthShare);
  });

  it("caps growth by risk capacity even when tolerance is at the maximum", () => {
    const noCapacity = buildReferenceModel(
      profile({ horizonYears: 30, riskTolerance: 5, emergencyFundMonths: 0, incomeNeedRate: 0.05, monthlyContribution: 0 }),
      100000,
    );
    const fullCapacity = buildReferenceModel(profile({ horizonYears: 30, riskTolerance: 5 }), 100000);
    expect(noCapacity.inputs.growthShare).toBeLessThan(fullCapacity.inputs.growthShare);
  });

  it("reserves cash to cover a drawdown need", () => {
    const drawing = buildReferenceModel(profile({ incomeNeedRate: 0.04, horizonYears: 25 }), 100000);
    expect(drawing.assetClass.cash).toBeCloseTo(0.12, 2);
  });

  it("matches bond duration to roughly 60% of the horizon, within bounds", () => {
    expect(buildReferenceModel(profile({ horizonYears: 10 }), 100000).targetDuration).toBeCloseTo(6, 6);
    expect(buildReferenceModel(profile({ horizonYears: 1 }), 100000).targetDuration).toBeCloseTo(1.5, 6);
    expect(buildReferenceModel(profile({ horizonYears: 40 }), 100000).targetDuration).toBeCloseTo(9, 6);
  });

  it("defaults to MSCI World, which holds no emerging markets", () => {
    const model = buildReferenceModel(profile({ horizonYears: 30, riskTolerance: 5 }), 100000);
    const equityish = model.assetClass.equity + model.assetClass.realEstate;
    expect(model.presetId).toBe("msciWorld");
    expect(model.region.us / equityish).toBeCloseTo(0.706, 3);
    expect(model.region.emergingMarkets).toBe(0);
  });

  it("uses global market weights when the all-cap index is chosen", () => {
    const model = buildReferenceModel(profile({ horizonYears: 30, riskTolerance: 5 }), 100000, { presetId: "globalAllCap" });
    const equityish = model.assetClass.equity + model.assetClass.realEstate;
    expect(model.region.us / equityish).toBeCloseTo(0.635, 3);
    expect(model.region.emergingMarkets / equityish).toBeCloseTo(0.095, 3);
  });

  it("puts the whole equity sleeve in the US when the S&P 500 is chosen", () => {
    const model = buildReferenceModel(profile(), 100000, { presetId: "sp500" });
    const equityish = model.assetClass.equity + model.assetClass.realEstate;
    expect(model.region.us).toBeCloseTo(equityish, 6);
    expect(model.region.japan).toBe(0);
  });

  it("applies a home tilt pro rata across the other regions", () => {
    const model = buildReferenceModel(profile({ homeRegion: "uk", homeBiasAllowancePp: 20 }), 100000);
    const equityish = model.assetClass.equity + model.assetClass.realEstate;
    expect(model.region.uk / equityish).toBeCloseTo(0.237, 3);
    expect(sum(model.region, REGIONS)).toBeCloseTo(equityish, 6);
  });

  it("says so rather than dividing by zero when a home tilt has nowhere to come from", () => {
    const model = buildReferenceModel(profile({ homeRegion: "us", homeBiasAllowancePp: 30 }), 100000, { presetId: "sp500" });
    const equityish = model.assetClass.equity + model.assetClass.realEstate;
    expect(model.region.us).toBeCloseTo(equityish, 6);
    expect(model.rationale.join(" ")).toContain("no effect");
  });

  it("lets a bond allocation replace the derived limits", () => {
    const model = buildReferenceModel(profile({ horizonYears: 30, inflationConcern: 0 }), 100000, { bondShare: 0.4 });
    expect(model.assetClass.bond).toBeCloseTo(0.4, 6);
    expect(model.inputs.growthShare).toBeCloseTo(1 - 0.4 - model.assetClass.cash, 6);
    expect(model.rationale.join(" ")).toContain("Bond allocation set directly");
  });

  it("funds commodities out of the bond sleeve, not out of equities", () => {
    const base = buildReferenceModel(profile({ inflationConcern: 0 }), 100000);
    const hedged = buildReferenceModel(profile({ inflationConcern: 2 }), 100000);
    expect(hedged.inputs.growthShare).toBeCloseTo(base.inputs.growthShare, 6);
    expect(hedged.assetClass.commodity).toBeGreaterThan(0);
    expect(hedged.assetClass.bond + hedged.assetClass.commodity).toBeCloseTo(base.assetClass.bond, 6);
  });

  it("moves the defensive sleeve into linkers as inflation concern rises", () => {
    const low = buildReferenceModel(profile({ inflationConcern: 0 }), 100000);
    const high = buildReferenceModel(profile({ inflationConcern: 2 }), 100000);
    expect(low.credit.inflationLinked).toBe(0);
    expect(high.credit.inflationLinked).toBeGreaterThan(high.credit.government);
  });

  it("caps commodities so they cannot swamp a thin defensive sleeve", () => {
    // Maximum tolerance leaves very little defensive sleeve to carve from.
    const model = buildReferenceModel(profile({ riskTolerance: 5, inflationConcern: 2 }), 100000);
    const defensive = model.assetClass.bond + model.assetClass.commodity;
    expect(model.assetClass.commodity).toBeLessThanOrEqual(defensive * 0.45 + 1e-9);
  });

  it("gives the risk profile a real spread across tolerance", () => {
    const bonds = ([1, 2, 3, 4, 5] as const).map(
      (riskTolerance) => buildReferenceModel(profile({ horizonYears: 25, riskTolerance }), 100000).assetClass.bond,
    );
    // Strictly decreasing, and wide: the old residual model spanned 13 points.
    for (let i = 1; i < bonds.length; i++) expect(bonds[i]!).toBeLessThan(bonds[i - 1]!);
    expect(bonds[0]! - bonds[4]!).toBeGreaterThan(0.4);
  });

  it("names the tightest constraint rather than blending them", () => {
    const cautious = buildReferenceModel(profile({ horizonYears: 30, riskTolerance: 1 }), 100000);
    expect(cautious.bindingConstraint).toBe("tolerance");
    expect(cautious.riskProfileLabel).toBe("Defensive");

    const soon = buildReferenceModel(profile({ horizonYears: 3, riskTolerance: 5 }), 100000);
    expect(soon.bindingConstraint).toBe("horizon");

    const noBuffer = buildReferenceModel(
      profile({ horizonYears: 30, riskTolerance: 5, emergencyFundMonths: 0, monthlyContribution: 0, incomeNeedRate: 0.05 }),
      100000,
    );
    expect(noBuffer.bindingConstraint).toBe("capacity");
  });

  it("labels the band the allocation lands in", () => {
    expect(buildReferenceModel(profile({ riskTolerance: 1, horizonYears: 30 }), 100000).riskProfileLabel).toBe("Defensive");
    expect(buildReferenceModel(profile({ riskTolerance: 3, horizonYears: 30 }), 100000).riskProfileLabel).toBe("Balanced");
    expect(buildReferenceModel(profile({ riskTolerance: 5, horizonYears: 30 }), 100000).riskProfileLabel).toBe("Adventurous");
  });

  it("carries a return assumption that falls as bonds rise", () => {
    const equityHeavy = buildReferenceModel(profile(), 100000, { bondShare: 0 });
    const bondHeavy = buildReferenceModel(profile(), 100000, { bondShare: 0.6 });
    expect(equityHeavy.expectedRealReturn).toBeGreaterThan(bondHeavy.expectedRealReturn);
    expect(equityHeavy.expectedVolatility).toBeGreaterThan(bondHeavy.expectedVolatility);
  });

  it("prices the S&P 500 above MSCI World on the historical assumptions", () => {
    const world = buildReferenceModel(profile(), 100000, { presetId: "msciWorld", bondShare: 0 });
    const us = buildReferenceModel(profile(), 100000, { presetId: "sp500", bondShare: 0 });
    expect(us.expectedRealReturn).toBeGreaterThan(world.expectedRealReturn);
  });

  it("explains every step it took", () => {
    const model = buildReferenceModel(profile(), 100000);
    expect(model.rationale.length).toBeGreaterThanOrEqual(4);
    expect(model.rationale.join(" ")).toContain("Three limits");
  });

  it("honours a manual growth-share override and says so", () => {
    const model = buildReferenceModel(profile(), 100000, { growthShare: 0.5 });
    expect(model.inputs.growthShare).toBeCloseTo(0.5, 6);
    expect(model.rationale.join(" ")).toContain("manually set");
  });
});
