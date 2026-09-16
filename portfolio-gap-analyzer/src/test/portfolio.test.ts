import { describe, expect, it } from "vitest";
import { buildPortfolio, parseHoldings } from "@/lib/engine/portfolio";

describe("parseHoldings", () => {
  it("reads a bare number as a share count", () => {
    const { holdings } = parseHoldings("VTI, 120");
    expect(holdings[0]).toMatchObject({ symbol: "VTI", quantity: 120 });
  });

  it("reads a currency-prefixed number as a value", () => {
    const { holdings } = parseHoldings("VTI, $34,000");
    expect(holdings[0]).toMatchObject({ symbol: "VTI", value: 34000 });
  });

  it("reads a percentage as a portfolio share", () => {
    const { holdings } = parseHoldings("VTI, 28%");
    expect(holdings[0]).toMatchObject({ symbol: "VTI", percent: 28 });
  });

  it("keeps an account label", () => {
    const { holdings } = parseHoldings("VTI, 120, ISA");
    expect(holdings[0]).toMatchObject({ symbol: "VTI", quantity: 120, account: "ISA" });
  });

  it("skips headers, blank lines and comments", () => {
    const { holdings, errors } = parseHoldings("Symbol, Quantity\n\n# my notes\nVTI, 10");
    expect(holdings).toHaveLength(1);
    expect(errors).toHaveLength(0);
  });

  it("reports a line with no usable amount instead of dropping it", () => {
    const { holdings, errors } = parseHoldings("VTI\nBND, 10");
    expect(holdings).toHaveLength(1);
    expect(errors[0]).toContain("VTI");
  });

  it("handles tab and multi-space separated pastes", () => {
    const { holdings } = parseHoldings("VTI\t120\nBND   45");
    expect(holdings.map((h) => h.symbol)).toEqual(["VTI", "BND"]);
  });
});

describe("buildPortfolio", () => {
  it("prices share counts through the security master", () => {
    const portfolio = buildPortfolio([{ symbol: "VTI", quantity: 100 }]);
    expect(portfolio.positions[0]!.value).toBeCloseTo(29140, 0);
  });

  it("converts a non-base-currency listing into the base currency", () => {
    const portfolio = buildPortfolio([{ symbol: "VUSA", quantity: 100 }], { baseCurrency: "USD" });
    // 100 shares at £87.30, converted at 1.27 USD per GBP.
    expect(portfolio.positions[0]!.value).toBeCloseTo(87.3 * 100 * 1.27, 0);
  });

  it("resolves percentages against the supplied portfolio total", () => {
    const portfolio = buildPortfolio([{ symbol: "VTI", percent: 60 }, { symbol: "BND", percent: 40 }], {
      totalValueHint: 100000,
    });
    expect(portfolio.positions[0]!.value).toBe(60000);
    expect(portfolio.totalValue).toBe(100000);
  });

  it("merges the same security held in two accounts", () => {
    const portfolio = buildPortfolio([
      { symbol: "VTI", value: 10000, account: "ISA" },
      { symbol: "VTI", value: 5000, account: "SIPP" },
    ]);
    expect(portfolio.positions).toHaveLength(1);
    expect(portfolio.positions[0]!.value).toBe(15000);
    expect(portfolio.positions[0]!.account).toBe("ISA, SIPP");
  });

  it("resolves ticker variants to one security", () => {
    const portfolio = buildPortfolio([{ symbol: "brk-b", value: 1000 }, { symbol: "GOOG", value: 1000 }]);
    expect(portfolio.positions.map((p) => p.symbol).sort()).toEqual(["BRK.B", "GOOGL"]);
  });

  it("keeps unknown symbols visible instead of silently dropping them", () => {
    const portfolio = buildPortfolio([{ symbol: "NOTATICKER", value: 1000 }, { symbol: "VTI", value: 1000 }]);
    expect(portfolio.unresolved).toEqual([
      { symbol: "NOTATICKER", value: 1000, reason: "unknown-symbol", raw: "NOTATICKER" },
    ]);
    expect(portfolio.totalValue).toBe(1000);
  });

  it("includes cash in the total and in position weights", () => {
    const portfolio = buildPortfolio([{ symbol: "VTI", value: 75000 }], { cash: 25000 });
    expect(portfolio.totalValue).toBe(100000);
    expect(portfolio.positions[0]!.weight).toBeCloseTo(0.75, 6);
  });
});
