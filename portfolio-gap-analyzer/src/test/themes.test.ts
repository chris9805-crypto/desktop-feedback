import { describe, expect, it } from "vitest";
import { THEMES, matchesFor, themeById } from "@/lib/engine/themes";

describe("themes", () => {
  it("every theme finds something in the bundled universe", () => {
    for (const theme of THEMES) {
      const { stocks, funds } = matchesFor(theme);
      expect(stocks.length + funds.length, `${theme.id} matched nothing`).toBeGreaterThan(2);
    }
  });

  it("every theme states its criteria and its case against", () => {
    for (const theme of THEMES) {
      expect(theme.criteria.length, theme.id).toBeGreaterThan(60);
      expect(theme.caution.length, theme.id).toBeGreaterThan(80);
    }
  });

  it("puts the right names in AI infrastructure", () => {
    const symbols = matchesFor(themeById("ai-infrastructure")!).stocks.map((s) => s.symbol);
    expect(symbols).toContain("NVDA");
    expect(symbols).toContain("ANET");
    expect(symbols).toContain("VRT");
    expect(symbols).not.toContain("KO");
  });

  it("applies the dividend-grower rule rather than just picking high yields", () => {
    const { stocks } = matchesFor(themeById("dividend-growers")!);
    for (const s of stocks) {
      if (s.kind !== "stock") continue;
      expect(s.fundamentals.dividendGrowthStreakYears).toBeGreaterThanOrEqual(10);
      expect(s.fundamentals.payoutRatio).toBeLessThan(0.75);
    }
    // PFE yields over 6% but pays out 94% of earnings, so the rule excludes it.
    expect(stocks.map((s) => s.symbol)).not.toContain("PFE");
  });

  it("finds cybersecurity companies and its fund", () => {
    const m = matchesFor(themeById("cybersecurity")!);
    expect(m.stocks.map((s) => s.symbol)).toEqual(expect.arrayContaining(["PANW", "CRWD", "FTNT", "ZS"]));
    expect(m.funds.map((s) => s.symbol)).toContain("CIBR");
  });

  it("only admits genuinely profitable, low-debt names to quality compounders", () => {
    for (const s of matchesFor(themeById("quality-compounders")!).stocks) {
      if (s.kind !== "stock") continue;
      expect(s.fundamentals.returnOnInvestedCapital).toBeGreaterThan(0.2);
      expect(s.fundamentals.netDebtToEbitda).toBeLessThan(2);
    }
  });

  it("ranks each theme by its stated measure", () => {
    const ai = matchesFor(themeById("ai-infrastructure")!).stocks;
    for (let i = 1; i < ai.length; i++) {
      expect(ai[i]!.trailing.return12m).toBeLessThanOrEqual(ai[i - 1]!.trailing.return12m);
    }
  });
});

describe("fund matching looks through to holdings", () => {
  it("keeps a cybersecurity fund out of AI infrastructure despite its 88% tech weight", () => {
    const ai = matchesFor(themeById("ai-infrastructure")!);
    expect(ai.funds.map((f) => f.symbol)).not.toContain("CIBR");
    expect(ai.funds.map((f) => f.symbol)).toEqual(expect.arrayContaining(["SMH", "XLK"]));
  });
});
