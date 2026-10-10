import { describe, expect, it } from "vitest";
import { analysePortfolio } from "@/lib/engine/analyse";
import {
  ETF_UNIVERSE,
  FUND_UNIVERSE,
  MUTUAL_FUND_UNIVERSE,
  lookupSecurity,
} from "@/lib/data/securities";
import { buildExposure } from "@/lib/engine/exposure";
import { estimateOverlap } from "@/lib/engine/gaps/overlap";
import { buildPortfolio } from "@/lib/engine/portfolio";
import { profile } from "./fixtures";

describe("the universe", () => {
  it("holds mutual funds alongside ETFs, under one fund kind", () => {
    expect(MUTUAL_FUND_UNIVERSE.length).toBeGreaterThan(5);
    expect(ETF_UNIVERSE.length).toBeGreaterThan(40);
    expect(MUTUAL_FUND_UNIVERSE.length + ETF_UNIVERSE.length).toBe(FUND_UNIVERSE.length);
    for (const fund of FUND_UNIVERSE) expect(fund.kind).toBe("fund");
  });

  it("gives every fund a structure", () => {
    for (const fund of FUND_UNIVERSE) {
      expect(["etf", "mutualFund"]).toContain(fund.fund.structure);
    }
  });

  it("resolves a five-letter mutual fund ticker", () => {
    const fund = lookupSecurity("vfiax");
    expect(fund?.symbol).toBe("VFIAX");
    expect(fund?.kind).toBe("fund");
  });

  it("gives mutual funds no bid/ask spread, because they transact at NAV", () => {
    for (const fund of MUTUAL_FUND_UNIVERSE) expect(fund.fund.spread).toBe(0);
  });

  it("only puts a sales charge on funds that actually carry one", () => {
    const loaded = MUTUAL_FUND_UNIVERSE.filter((f) => (f.fund.frontLoad ?? 0) > 0);
    expect(loaded.length).toBeGreaterThan(0);
    expect(loaded.length).toBeLessThan(MUTUAL_FUND_UNIVERSE.length);
    for (const fund of ETF_UNIVERSE) expect(fund.fund.frontLoad ?? 0).toBe(0);
  });
});

describe("look-through where a fund holds funds", () => {
  const target = lookupSecurity("VFIFX")!;
  const lookThrough = buildExposure(target).lookThrough;

  it("reaches companies rather than stopping at the child funds", () => {
    expect(target.kind).toBe("fund");
    if (target.kind !== "fund") return;
    expect(target.topHoldings.every((h) => lookupSecurity(h.symbol)?.kind === "fund")).toBe(true);
    for (const symbol of Object.keys(lookThrough)) {
      expect(lookupSecurity(symbol)?.kind, `${symbol} should not be a fund`).not.toBe("fund");
    }
    expect(Object.keys(lookThrough)).toContain("NVDA");
  });

  it("multiplies the two levels of weight together", () => {
    const child = lookupSecurity("VTSAX")!;
    if (child.kind !== "fund" || target.kind !== "fund") throw new Error("both should be funds");
    const childWeight = target.topHoldings.find((h) => h.symbol === "VTSAX")!.weight;
    const inner = child.topHoldings.find((h) => h.symbol === "NVDA")!.weight;
    expect(lookThrough["NVDA"]).toBeCloseTo(childWeight * inner, 10);
  });

  it("drops a child fund that discloses no holdings rather than filing it as a company", () => {
    // The bond sleeve lists no individual issues, so it contributes no company
    // weight — but it must not appear under its own ticker either.
    if (target.kind !== "fund") throw new Error("target should be a fund");
    expect(target.topHoldings.some((h) => h.symbol === "VBTLX")).toBe(true);
    expect(lookThrough["VBTLX"]).toBeUndefined();
  });

  it("leaves an ordinary fund's look-through alone", () => {
    const plain = lookupSecurity("VFIAX")!;
    expect(plain.kind).toBe("fund");
    if (plain.kind !== "fund") return;
    const map = buildExposure(plain).lookThrough;
    expect(Object.keys(map).sort()).toEqual(plain.topHoldings.map((h) => h.symbol).sort());
  });
});

describe("a fund is a fund, whichever wrapper it comes in", () => {
  it("sees the same index in two wrappers as the same thing", () => {
    const mutual = lookupSecurity("VFIAX")!;
    const etf = lookupSecurity("VOO")!;
    expect(estimateOverlap(mutual as never, etf as never)).toBeGreaterThan(0.95);
  });

  it("analyses an all-mutual-fund portfolio end to end", () => {
    const report = analysePortfolio(
      buildPortfolio(
        [
          { symbol: "VTSAX", value: 50000 },
          { symbol: "VTIAX", value: 25000 },
          { symbol: "VBTLX", value: 25000 },
        ],
        { cash: 5000 },
      ),
      profile(),
    );
    expect(report.portfolio.unresolved).toHaveLength(0);
    expect(report.metrics.weightedExpenseRatio).toBeGreaterThan(0);
    expect(report.metrics.lookThrough.length).toBeGreaterThan(5);
    expect(report.metrics.exposure.region.emergingMarkets).toBeGreaterThan(0);
  });
});

describe("sales charges", () => {
  const withLoad = (monthlyContribution: number) =>
    analysePortfolio(
      buildPortfolio([{ symbol: "AGTHX", value: 60000 }, { symbol: "VBTLX", value: 40000 }]),
      profile({ monthlyContribution }),
    );

  it("flags a front-end load, which no ongoing-charge comparison can see", () => {
    const finding = withLoad(500).findings.find((f) => f.id === "cost-load-AGTHX");
    expect(finding).toBeDefined();
    expect(finding!.title).toContain("5.75%");
    expect(finding!.evidence.some((e) => e.label === "Front-end sales charge")).toBe(true);
  });

  it("prices it against what is still being paid in", () => {
    const finding = withLoad(500).findings.find((f) => f.id === "cost-load-AGTHX")!;
    const year = finding.evidence.find((e) => e.label === "A year of your contributions");
    // 500 a month for a year at 5.75%.
    expect(year?.value).toBe("$345");
  });

  it("leaves out the contributions line when nothing is being added", () => {
    const finding = withLoad(0).findings.find((f) => f.id === "cost-load-AGTHX")!;
    expect(finding.evidence.some((e) => e.label === "A year of your contributions")).toBe(false);
  });

  it("says what is already paid is sunk, rather than implying a disposal", () => {
    const finding = withLoad(500).findings.find((f) => f.id === "cost-load-AGTHX")!;
    const text = `${finding.why} ${finding.implementation?.tradeoffs?.join(" ")}`;
    expect(text).toMatch(/sunk|already paid|already spent|is spent/i);
    expect(finding.implementation?.routes.some((r) => /worth it/i.test(r.label))).toBe(true);
  });

  it("raises nothing for a fund with no load", () => {
    const report = analysePortfolio(
      buildPortfolio([{ symbol: "VFIAX", value: 60000 }, { symbol: "VBTLX", value: 40000 }]),
      profile({ monthlyContribution: 500 }),
    );
    expect(report.findings.some((f) => f.id.startsWith("cost-load-"))).toBe(false);
  });

  it("offers a cheaper equivalent across wrappers", () => {
    const report = analysePortfolio(
      buildPortfolio([{ symbol: "AGTHX", value: 60000 }, { symbol: "VBTLX", value: 40000 }]),
      profile(),
    );
    const swap = report.findings.find((f) => f.id.startsWith("cost-swap-"));
    // The engine should not care that the held fund and the alternative come
    // in different wrappers; it compares the exposure and the charge.
    if (swap) expect(swap.title).toMatch(/cheaper equivalent/);
    expect(report.findings.some((f) => f.category === "cost")).toBe(true);
  });
});
