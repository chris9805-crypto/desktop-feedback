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

  it("uses global market weights when no home tilt is asked for", () => {
    const model = buildReferenceModel(profile({ horizonYears: 30, riskTolerance: 5 }), 100000);
    const equityish = model.assetClass.equity + model.assetClass.realEstate;
    expect(model.region.us / equityish).toBeCloseTo(0.635, 3);
    expect(model.region.emergingMarkets / equityish).toBeCloseTo(0.095, 3);
  });

  it("applies a home tilt pro rata across the other regions", () => {
    const model = buildReferenceModel(profile({ homeRegion: "uk", homeBiasAllowancePp: 20 }), 100000);
    const equityish = model.assetClass.equity + model.assetClass.realEstate;
    expect(model.region.uk / equityish).toBeCloseTo(0.234, 3);
    expect(sum(model.region, REGIONS)).toBeCloseTo(equityish, 6);
  });

  it("explains every step it took", () => {
    const model = buildReferenceModel(profile(), 100000);
    expect(model.rationale.length).toBeGreaterThanOrEqual(4);
    expect(model.rationale.join(" ")).toContain("Horizon");
  });

  it("honours a manual growth-share override and says so", () => {
    const model = buildReferenceModel(profile(), 100000, { growthShare: 0.5 });
    expect(model.inputs.growthShare).toBeCloseTo(0.5, 6);
    expect(model.rationale.join(" ")).toContain("manually set");
  });
});
