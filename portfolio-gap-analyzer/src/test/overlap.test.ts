import { describe, expect, it } from "vitest";
import { lookupSecurity } from "@/lib/data/securities";
import { estimateOverlap } from "@/lib/engine/gaps/overlap";
import type { EtfSecurity } from "@/lib/engine/types";

const etf = (symbol: string) => lookupSecurity(symbol) as EtfSecurity;

describe("estimateOverlap", () => {
  it("scores two funds on the same index as near-identical", () => {
    expect(estimateOverlap(etf("VOO"), etf("SPY"))).toBeGreaterThan(0.95);
  });

  it("scores a total-market fund against an S&P 500 fund as a close match", () => {
    expect(estimateOverlap(etf("VTI"), etf("VOO"))).toBeGreaterThan(0.8);
  });

  it("does not treat the Nasdaq-100 as a duplicate of the S&P 500", () => {
    // They share their largest holdings, but the sector and size shapes differ
    // enough that calling QQQ redundant next to VOO would be wrong.
    const overlap = estimateOverlap(etf("QQQ"), etf("VOO"));
    expect(overlap).toBeGreaterThan(0.5);
    expect(overlap).toBeLessThan(0.8);
  });

  it("keeps unrelated exposures far apart", () => {
    expect(estimateOverlap(etf("VOO"), etf("BND"))).toBeLessThan(0.1);
    expect(estimateOverlap(etf("VOO"), etf("VWO"))).toBeLessThan(0.2);
    expect(estimateOverlap(etf("XLE"), etf("XLK"))).toBeLessThan(0.3);
  });

  it("is symmetric", () => {
    expect(estimateOverlap(etf("VTI"), etf("VOO"))).toBeCloseTo(estimateOverlap(etf("VOO"), etf("VTI")), 6);
  });

  it("does not flag a value fund as a duplicate of a growth fund", () => {
    expect(estimateOverlap(etf("VTV"), etf("VUG"))).toBeLessThan(0.7);
  });
});
