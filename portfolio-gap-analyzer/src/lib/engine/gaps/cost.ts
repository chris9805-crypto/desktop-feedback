import { ETF_UNIVERSE } from "@/lib/data/securities";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { EtfSecurity, Finding, Position } from "../types";
import { materiality, type GapContext } from "./context";
import { estimateOverlap } from "./overlap";

/**
 * Compound the cost difference forward. Charges come out of the balance every
 * year, so the gap grows with the portfolio rather than staying flat — which is
 * the whole reason a few basis points matter over a long horizon.
 */
function compoundedDrag(value: number, feeGap: number, years: number, growth = 0.05): number {
  const gross = value * (1 + growth) ** years;
  const net = value * (1 + growth - feeGap) ** years;
  return gross - net;
}

interface SwapCandidate {
  position: Position & { security: EtfSecurity };
  alternative: EtfSecurity;
  overlap: number;
  feeGap: number;
  annualSaving: number;
}

function findCheaperEquivalents(ctx: GapContext): SwapCandidate[] {
  const held = new Set(ctx.portfolio.positions.map((p) => p.symbol));
  const out: SwapCandidate[] = [];

  for (const position of ctx.portfolio.positions) {
    if (position.security.kind !== "etf") continue;
    const security = position.security;
    let best: { alternative: EtfSecurity; overlap: number } | null = null;

    for (const candidate of ETF_UNIVERSE) {
      if (candidate.symbol === security.symbol || held.has(candidate.symbol)) continue;
      if (candidate.fund.expenseRatio >= security.fund.expenseRatio - 0.0002) continue;
      if (candidate.listingCountry !== security.listingCountry) continue;
      if (candidate.fund.aumUsd < 1e9) continue;
      const overlap = estimateOverlap(security, candidate);
      if (overlap < 0.9) continue;
      if (!best || candidate.fund.expenseRatio < best.alternative.fund.expenseRatio) {
        best = { alternative: candidate, overlap };
      }
    }

    if (best) {
      const feeGap = security.fund.expenseRatio - best.alternative.fund.expenseRatio;
      out.push({
        position: position as Position & { security: EtfSecurity },
        alternative: best.alternative,
        overlap: best.overlap,
        feeGap,
        annualSaving: feeGap * position.value,
      });
    }
  }

  return out.sort((a, b) => b.annualSaving - a.annualSaving);
}

export function costFindings(ctx: GapContext): Finding[] {
  const currency = ctx.portfolio.baseCurrency;
  const findings: Finding[] = [];
  const held = ctx.metrics.weightedExpenseRatio;
  const benchmark = ctx.reference.costBenchmark;
  const total = ctx.portfolio.totalValue;
  const horizon = Math.max(ctx.profile.horizonYears, 10);

  if (held - benchmark >= 0.0008 && total > 0) {
    const feeGap = held - benchmark;
    const drag = compoundedDrag(total, feeGap, horizon);
    findings.push({
      id: "cost-overall",
      category: "cost",
      direction: "over",
      severity: materiality({ magnitude: feeGap, scaleAt: 0.006, valueShare: 0.8, weight: 1.05 }),
      title: `Ongoing charges are ${formatPercent(feeGap, 2)} above a low-cost index benchmark`,
      summary: `The portfolio's weighted ongoing charge is ${formatPercent(held, 2)} against ${formatPercent(benchmark, 2)} for a comparable index portfolio — ${formatCurrency(ctx.metrics.annualCost, currency)} a year today, and about ${formatCurrency(drag, currency)} of end value given up over ${horizon} years at a 5% assumed return.`,
      why:
        "Charges are the one input to a portfolio's outcome that is known in advance. A fee is deducted from the balance every year, so it compounds against you in exactly the way returns compound for you. Over decades a difference of a few tenths of a percent is not a rounding error — it is a meaningful share of the final balance.",
      evidence: [
        { label: "Your weighted ongoing charge", value: formatPercent(held, 2), detail: `${formatCurrency(ctx.metrics.annualCost, currency)} a year at today's balance` },
        { label: "Low-cost index benchmark", value: formatPercent(benchmark, 2), detail: "roughly what a two- or three-fund index portfolio costs" },
        { label: `Cost over ${horizon} years`, value: formatCurrency(drag, currency), detail: "difference in end value, assuming a 5% gross return and no contributions" },
      ],
      learnSlug: "costs",
      implementation: {
        objective: "Bring the weighted charge closer to the index benchmark where the exposure can be bought more cheaply.",
        gapValue: ctx.metrics.annualCost - benchmark * total,
        routes: [
          { label: "Start with the largest holdings", detail: "A basis point saved on the biggest position is worth more than a large saving on a small one. Sort by value, not by fee." },
          { label: "Compare like for like", detail: "A higher charge can be worth paying for a genuinely different exposure. It is not worth paying for the same index in a different wrapper." },
        ],
        screen: null,
        tradeoffs: [
          "Cost is not the only thing that matters: spread, tracking difference, fund size and tax treatment all affect what you actually keep.",
          "Switching funds in a taxable account can cost more in tax than the fee saving returns for years.",
        ],
      },
    });
  }

  const swaps = findCheaperEquivalents(ctx).filter((s) => s.annualSaving > total * 0.0002);
  for (const swap of swaps.slice(0, 3)) {
    const drag = compoundedDrag(swap.position.value, swap.feeGap, horizon);
    findings.push({
      id: `cost-swap-${swap.position.symbol}`,
      category: "cost",
      direction: "over",
      severity: materiality({ magnitude: swap.feeGap, scaleAt: 0.004, valueShare: swap.position.weight }),
      title: `${swap.position.symbol} has a cheaper equivalent in ${swap.alternative.symbol}`,
      summary: `${swap.position.symbol} charges ${formatPercent(swap.position.security.fund.expenseRatio, 2)} for exposure that ${swap.alternative.symbol} provides at ${formatPercent(swap.alternative.fund.expenseRatio, 2)}, with an estimated ${formatPercent(swap.overlap, 0)} overlap. On ${formatCurrency(swap.position.value, currency)} that is ${formatCurrency(swap.annualSaving, currency)} a year.`,
      why:
        "Index exposures are close to a commodity: when two funds track the same or near-identical indices, the cheaper one keeps more of the return, and there is rarely a compensating advantage. The exceptions are real but narrow — trading liquidity for very large or very frequent orders, and differences in domicile or tax treatment.",
      evidence: [
        { label: `${swap.position.symbol} ongoing charge`, value: formatPercent(swap.position.security.fund.expenseRatio, 2), detail: swap.position.security.fund.indexName },
        { label: `${swap.alternative.symbol} ongoing charge`, value: formatPercent(swap.alternative.fund.expenseRatio, 2), detail: swap.alternative.fund.indexName },
        { label: "Estimated overlap", value: formatPercent(swap.overlap, 0) },
        { label: `Difference over ${horizon} years`, value: formatCurrency(drag, currency), detail: "on this position alone, at a 5% assumed return" },
      ],
      learnSlug: "costs",
      implementation: {
        objective: `Decide whether ${swap.position.symbol} is worth its extra charge for this exposure.`,
        gapValue: swap.annualSaving,
        routes: [
          { label: "Redirect future contributions", detail: `New money into ${swap.alternative.symbol} shifts the weighted charge over time with no disposal and no tax event.` },
          { label: "Check the practical differences", detail: `Spread: ${formatPercent(swap.position.security.fund.spread, 3)} against ${formatPercent(swap.alternative.fund.spread, 3)}. Fund size: ${(swap.position.security.fund.aumUsd / 1e9).toFixed(0)}bn against ${(swap.alternative.fund.aumUsd / 1e9).toFixed(0)}bn. For a large or frequently traded position these can outweigh the fee.` },
        ],
        screen: { description: `Funds overlapping ${swap.position.symbol} by 90% or more at a lower ongoing charge, same listing country.`, symbols: [swap.alternative.symbol] },
        tradeoffs: [
          "A fee saving is certain; everything else about the two funds is not identical. Read both factsheets before treating them as interchangeable.",
        ],
      },
    });
  }

  return findings;
}
