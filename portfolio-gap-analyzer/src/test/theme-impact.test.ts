import { describe, expect, it } from "vitest";
import { applySleeve, themeImpact } from "@/lib/engine/theme-impact";
import { DEFAULT_PROFILE } from "@/lib/state/store";
import type { HoldingInput } from "@/lib/engine/types";

const HOLDINGS: HoldingInput[] = [
  { symbol: "VOO", value: 60000 },
  { symbol: "BND", value: 20000 },
  { symbol: "VXUS", value: 20000 },
];

describe("applySleeve", () => {
  it("funds the sleeve out of existing lines, keeping the total constant", () => {
    const next = applySleeve(HOLDINGS, 100000, { symbols: ["NVDA", "ANET"], share: 0.1 });
    const total = next.reduce((sum, h) => sum + (h.value ?? 0), 0);
    expect(total).toBeCloseTo(100000, 4);
    expect(next.find((h) => h.symbol === "NVDA")?.value).toBeCloseTo(5000, 4);
    expect(next.find((h) => h.symbol === "VOO")?.value).toBeCloseTo(54000, 4);
  });

  it("tops up a name already held rather than duplicating the line", () => {
    const next = applySleeve(HOLDINGS, 100000, { symbols: ["VOO"], share: 0.2 });
    expect(next.filter((h) => h.symbol === "VOO")).toHaveLength(1);
    // 60k scaled to 48k, plus the whole 20k sleeve.
    expect(next.find((h) => h.symbol === "VOO")?.value).toBeCloseTo(68000, 4);
  });

  it("leaves holdings untouched when nothing is picked", () => {
    expect(applySleeve(HOLDINGS, 100000, { symbols: [], share: 0.1 })).toEqual(HOLDINGS);
  });
});

describe("themeImpact", () => {
  const impact = (symbols: string[], share = 0.1) =>
    themeImpact({ holdings: HOLDINGS, cash: 5000, profile: DEFAULT_PROFILE, sleeve: { symbols, share } });

  it("reports the concentration cost of a single-stock sleeve", () => {
    const result = impact(["NVDA", "AMAT", "MU"]);
    expect(result.applicable).toBe(true);
    expect(result.after.topTenWeight).toBeGreaterThan(result.before.topTenWeight);
    expect(result.after.effectiveNames).toBeLessThan(result.before.effectiveNames);
  });

  it("reports the cost increase of an expensive thematic fund", () => {
    const result = impact(["CIBR"], 0.1);
    expect(result.after.expenseRatio).toBeGreaterThan(result.before.expenseRatio);
    expect(result.after.annualCost).toBeGreaterThan(result.before.annualCost);
  });

  it("surfaces the sector the sleeve actually moves", () => {
    const result = impact(["PANW", "CRWD", "FTNT"]);
    expect(result.sectorShifts[0]?.sector).toBe("informationTechnology");
    expect(result.sectorShifts[0]?.delta).toBeGreaterThan(0);
  });

  it("is not applicable with no holdings to fund the sleeve from", () => {
    const result = themeImpact({
      holdings: [],
      cash: 0,
      profile: DEFAULT_PROFILE,
      sleeve: { symbols: ["NVDA"], share: 0.1 },
    });
    expect(result.applicable).toBe(false);
  });
});
