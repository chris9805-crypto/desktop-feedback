import { formatCurrency, formatPercent } from "@/lib/format";
import { screenForExposure } from "../implement";
import type { Currency, Finding } from "../types";
import { materiality, type GapContext } from "./context";

export function currencyFindings(ctx: GapContext): Finding[] {
  const findings: Finding[] = [];
  const base = ctx.portfolio.baseCurrency;
  const total = ctx.portfolio.totalValue;
  const currencyMap = ctx.metrics.exposure.currency;
  const baseShare = currencyMap[base] ?? 0;
  const foreignShare = Math.max(0, 1 - baseShare);

  // Currency risk is a horizon question: over decades it has historically washed
  // out, but over a few years it can easily swamp the underlying return.
  const shortHorizon = ctx.profile.horizonYears <= 7;
  if (foreignShare > 0.5 && shortHorizon) {
    findings.push({
      id: "currency-mismatch",
      category: "currency",
      direction: "over",
      severity: materiality({ magnitude: foreignShare - 0.5, scaleAt: 0.45, valueShare: foreignShare, weight: shortHorizon ? 1 : 0.7 }),
      title: `${formatPercent(foreignShare)} of the portfolio is in currencies other than ${base}`,
      summary: `You will spend in ${base}, and ${formatCurrency(foreignShare * total, base)} is exposed to exchange-rate moves on a ${ctx.profile.horizonYears}-year horizon.`,
      why:
        "Owning a foreign company means owning its currency too. Over long periods currency moves have tended to average out and hedging costs money, so most long-horizon investors leave equity exposure unhedged. Over a few years it is different: a 10-15% move in a major pair is unremarkable, and it lands directly on the value of money that is about to be spent. Bonds are the sharper case — a currency swing can be several times the yield, which is why international bond funds are usually sold hedged.",
      evidence: [
        { label: `${base} exposure`, value: formatPercent(baseShare) },
        { label: "Other currencies", value: formatPercent(foreignShare), detail: topCurrencies(currencyMap, base) },
        { label: "Horizon", value: `${ctx.profile.horizonYears} years` },
      ],
      learnSlug: "currency-risk",
      implementation: {
        objective: `Decide how much exchange-rate risk belongs in money that will be spent in ${base}.`,
        gapValue: null,
        routes: [
          { label: "Hedge the defensive sleeve first", detail: "Currency-hedged bond funds remove the risk where it does most damage relative to the return on offer. Hedging equities is less common and costs more." },
          { label: "Or shift the near-term money home", detail: `Holding the portion needed soonest in ${base} assets sidesteps the question for the money where it matters most.` },
        ],
        screen: screenForExposure({ dimension: "assetClass", bucket: "bond", minPurity: 0.9, excludeSymbols: ctx.portfolio.positions.map((p) => p.symbol), extraFilter: (e) => e.fund.currencyHedged, extraFilterLabel: "currency-hedged", limit: 3 }),
        tradeoffs: [
          "Hedging costs the interest-rate differential between the two currencies, which can be significant.",
          "Home-currency assets remove currency risk and add concentration risk. One is traded for the other.",
        ],
      },
    });
  }

  return findings;
}

function topCurrencies(map: Record<string, number | undefined>, base: Currency): string {
  return Object.entries(map)
    .filter(([code, weight]) => code !== base && (weight ?? 0) > 0.02)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 4)
    .map(([code, weight]) => `${code} ${formatPercent(weight ?? 0, 0)}`)
    .join(" · ");
}
