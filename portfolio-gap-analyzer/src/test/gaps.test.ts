import { describe, expect, it } from "vitest";
import { analysePortfolio } from "@/lib/engine/analyse";
import { buildPortfolio } from "@/lib/engine/portfolio";
import { BALANCED, DUPLICATED, TECH_HEAVY, profile } from "./fixtures";

const ids = (report: { findings: { id: string }[] }) => report.findings.map((f) => f.id);

describe("gap detection", () => {
  it("finds the concentration, tilt and region gaps in a US tech portfolio", () => {
    const report = analysePortfolio(TECH_HEAVY(), profile());
    const found = ids(report);
    expect(found).toContain("sector-informationTechnology");
    // Against MSCI World the missing region is developed Europe, not emerging
    // markets — that index holds none, so it cannot report an EM gap.
    expect(found).toContain("region-europeExUk");
    expect(found).not.toContain("region-emergingMarkets");
    expect(found).toContain("factor-growth-style");
    expect(found.some((id) => id.startsWith("concentration-"))).toBe(true);
  });

  it("counts a company held both directly and through funds as one exposure", () => {
    const report = analysePortfolio(TECH_HEAVY(), profile());
    const nvidia = report.findings.find((f) => f.id === "concentration-NVDA");
    expect(nvidia).toBeDefined();
    const direct = report.portfolio.positions.find((p) => p.symbol === "NVDA")!.weight;
    const total = report.metrics.lookThrough.find((h) => h.symbol === "NVDA")!.weight;
    expect(total).toBeGreaterThan(direct);
    expect(nvidia!.summary).toContain("through funds");
  });

  it("flags two funds tracking the same index, and names the cheaper one", () => {
    const report = analysePortfolio(DUPLICATED(), profile());
    const overlap = report.findings.find((f) => f.id.startsWith("overlap-"));
    expect(overlap).toBeDefined();
    expect(overlap!.implementation!.routes[0]!.detail).toContain("VOO");
    expect(ids(report)).toContain("cost-swap-SPY");
  });

  it("does not manufacture findings for a portfolio close to the reference", () => {
    // VT is a global all-cap fund, so it is only close to the all-cap reference.
    const report = analysePortfolio(BALANCED(), profile({ horizonYears: 8, riskTolerance: 3 }), {
      referenceOverrides: { presetId: "globalAllCap" },
    });
    expect(ids(report)).not.toContain("allocation-growth-share");
    expect(report.findings.filter((f) => f.category === "allocation")).toHaveLength(0);
    expect(report.findings.filter((f) => f.category === "overlap")).toHaveLength(0);
  });

  it("flags volatile assets held against a short horizon", () => {
    const report = analysePortfolio(
      buildPortfolio([{ symbol: "VTI", value: 100000 }]),
      profile({ horizonYears: 2, goal: "houseDeposit" }),
    );
    expect(ids(report)).toContain("structure-horizon-mismatch");
  });

  it("flags a large cash balance held against a long horizon", () => {
    const report = analysePortfolio(
      buildPortfolio([{ symbol: "VTI", value: 40000 }], { cash: 60000 }),
      profile({ horizonYears: 25 }),
    );
    expect(ids(report)).toContain("structure-cash-drag");
  });

  it("puts the emergency-fund shortfall above everything else", () => {
    const report = analysePortfolio(
      BALANCED(),
      profile({ emergencyFundMonths: 0, monthlyEssentialSpend: 3000 }),
    );
    expect(report.findings[0]!.id).toBe("structure-emergency-fund");
  });

  it("does not treat high yield as part of the defensive sleeve", () => {
    const report = analysePortfolio(
      buildPortfolio([
        { symbol: "VT", value: 60000 },
        { symbol: "HYG", value: 40000 },
      ]),
      profile(),
    );
    expect(ids(report)).toContain("structure-credit-quality");
  });

  it("flags a dividend with a high yield and little cover", () => {
    const report = analysePortfolio(
      buildPortfolio([
        { symbol: "VT", value: 70000 },
        { symbol: "PFE", value: 15000 },
        { symbol: "UPS", value: 15000 },
      ]),
      profile(),
    );
    const finding = report.findings.find((f) => f.id === "income-dividend-strain");
    expect(finding).toBeDefined();
    expect(finding!.summary).toContain("PFE");
  });

  it("flags currency mismatch only when the horizon is short", () => {
    const holdings = [{ symbol: "VXUS", value: 100000 }];
    const short = analysePortfolio(buildPortfolio(holdings, { baseCurrency: "USD" }), profile({ horizonYears: 4 }));
    const long = analysePortfolio(buildPortfolio(holdings, { baseCurrency: "USD" }), profile({ horizonYears: 30 }));
    expect(ids(short)).toContain("currency-mismatch");
    expect(ids(long)).not.toContain("currency-mismatch");
  });

  it("flags a bond sleeve far longer than the horizon calls for", () => {
    const report = analysePortfolio(
      buildPortfolio([
        { symbol: "VTI", value: 50000 },
        { symbol: "TLT", value: 50000 },
      ]),
      profile({ horizonYears: 5 }),
    );
    expect(ids(report)).toContain("structure-duration");
  });

  it("flags leverage in directly held companies", () => {
    const report = analysePortfolio(
      buildPortfolio([
        { symbol: "VT", value: 60000 },
        { symbol: "ORCL", value: 20000 },
        { symbol: "NEE", value: 20000 },
      ]),
      profile(),
    );
    expect(ids(report)).toContain("quality-leverage");
  });

  it("ranks findings by materiality, highest first", () => {
    const report = analysePortfolio(TECH_HEAVY(), profile());
    const severities = report.findings.map((f) => f.severity);
    expect([...severities].sort((a, b) => b - a)).toEqual(severities);
  });

  it("gives every under-weight allocation finding something to act on", () => {
    const report = analysePortfolio(TECH_HEAVY(), profile());
    for (const finding of report.findings) {
      if (finding.category !== "allocation" || finding.direction !== "under") continue;
      expect(finding.implementation).toBeDefined();
      expect(finding.implementation!.screen?.symbols.length ?? 0).toBeGreaterThan(0);
      expect(finding.implementation!.routes.length).toBeGreaterThan(0);
    }
  });

  it("never suggests an instrument the investor already holds", () => {
    const report = analysePortfolio(TECH_HEAVY(), profile());
    const held = new Set(report.portfolio.positions.map((p) => p.symbol));
    for (const finding of report.findings) {
      for (const symbol of finding.implementation?.screen?.symbols ?? []) {
        expect(held.has(symbol)).toBe(false);
      }
    }
  });

  it("reports what it could not see", () => {
    const report = analysePortfolio(
      buildPortfolio([{ symbol: "VTI", value: 10000 }, { symbol: "WHATISTHIS", value: 5000 }]),
      profile(),
    );
    expect(report.caveats.join(" ")).toContain("WHATISTHIS");
    expect(report.caveats.join(" ")).toContain("sample data");
  });
});
