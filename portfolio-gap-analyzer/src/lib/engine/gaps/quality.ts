import { formatMultiple, formatPercent } from "@/lib/format";
import type { Finding, StockSecurity } from "../types";
import { materiality, type GapContext } from "./context";

/**
 * Checks on the directly held stock sleeve only. Fund holdings are excluded
 * because the investor did not choose them individually, and an index fund's
 * weighted leverage is a fact about the market rather than about their decisions.
 */
export function qualityFindings(ctx: GapContext): Finding[] {
  const sleeve = ctx.metrics.stockSleeve;
  if (!sleeve || sleeve.weight < 0.1) return [];

  const findings: Finding[] = [];
  const stocks = ctx.portfolio.positions.filter(
    (p): p is typeof p & { security: StockSecurity } => p.security.kind === "stock",
  );

  // --- Leverage across the names that were picked individually.
  const levered = stocks.filter((p) => p.security.fundamentals.netDebtToEbitda > 3 && p.security.sector !== "financials");
  const leveredWeight = levered.reduce((a, p) => a + p.weight, 0);
  if (leveredWeight > 0.08) {
    findings.push({
      id: "quality-leverage",
      category: "quality",
      direction: "over",
      severity: materiality({ magnitude: leveredWeight, scaleAt: 0.25, valueShare: leveredWeight }),
      title: `${formatPercent(leveredWeight)} of the portfolio is in companies carrying heavy debt`,
      summary: `${levered.map((p) => p.symbol).join(", ")} each carry net debt above three times EBITDA. The stock sleeve as a whole averages ${formatMultiple(sleeve.netDebtToEbitda)}.`,
      why:
        "Debt magnifies both directions and removes options. A levered company facing a weak year services the debt first — that is when dividends get cut and shares get issued at bad prices. Three times EBITDA is a rough line, not a rule.",
      evidence: levered.slice(0, 4).map((p) => ({
        label: `${p.security.name} (${p.symbol})`,
        value: formatMultiple(p.security.fundamentals.netDebtToEbitda),
        detail: `interest cover ${p.security.fundamentals.interestCover > 0 ? formatMultiple(p.security.fundamentals.interestCover, 0) : "n/a"} · ${formatPercent(p.weight)} of portfolio`,
      })),
      learnSlug: "balance-sheets",
      implementation: {
        objective: "Check that the leverage is understood position by position, not just in aggregate.",
        gapValue: null,
        routes: [
          { label: "Read interest cover alongside the ratio", detail: "Net debt to EBITDA says how much debt there is; interest cover says whether it is affordable at current rates. Stable, regulated businesses safely carry more of both." },
          { label: "Watch the refinancing dates", detail: "Debt taken out at low rates has to be replaced at today's rates. The maturity schedule in the annual report is where that shows up." },
        ],
        screen: null,
        tradeoffs: ["Utilities, REITs and telecoms run high leverage by design. Compare a company with its own sector before drawing a conclusion."],
      },
    });
  }

  // --- What the stock sleeve is priced at, versus the market it sits in.
  if (sleeve.priceEarnings > 30 && sleeve.weight > 0.15) {
    findings.push({
      id: "quality-valuation",
      category: "quality",
      direction: "over",
      severity: materiality({ magnitude: sleeve.priceEarnings - 30, scaleAt: 25, valueShare: sleeve.weight, weight: 0.85 }),
      title: `The directly held stocks are priced at ${sleeve.priceEarnings.toFixed(0)} times earnings`,
      summary: `Weighted across ${formatPercent(sleeve.weight)} of the portfolio, against roughly 20 times for a broad global index. Free cash flow yield on the sleeve is ${formatPercent(sleeve.freeCashFlowYield)}.`,
      why:
        "A high multiple is not a prediction of a poor return — it says the price already contains a lot of growth. The risk is asymmetry: the companies have to deliver it, and merely growing well is not enough. " +
        `Return on invested capital across the sleeve is ${formatPercent(sleeve.returnOnInvestedCapital)}, and it is that rate persisting, not just revenue rising, that the multiple is asking for.`,
      evidence: [
        { label: "Weighted P/E", value: sleeve.priceEarnings.toFixed(1) },
        { label: "Free cash flow yield", value: formatPercent(sleeve.freeCashFlowYield) },
        { label: "Return on invested capital", value: formatPercent(sleeve.returnOnInvestedCapital) },
        { label: "Share of portfolio", value: formatPercent(sleeve.weight) },
      ],
      learnSlug: "valuation-basics",
      implementation: {
        objective: "Check the multiple against the growth and returns that are supposed to support it.",
        gapValue: null,
        routes: [
          { label: "Compare within the sector", detail: "A 30x software company and a 30x utility are very different statements. Sector context does most of the work in reading a multiple." },
          { label: "Look at free cash flow, not just earnings", detail: "Earnings can be shaped by accounting choices. Cash generated after capital spending is harder to flatter." },
        ],
        screen: null,
        tradeoffs: ["High-multiple companies have included many of the best investments of the past decade. The multiple is a measure of what is priced in, not of quality."],
      },
    });
  }

  return findings;
}
