import { formatCurrency, formatPercent, formatPp, label } from "@/lib/format";
import { normaliseSleeve } from "../exposure";
import { routesToClose, screenForExposure, type ScreenDimension } from "../implement";
import { REGIONS, SECTORS, SIZE_BUCKETS, type Finding } from "../types";
import { materiality, type GapContext } from "./context";

/**
 * Region, sector and size gaps are measured as a share of the equity sleeve,
 * not of the whole portfolio. Otherwise an investor holding 40% bonds would be
 * flagged as underweight every single region, which is a finding about their
 * bond allocation wearing a geographic disguise.
 */
function sleeveFindings(
  ctx: GapContext,
  dimension: Extract<ScreenDimension, "region" | "sector" | "size">,
  keys: readonly string[],
  thresholdPp: number,
  copy: { noun: string; why: (bucket: string, over: boolean) => string; learnSlug: string },
): Finding[] {
  const currency = ctx.portfolio.baseCurrency;
  const current = normaliseSleeve(ctx.metrics.exposure[dimension] as Record<string, number>, keys);
  const target = normaliseSleeve(ctx.reference[dimension] as Record<string, number>, keys);

  const equityValue =
    (ctx.metrics.exposure.assetClass.equity + ctx.metrics.exposure.assetClass.realEstate) * ctx.portfolio.totalValue;
  if (equityValue <= 0) return [];

  const findings: Finding[] = [];

  for (const key of keys) {
    const held = current[key] ?? 0;
    const reference = target[key] ?? 0;
    const deviation = held - reference;
    if (Math.abs(deviation) < thresholdPp) continue;

    const over = deviation > 0;
    const gapValue = Math.abs(deviation) * equityValue;
    const bucketLabel = label(key);

    const evidence = [
      { label: `Your ${copy.noun}`, value: formatPercent(held), detail: "as a share of your equity and property sleeve" },
      { label: "Reference model", value: formatPercent(reference), detail: ctx.reference.label },
      { label: "Difference", value: formatPp(deviation), detail: `${formatCurrency(gapValue, currency)} of the sleeve` },
    ];

    const screen = over
      ? null
      : screenForExposure({
          dimension,
          bucket: key,
          minPurity: dimension === "region" ? 0.6 : 0.35,
          excludeSymbols: ctx.portfolio.positions.map((p) => p.symbol),
        });

    findings.push({
      id: `${dimension}-${key}`,
      category: "allocation",
      direction: over ? "over" : "under",
      severity: materiality({
        magnitude: Math.abs(deviation),
        scaleAt: thresholdPp * 3,
        valueShare: gapValue / ctx.portfolio.totalValue,
      }),
      title: `${bucketLabel} is ${over ? "above" : "below"} the reference weight`,
      summary: `${bucketLabel} is ${formatPercent(held)} of your equity sleeve against ${formatPercent(reference)} in the reference model, a difference of ${formatPp(deviation)} — about ${formatCurrency(gapValue, currency)}.`,
      why: copy.why(bucketLabel, over),
      evidence,
      learnSlug: copy.learnSlug,
      implementation: {
        objective: over
          ? `Reduce ${bucketLabel} toward the reference weight, or record why you are holding more.`
          : `Raise ${bucketLabel} toward the reference weight, or record why you are holding less.`,
        gapValue,
        routes: routesToClose(gapValue, ctx.profile, over ? largestIn(ctx, dimension, key) : null),
        screen,
        tradeoffs: over
          ? [
              "Selling to rebalance can trigger tax in a taxable account, and always costs spread and commission.",
              "A deliberate overweight is a position, not an error — the point is to know you hold it.",
            ]
          : [
              "Adding another fund adds another line to manage, and often overlaps something you already hold.",
              "A broader single fund may close the gap with fewer moving parts than a targeted one.",
            ],
      },
    });
  }

  return findings;
}

function largestIn(ctx: GapContext, dimension: "region" | "sector" | "size", key: string): string | null {
  let best: { name: string; symbol: string; value: number } | null = null;
  for (const position of ctx.portfolio.positions) {
    const map = position.security.kind === "stock"
      ? { [dimension === "region" ? position.security.region : dimension === "sector" ? position.security.sector : position.security.size]: 1 }
      : ((position.security.breakdown[dimension] ?? {}) as Record<string, number>);
    const share = map[key] ?? 0;
    const value = share * position.value;
    if (value > 0 && (!best || value > best.value)) {
      best = { name: position.security.name, symbol: position.symbol, value };
    }
  }
  return best ? `${best.name} (${best.symbol})` : null;
}

export function allocationFindings(ctx: GapContext): Finding[] {
  const currency = ctx.portfolio.baseCurrency;
  const findings: Finding[] = [];

  // --- Growth vs defensive, measured at the whole-portfolio level.
  const heldGrowth = ctx.metrics.exposure.assetClass.equity + ctx.metrics.exposure.assetClass.realEstate + ctx.metrics.exposure.assetClass.commodity;
  const referenceGrowth = ctx.reference.assetClass.equity + ctx.reference.assetClass.realEstate + ctx.reference.assetClass.commodity;
  const growthDeviation = heldGrowth - referenceGrowth;

  if (Math.abs(growthDeviation) >= 0.07) {
    const over = growthDeviation > 0;
    const gapValue = Math.abs(growthDeviation) * ctx.portfolio.totalValue;
    findings.push({
      id: "allocation-growth-share",
      category: "allocation",
      direction: over ? "over" : "under",
      severity: materiality({ magnitude: Math.abs(growthDeviation), scaleAt: 0.25, valueShare: Math.abs(growthDeviation), weight: 1.1 }),
      title: over ? "More in growth assets than the reference" : "Less in growth assets than the reference",
      summary: `Growth assets are ${formatPercent(heldGrowth)} of the portfolio against ${formatPercent(referenceGrowth)} in the reference model built from your ${ctx.profile.horizonYears}-year horizon and risk answers — ${formatPp(growthDeviation)}, or ${formatCurrency(gapValue, currency)}.`,
      why: over
        ? "The growth share is the single biggest driver of how much a portfolio moves. Holding more than the reference means larger gains in good years and deeper falls in bad ones — the question is whether the money can be left alone long enough for that to matter less than it feels."
        : "Holding less in growth assets makes the path smoother, and it lowers the expected end value. Over a long horizon the bigger risk is often not volatility but falling short — inflation compounds against cash just as returns compound for equities.",
      evidence: [
        { label: "Your growth assets", value: formatPercent(heldGrowth) },
        { label: "Reference model", value: formatPercent(referenceGrowth), detail: `derived from a ${ctx.profile.horizonYears}-year horizon and risk tolerance ${ctx.profile.riskTolerance}/5` },
        { label: "Risk capacity score", value: `${Math.round(ctx.reference.inputs.riskCapacityScore * 100)}/100` },
        { label: "Estimated portfolio volatility", value: formatPercent(ctx.metrics.estimatedVolatility), detail: "annualised, from a single-factor model" },
      ],
      learnSlug: "risk-capacity",
      implementation: {
        objective: over
          ? "Bring the growth share toward the reference, or revisit the horizon and risk answers that produced it."
          : "Bring the growth share toward the reference, or revisit the horizon and risk answers that produced it.",
        gapValue,
        routes: routesToClose(gapValue, ctx.profile, over ? "the largest equity holding" : null),
        screen: over
          ? screenForExposure({ dimension: "assetClass", bucket: "bond", minPurity: 0.9, excludeSymbols: ctx.portfolio.positions.map((p) => p.symbol), extraFilter: (e) => e.duration <= ctx.reference.targetDuration + 2, extraFilterLabel: `duration no more than ${(ctx.reference.targetDuration + 2).toFixed(1)} years` })
          : screenForExposure({ dimension: "assetClass", bucket: "equity", minPurity: 0.9, maxExpenseRatio: 0.0025, excludeSymbols: ctx.portfolio.positions.map((p) => p.symbol) }),
        tradeoffs: [
          "The reference model is a starting point, not a target. Every input behind it is yours to change.",
          "Moving the growth share is the change with the largest effect on outcomes, so it is the one worth thinking about longest.",
        ],
      },
    });
  }

  findings.push(
    ...sleeveFindings(ctx, "region", REGIONS, 0.05, {
      noun: "weight",
      learnSlug: "home-bias",
      why: (bucket, over) =>
        over
          ? `Holding more ${bucket} than the market does is a deliberate bet that it will beat everywhere else. It is also the most common unintentional position in a portfolio, because familiar names come from home markets and headline indices.`
          : `Holding less ${bucket} than the market does is a position too. Whether it matters depends on how correlated the rest of the portfolio already is with it — regions share sectors, and sectors share drivers.`,
    }),
  );

  findings.push(
    ...sleeveFindings(ctx, "sector", SECTORS, 0.06, {
      noun: "weight",
      learnSlug: "sector-concentration",
      why: (bucket, over) =>
        over
          ? `Sector weights drift without anyone deciding anything: a sector that performs well grows into a larger share by itself. ${bucket} at this weight means a sector-specific shock now moves the whole portfolio.`
          : `A sector at well below market weight is an implicit view that its earnings will disappoint. Sometimes that is intended; more often it is a side effect of which funds happen to be held.`,
    }),
  );

  findings.push(
    ...sleeveFindings(ctx, "size", SIZE_BUCKETS, 0.08, {
      noun: "weight",
      learnSlug: "size-and-style",
      why: (bucket, over) =>
        over
          ? `${bucket} at this weight is a size tilt. Size has historically come with different return and volatility behaviour, and long stretches where the tilt works against you.`
          : `Portfolios built from a large-cap index plus a few well-known names often end up with almost nothing outside the largest companies. That is a size tilt whether or not it was chosen.`,
    }),
  );

  return findings;
}
