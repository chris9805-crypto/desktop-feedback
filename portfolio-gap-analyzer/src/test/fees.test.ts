import { describe, expect, it } from "vitest";
import { compareFees } from "@/lib/engine/fees";

describe("compareFees", () => {
  it("costs nothing when the charge matches the low-cost benchmark", () => {
    const r = compareFees({ amount: 100000, offeredCharge: 0.0015, years: 20 });
    expect(r.difference).toBeCloseTo(0, 6);
  });

  it("turns a percentage into money over a long horizon", () => {
    const r = compareFees({ amount: 100000, offeredCharge: 0.015, years: 30 });
    // A 1.35pp gap over 30 years costs a large share of the outcome.
    expect(r.shareOfOutcome).toBeGreaterThan(0.25);
    expect(r.difference).toBeGreaterThan(100000);
  });

  it("counts the charge plus what it would have earned, not just the charge", () => {
    const r = compareFees({ amount: 100000, offeredCharge: 0.01, years: 25 });
    const naive = 100000 * 0.01 * 25;
    expect(r.offered.totalCost).toBeGreaterThan(naive);
  });

  it("includes contributions in the comparison", () => {
    const lump = compareFees({ amount: 10000, offeredCharge: 0.012, years: 25 });
    const saving = compareFees({ amount: 10000, monthlyContribution: 300, offeredCharge: 0.012, years: 25 });
    expect(saving.difference).toBeGreaterThan(lump.difference);
  });

  it("grows the gap with the horizon", () => {
    const short = compareFees({ amount: 100000, offeredCharge: 0.012, years: 5 });
    const long = compareFees({ amount: 100000, offeredCharge: 0.012, years: 30 });
    expect(long.shareOfOutcome).toBeGreaterThan(short.shareOfOutcome);
  });

  it("reports the first-year charge people are actually quoted", () => {
    const r = compareFees({ amount: 50000, offeredCharge: 0.0175, years: 10 });
    expect(r.firstYearCharge).toBeCloseTo(875, 6);
  });

  it("handles a zero charge and a zero balance without breaking", () => {
    expect(compareFees({ amount: 0, offeredCharge: 0.01, years: 10 }).difference).toBe(0);
    const free = compareFees({ amount: 1000, offeredCharge: 0, years: 10 });
    expect(free.difference).toBeLessThan(0);
  });
});
