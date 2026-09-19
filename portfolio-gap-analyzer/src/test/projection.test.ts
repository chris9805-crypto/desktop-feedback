import { describe, expect, it } from "vitest";
import { buildProjection } from "@/lib/engine/projection";
import { buildReferenceModel } from "@/lib/engine/reference";
import { profile } from "./fixtures";

const reference = (o = {}) => buildReferenceModel(profile(), 100000, o);

describe("buildProjection", () => {
  it("is deterministic, so the figures do not jitter between renders", () => {
    const a = buildProjection(reference(), profile(), 100000);
    const b = buildProjection(reference(), profile(), 100000);
    expect(a.final.p50).toBe(b.final.p50);
    expect(a.final.p10).toBe(b.final.p10);
  });

  it("keeps the percentiles in order at every step", () => {
    const p = buildProjection(reference(), profile({ horizonYears: 25 }), 100000);
    expect(p.points).toHaveLength(26);
    for (const point of p.points) {
      expect(point.p10).toBeLessThanOrEqual(point.p50);
      expect(point.p50).toBeLessThanOrEqual(point.p90);
    }
  });

  it("starts at today's balance with no spread", () => {
    const p = buildProjection(reference(), profile(), 250000);
    expect(p.points[0]!.p50).toBe(250000);
    expect(p.points[0]!.p10).toBe(250000);
    expect(p.points[0]!.p90).toBe(250000);
  });

  it("tracks money paid in separately from what it might grow to", () => {
    const p = buildProjection(reference(), profile({ monthlyContribution: 1000, horizonYears: 10 }), 50000);
    expect(p.final.contributed).toBe(50000 + 1000 * 12 * 10);
  });

  it("widens the band as the horizon lengthens", () => {
    const short = buildProjection(reference(), profile({ horizonYears: 5 }), 100000);
    const long = buildProjection(reference(), profile({ horizonYears: 30 }), 100000);
    const spread = (p: typeof short) => (p.final.p90 - p.final.p10) / p.final.p50;
    expect(spread(long)).toBeGreaterThan(spread(short));
  });

  it("narrows the band when the mix holds more bonds", () => {
    const equity = buildProjection(reference({ bondShare: 0 }), profile({ horizonYears: 20 }), 100000);
    const bonds = buildProjection(reference({ bondShare: 0.7 }), profile({ horizonYears: 20 }), 100000);
    const spread = (p: typeof equity) => (p.final.p90 - p.final.p10) / p.final.p50;
    expect(spread(bonds)).toBeLessThan(spread(equity));
  });

  it("never returns a negative balance", () => {
    const p = buildProjection(reference(), profile({ horizonYears: 40 }), 10000, { realReturn: -0.05, volatility: 0.4 });
    for (const point of p.points) expect(point.p10).toBeGreaterThanOrEqual(0);
  });

  it("honours an overridden return assumption", () => {
    const low = buildProjection(reference(), profile({ horizonYears: 20 }), 100000, { realReturn: 0.01 });
    const high = buildProjection(reference(), profile({ horizonYears: 20 }), 100000, { realReturn: 0.07 });
    expect(high.final.p50).toBeGreaterThan(low.final.p50);
    expect(low.assumptions.realReturn).toBe(0.01);
  });

  it("states that the figures are in today's money and that it is not a forecast", () => {
    const notes = buildProjection(reference(), profile(), 100000).notes.join(" ");
    expect(notes).toContain("today's money");
    expect(notes).toContain("not a forecast");
  });
});
