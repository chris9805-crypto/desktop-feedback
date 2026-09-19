import { formatPercent, label } from "@/lib/format";
import { normaliseSleeve } from "../exposure";
import { screenForExposure } from "../implement";
import { FACTORS, STYLE_BUCKETS, type Finding } from "../types";
import { materiality, type GapContext } from "./context";

/**
 * A broad market-cap index carries a small amount of every factor loading by
 * construction. These are roughly what a total-market fund scores on the same
 * 0-1 scale, so a tilt is measured against "what you get anyway", not zero.
 */
const MARKET_BASELINE: Record<string, number> = {
  value: 0.33,
  quality: 0.35,
  momentum: 0.1,
  smallSize: 0.2,
  lowVolatility: 0.3,
  dividendYield: 0.25,
};

const WHY: Record<string, string> = {
  value:
    "A value tilt buys companies that are cheap on accounting measures. It has paid a premium over very long periods and spent decade-long stretches not doing so — the 2010s being the most recent.",
  quality:
    "A quality tilt favours profitable, low-debt companies. It tends to hold up better in downturns, and you pay for that in a higher starting valuation.",
  momentum:
    "A momentum tilt holds what has recently gone up. It turns over quickly, costs more to run, and is prone to sharp reversals when leadership changes.",
  smallSize:
    "A small-size tilt holds companies below the mega-cap tier. Historically higher returning and distinctly more volatile, with long periods of underperformance.",
  lowVolatility:
    "A low-volatility tilt holds steadier companies. It usually lags in strong rallies, which is the cost of falling less in declines.",
  dividendYield:
    "A yield tilt selects on payout rather than on business quality, which concentrates the portfolio into a few mature, income-paying sectors.",
};

export function factorFindings(ctx: GapContext): Finding[] {
  const findings: Finding[] = [];
  const exposure = ctx.metrics.exposure;
  const equityish = exposure.assetClass.equity + exposure.assetClass.realEstate;
  if (equityish < 0.2) return findings;

  const held = ctx.portfolio.positions.map((p) => p.symbol);

  for (const factor of FACTORS) {
    // Factor loadings are scaled by the equity share, so divide back out to
    // compare a tilt against the baseline for an all-equity sleeve.
    const loading = exposure.factor[factor] / equityish;
    const baseline = MARKET_BASELINE[factor] ?? 0;
    const tilt = loading - baseline;
    if (tilt < 0.22) continue;

    const contributors = ctx.portfolio.positions
      .filter((p) => p.security.kind === "etf" && (p.security.breakdown.factor?.[factor] ?? 0) > 0.3)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3);

    findings.push({
      id: `factor-${factor}`,
      category: "factor",
      direction: "over",
      severity: materiality({ magnitude: tilt, scaleAt: 0.5, valueShare: equityish, weight: 0.9 }),
      title: `A pronounced ${label(factor).toLowerCase()} tilt runs through the equity sleeve`,
      summary: `The sleeve scores ${loading.toFixed(2)} on ${label(factor).toLowerCase()} against roughly ${baseline.toFixed(2)} for a broad market index${contributors.length > 0 ? `, driven mainly by ${contributors.map((c) => c.symbol).join(", ")}` : ", spread across several holdings rather than one"}.`,
      why: `${WHY[factor] ?? ""} A tilt this size is a position with a long horizon attached: factor premia, where they exist at all, show up over decades and disappear for years at a time. The risk is not that the tilt is wrong — it is abandoning it after a bad stretch, which turns a long-run bet into a realised loss.`,
      evidence: [
        { label: "Your loading", value: loading.toFixed(2), detail: "0 to 1, across the equity and property sleeve" },
        { label: "Broad index baseline", value: baseline.toFixed(2) },
        ...contributors.map((c) => ({ label: `${c.security.name} (${c.symbol})`, value: formatPercent(c.weight), detail: "contributes to this tilt" })),
      ],
      learnSlug: "factor-tilts",
      implementation: {
        objective: "Confirm the tilt is intended, and that it is sized to be held through a bad decade.",
        gapValue: null,
        routes: [
          { label: "Write down the reason and the horizon", detail: "A tilt you cannot justify in a sentence is one you will sell at the bottom. Recording the reasoning now is what makes it reviewable later." },
          { label: "Or dilute it with a broad core", detail: "Adding to a total-market holding reduces the tilt without selling the funds that create it." },
        ],
        screen: screenForExposure({ dimension: "assetClass", bucket: "equity", minPurity: 0.9, maxExpenseRatio: 0.001, excludeSymbols: held, limit: 3 }),
        tradeoffs: ["Every tilt is funded by underweighting something else. Both sides of that trade are deliberate, even when only one was noticed."],
      },
    });
  }

  // --- Style, which people are more likely to recognise than a factor label.
  const style = normaliseSleeve(exposure.style, STYLE_BUCKETS);
  const growthTilt = (style.growth ?? 0) - 0.31;
  if (growthTilt > 0.2) {
    findings.push({
      id: "factor-growth-style",
      category: "factor",
      direction: "over",
      severity: materiality({ magnitude: growthTilt, scaleAt: 0.4, valueShare: equityish, weight: 0.95 }),
      title: `${formatPercent(style.growth ?? 0)} of the equity sleeve is in growth-styled companies`,
      summary: `Against roughly 31% for a broad market index. Value is ${formatPercent(style.value ?? 0)} of the sleeve.`,
      why:
        "Growth companies are priced on future earnings, which makes them sensitive to rates and to disappointment. A heavy growth weight is usually not a decision — it is what a large-cap index plus a tech fund plus a few famous names produces.",
      evidence: [
        { label: "Growth", value: formatPercent(style.growth ?? 0) },
        { label: "Blend", value: formatPercent(style.blend ?? 0) },
        { label: "Value", value: formatPercent(style.value ?? 0) },
      ],
      learnSlug: "size-and-style",
      implementation: {
        objective: "Decide whether the style tilt is a view or a side effect.",
        gapValue: null,
        routes: [{ label: "Balance with the other half of the market", detail: "A value or total-market fund moves the sleeve back toward the market's own style mix." }],
        screen: screenForExposure({ dimension: "style", bucket: "value", minPurity: 0.6, excludeSymbols: held, limit: 3 }),
        tradeoffs: ["Style tilts reverse on no schedule. The cost of the tilt is the years spent waiting."],
      },
    });
  }

  return findings;
}
