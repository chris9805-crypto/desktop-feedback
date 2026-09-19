import { formatCurrency, formatPercent } from "@/lib/format";
import { routesToClose, screenForExposure } from "../implement";
import type { Finding } from "../types";
import { materiality, type GapContext } from "./context";

/** Above this share of a portfolio, one company's specific problems become the portfolio's problems. */
const SINGLE_NAME_THRESHOLD = 0.08;
const TOP_TEN_THRESHOLD = 0.45;
const EFFECTIVE_NAMES_FLOOR = 25;

export function concentrationFindings(ctx: GapContext): Finding[] {
  const findings: Finding[] = [];
  const currency = ctx.portfolio.baseCurrency;
  const { diversification, lookThrough } = ctx.metrics;
  const total = ctx.portfolio.totalValue;

  // --- Single names, counted through funds as well as directly.
  for (const name of lookThrough.slice(0, 5)) {
    if (name.weight < SINGLE_NAME_THRESHOLD) break;

    const direct = ctx.portfolio.positions.find((p) => p.symbol === name.symbol);
    const directWeight = direct ? direct.weight : 0;
    const viaFunds = name.weight - directWeight;

    findings.push({
      id: `concentration-${name.symbol}`,
      category: "concentration",
      direction: "over",
      severity: materiality({ magnitude: name.weight - SINGLE_NAME_THRESHOLD, scaleAt: 0.15, valueShare: name.weight, weight: 1.15 }),
      title: `${name.name} is ${formatPercent(name.weight)} of the portfolio`,
      summary:
        viaFunds > 0.005
          ? `${formatPercent(directWeight)} is held directly and a further ${formatPercent(viaFunds)} comes through funds, for ${formatCurrency(name.value, currency)} in one company.`
          : `${formatCurrency(name.value, currency)} sits in one company. A single-company problem at this weight is a portfolio problem.`,
      why:
        "Single-company risk is the one risk you are not paid for: it can be diversified away for free, so no premium attaches to it. It also builds quietly through funds, since index funds are market-cap weighted and hold the same names at the top.",
      evidence: [
        { label: "Total look-through weight", value: formatPercent(name.weight), detail: formatCurrency(name.value, currency) },
        ...(direct ? [{ label: "Held directly", value: formatPercent(directWeight) }] : []),
        ...(viaFunds > 0.005 ? [{ label: "Held through funds", value: formatPercent(viaFunds), detail: "aggregated across every fund's disclosed holdings" }] : []),
        { label: "Reference for a single position", value: `under ${formatPercent(SINGLE_NAME_THRESHOLD, 0)}`, detail: "a common rule of thumb, not a regulatory limit" },
      ],
      learnSlug: "concentration",
      implementation: {
        objective: `Reduce single-company exposure to ${name.name}, or record the reason for holding this much.`,
        gapValue: Math.max(0, (name.weight - SINGLE_NAME_THRESHOLD) * total),
        routes: [
          ...(directWeight > 0
            ? [{
                label: "Trim the direct holding first",
                detail: `The fund-held portion cannot be reduced without changing funds. The ${formatPercent(directWeight)} held directly is the part you control on its own.`,
              }]
            : [{
                label: "This exposure comes from funds, not from a decision",
                detail: "No single holding is oversized. The weight is what market-cap-weighted index funds produce, and reducing it means holding something other than a market-cap index.",
              }]),
          ...routesToClose(Math.max(0, (name.weight - SINGLE_NAME_THRESHOLD) * total), ctx.profile, null),
        ],
        screen:
          viaFunds > directWeight
            ? screenForExposure({ dimension: "factor", bucket: "smallSize", minPurity: 0.3, excludeSymbols: ctx.portfolio.positions.map((p) => p.symbol), limit: 3 })
            : null,
        tradeoffs: [
          "Concentration is how large gains are made as well as large losses. Cutting it lowers both ends of the range.",
          "A holding with a large unrealised gain in a taxable account has a real cost to reducing — that cost is part of the decision.",
        ],
      },
    });
  }

  // --- Breadth of the portfolio as a whole.
  if (diversification.effectiveNames > 0 && diversification.effectiveNames < EFFECTIVE_NAMES_FLOOR) {
    findings.push({
      id: "concentration-breadth",
      category: "concentration",
      direction: "over",
      severity: materiality({ magnitude: EFFECTIVE_NAMES_FLOOR - diversification.effectiveNames, scaleAt: 20, valueShare: 1, weight: 1.05 }),
      title: `The portfolio behaves like about ${Math.round(diversification.effectiveNames)} equally sized holdings`,
      summary: `You hold ${diversification.positionCount} line${diversification.positionCount === 1 ? "" : "s"} covering roughly ${diversification.lookThroughNameCount.toLocaleString()} companies, but the weights are uneven enough that it behaves like ${Math.round(diversification.effectiveNames)} equal positions. The largest ten look-through names are ${formatPercent(diversification.topTenWeight)} of the portfolio.`,
      why:
        "Counting holdings overstates diversification when weights are lopsided. Effective holdings — one over the Herfindahl index — asks how many equal positions would be this concentrated. A broad index fund lands near 100.",
      evidence: [
        { label: "Lines on the statement", value: `${diversification.positionCount}` },
        { label: "Companies held through them", value: diversification.lookThroughNameCount.toLocaleString() },
        { label: "Effective holdings", value: `${Math.round(diversification.effectiveNames)}`, detail: "1 / Herfindahl index across look-through weights" },
        { label: "Top ten weight", value: formatPercent(diversification.topTenWeight) },
      ],
      learnSlug: "concentration",
      implementation: {
        objective: "Spread weight more evenly, or accept the concentration as a deliberate position.",
        gapValue: null,
        routes: [
          { label: "Broaden the core", detail: "A single total-market or all-world fund holds thousands of companies at market weights, and usually raises effective holdings faster than adding more individual names." },
          { label: "Cap individual positions", detail: "Setting a maximum weight per company, applied when you add money rather than by selling, keeps the number from drifting back." },
        ],
        screen: screenForExposure({ dimension: "assetClass", bucket: "equity", minPurity: 0.9, maxExpenseRatio: 0.001, excludeSymbols: ctx.portfolio.positions.map((p) => p.symbol), limit: 3 }),
        tradeoffs: ["Broad diversification guarantees you will own the disappointments as well as the winners. That is the trade."],
      },
    });
  }

  if (diversification.topTenWeight > TOP_TEN_THRESHOLD && !findings.some((f) => f.id === "concentration-breadth")) {
    findings.push({
      id: "concentration-top-ten",
      category: "concentration",
      direction: "over",
      severity: materiality({ magnitude: diversification.topTenWeight - TOP_TEN_THRESHOLD, scaleAt: 0.3, valueShare: diversification.topTenWeight }),
      title: `The ten largest companies are ${formatPercent(diversification.topTenWeight)} of the portfolio`,
      summary: `Look-through weight in the ten largest names is ${formatPercent(diversification.topTenWeight)}, or ${formatCurrency(diversification.topTenWeight * total, currency)}.`,
      why: "A high top-ten weight is normal in a market-cap index today, because the largest companies are unusually large. Worth knowing rather than fixing — but the portfolio's fate is tied to a small, correlated group.",
      evidence: [
        { label: "Top ten weight", value: formatPercent(diversification.topTenWeight) },
        { label: "Largest single name", value: formatPercent(diversification.topHoldingWeight) },
      ],
      learnSlug: "concentration",
    });
  }

  return findings;
}
