import { describe, expect, it } from "vitest";
import { lookupSecurity } from "@/lib/data/securities";
import { buildExposure } from "@/lib/engine/exposure";
import type { StockSecurity } from "@/lib/engine/types";

const stock = (symbol: string) => lookupSecurity(symbol) as StockSecurity;

describe("momentum", () => {
  it("scores a strong riser above a faller", () => {
    expect(stock("NVDA").factorTilts.momentum!).toBeGreaterThan(stock("NKE").factorTilts.momentum!);
  });

  it("is bounded to the same 0-1 scale as every other loading", () => {
    for (const symbol of ["NVDA", "NKE", "PFE", "AAPL", "KO"]) {
      const m = stock(symbol).factorTilts.momentum!;
      expect(m).toBeGreaterThanOrEqual(0);
      expect(m).toBeLessThanOrEqual(1);
    }
  });

  it("marks down a name that has rolled over recently", () => {
    // AMD's twelve-month return is positive but its last quarter is negative.
    const amd = stock("AMD");
    expect(amd.trailing.return12m).toBeGreaterThan(0);
    expect(amd.trailing.return3m).toBeLessThan(0);
    expect(amd.factorTilts.momentum!).toBeLessThan(stock("AVGO").factorTilts.momentum!);
  });

  it("reaches the portfolio exposure, so a momentum tilt can now be detected", () => {
    expect(buildExposure(stock("NVDA")).factor.momentum).toBeGreaterThan(0.5);
  });

  it("gives every security a trailing return rather than leaving it undefined", () => {
    for (const symbol of ["VTI", "QQQ", "BND", "AAPL", "7203"]) {
      const s = lookupSecurity(symbol)!;
      expect(typeof s.trailing.return12m).toBe("number");
    }
  });

  it("no longer claims momentum is unscored", async () => {
    const { analysePortfolio } = await import("@/lib/engine/analyse");
    const { buildPortfolio } = await import("@/lib/engine/portfolio");
    const { profile } = await import("./fixtures");
    const report = analysePortfolio(buildPortfolio([{ symbol: "NVDA", value: 10000 }]), profile());
    expect(report.caveats.join(" ")).not.toContain("Momentum is not scored");
  });
});
