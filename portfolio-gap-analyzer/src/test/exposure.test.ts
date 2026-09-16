import { describe, expect, it } from "vitest";
import { lookupSecurity } from "@/lib/data/securities";
import { aggregateExposure, buildExposure } from "@/lib/engine/exposure";
import { buildPortfolio } from "@/lib/engine/portfolio";
import { ASSET_CLASSES, REGIONS, SECTORS } from "@/lib/engine/types";

function sum(map: Record<string, number>, keys: readonly string[]): number {
  return keys.reduce((a, k) => a + (map[k] ?? 0), 0);
}

describe("buildExposure", () => {
  it("normalises an equity fund's asset classes to one", () => {
    const vti = lookupSecurity("VTI")!;
    const exposure = buildExposure(vti);
    expect(sum(exposure.assetClass, ASSET_CLASSES)).toBeCloseTo(1, 6);
  });

  it("scales sector and region maps to the equity-and-property share", () => {
    const vti = lookupSecurity("VTI")!;
    const exposure = buildExposure(vti);
    const equityish = exposure.assetClass.equity + exposure.assetClass.realEstate;
    expect(sum(exposure.sector, SECTORS)).toBeCloseTo(equityish, 6);
    expect(sum(exposure.region, REGIONS)).toBeCloseTo(equityish, 6);
  });

  it("puts a bond fund's weight in the credit buckets, not the sector ones", () => {
    const bnd = lookupSecurity("BND")!;
    const exposure = buildExposure(bnd);
    expect(exposure.assetClass.bond).toBeCloseTo(1, 6);
    expect(sum(exposure.sector, SECTORS)).toBeCloseTo(0, 6);
    expect(exposure.credit.government + exposure.credit.investmentGrade).toBeCloseTo(1, 6);
  });

  it("gives a stock a single sector, region and look-through entry", () => {
    const aapl = lookupSecurity("AAPL")!;
    const exposure = buildExposure(aapl);
    expect(exposure.sector.informationTechnology).toBe(1);
    expect(exposure.region.us).toBe(1);
    expect(exposure.lookThrough.AAPL).toBe(1);
    expect(exposure.expenseRatio).toBe(0);
  });

  it("classifies a REIT fund as property rather than equity", () => {
    const vnq = lookupSecurity("VNQ")!;
    const exposure = buildExposure(vnq);
    expect(exposure.assetClass.realEstate).toBeCloseTo(1, 6);
    expect(exposure.assetClass.equity).toBeCloseTo(0, 6);
  });
});

describe("aggregateExposure", () => {
  it("weights positions by value", () => {
    const portfolio = buildPortfolio([
      { symbol: "VTI", value: 75000 },
      { symbol: "BND", value: 25000 },
    ]);
    const exposure = aggregateExposure(portfolio.positions, 0, portfolio.totalValue, "USD");
    expect(exposure.assetClass.equity + exposure.assetClass.realEstate).toBeCloseTo(0.75, 3);
    expect(exposure.assetClass.bond).toBeCloseTo(0.25, 3);
  });

  it("counts uninvested cash as cash rather than inflating other weights", () => {
    const portfolio = buildPortfolio([{ symbol: "VTI", value: 50000 }], { cash: 50000 });
    const exposure = aggregateExposure(portfolio.positions, portfolio.cash, portfolio.totalValue, "USD");
    expect(exposure.assetClass.cash).toBeCloseTo(0.5, 6);
    expect(sum(exposure.assetClass, ASSET_CLASSES)).toBeCloseTo(1, 6);
  });

  it("weights bond duration by the bond sleeve, not the whole portfolio", () => {
    const portfolio = buildPortfolio([
      { symbol: "VTI", value: 90000 },
      { symbol: "TLT", value: 10000 },
    ]);
    const exposure = aggregateExposure(portfolio.positions, 0, portfolio.totalValue, "USD");
    expect(exposure.duration).toBeCloseTo(16.8, 1);
  });

  it("adds look-through weights across funds that hold the same company", () => {
    const portfolio = buildPortfolio([
      { symbol: "VOO", value: 50000 },
      { symbol: "QQQ", value: 50000 },
    ]);
    const exposure = aggregateExposure(portfolio.positions, 0, portfolio.totalValue, "USD");
    // NVDA is 7.1% of VOO and 9.6% of QQQ, so half of each.
    expect(exposure.lookThrough.NVDA).toBeCloseTo((0.071 + 0.096) / 2, 3);
  });
});
