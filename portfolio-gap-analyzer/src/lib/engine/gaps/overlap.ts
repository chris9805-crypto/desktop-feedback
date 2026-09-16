import { formatCurrency, formatPercent } from "@/lib/format";
import { buildExposure } from "../exposure";
import type { EtfSecurity, Finding, Position } from "../types";
import { materiality, type GapContext } from "./context";

/**
 * Overlap between two funds, as the share of value that sits in the same
 * companies: the sum over names of min(weight in A, weight in B).
 *
 * Disclosed top holdings only cover part of each fund, so the figure is scaled
 * by the disclosed share to estimate overlap across the whole fund. That makes
 * it an estimate, and the finding says so.
 */
export function estimateOverlap(a: EtfSecurity, b: EtfSecurity): number {
  const mapA = new Map(a.topHoldings.map((h) => [h.symbol, h.weight]));
  const mapB = new Map(b.topHoldings.map((h) => [h.symbol, h.weight]));
  const disclosedA = a.topHoldings.reduce((s, h) => s + h.weight, 0);
  const disclosedB = b.topHoldings.reduce((s, h) => s + h.weight, 0);
  if (disclosedA <= 0 || disclosedB <= 0) return indexOverlapFallback(a, b);

  let shared = 0;
  for (const [symbol, weightA] of mapA) {
    const weightB = mapB.get(symbol);
    if (weightB) shared += Math.min(weightA, weightB);
  }

  const disclosedOverlap = shared / Math.min(disclosedA, disclosedB);
  // Blend the disclosed-name result with the structural similarity of the two
  // funds, so two S&P 500 trackers that disclose different holdings counts do
  // not come out looking materially different from each other.
  return Math.min(1, 0.5 * disclosedOverlap + 0.5 * indexOverlapFallback(a, b));
}

/**
 * Structural similarity, used where holdings are not disclosed.
 *
 * Asset class and region act as gates rather than as scored dimensions: any two
 * US equity funds match on both, so averaging them in would put a floor of
 * roughly 0.5 under every pair and make a broad index fund look like a
 * duplicate of a sector fund. Sector and size are what actually distinguish two
 * equity funds from each other, so they carry the score.
 */
function indexOverlapFallback(a: EtfSecurity, b: EtfSecurity): number {
  const ea = buildExposure(a);
  const eb = buildExposure(b);

  const intersect = (dim: "assetClass" | "region" | "sector" | "size") => {
    const mapA = ea[dim] as Record<string, number>;
    const mapB = eb[dim] as Record<string, number>;
    let shared = 0;
    for (const key of Object.keys(mapA)) shared += Math.min(mapA[key] ?? 0, mapB[key] ?? 0);
    return shared;
  };

  const gate = Math.min(intersect("assetClass"), intersect("region"));
  if (gate <= 0) return 0;

  // Normalise the sleeve dimensions by the smaller fund's equity share, so a
  // mixed-asset fund is not penalised for the part that has no sector at all.
  const sleeve = Math.min(
    ea.assetClass.equity + ea.assetClass.realEstate,
    eb.assetClass.equity + eb.assetClass.realEstate,
  );
  if (sleeve <= 0) return gate;

  const sectorSimilarity = intersect("sector") / sleeve;
  const sizeSimilarity = intersect("size") / sleeve;
  return Math.min(1, gate * (0.65 * sectorSimilarity + 0.35 * sizeSimilarity));
}

const REDUNDANCY_THRESHOLD = 0.8;
const MATERIAL_WEIGHT = 0.03;

export function overlapFindings(ctx: GapContext): Finding[] {
  const currency = ctx.portfolio.baseCurrency;
  const funds = ctx.portfolio.positions.filter(
    (p): p is Position & { security: EtfSecurity } => p.security.kind === "etf" && p.weight >= MATERIAL_WEIGHT,
  );

  const findings: Finding[] = [];

  for (let i = 0; i < funds.length; i++) {
    for (let j = i + 1; j < funds.length; j++) {
      const a = funds[i];
      const b = funds[j];
      if (!a || !b) continue;

      const overlap = estimateOverlap(a.security, b.security);
      if (overlap < REDUNDANCY_THRESHOLD) continue;

      const combinedWeight = a.weight + b.weight;
      const combinedValue = a.value + b.value;
      const dearer = a.security.fund.expenseRatio >= b.security.fund.expenseRatio ? a : b;
      const cheaper = dearer === a ? b : a;
      const feeGap = dearer.security.fund.expenseRatio - cheaper.security.fund.expenseRatio;
      const annualSaving = feeGap * dearer.value;

      findings.push({
        id: `overlap-${a.symbol}-${b.symbol}`,
        category: "overlap",
        direction: "over",
        severity: materiality({ magnitude: overlap - REDUNDANCY_THRESHOLD, scaleAt: 0.2, valueShare: combinedWeight, weight: feeGap > 0.0005 ? 1.1 : 0.85 }),
        title: `${a.symbol} and ${b.symbol} hold much the same thing`,
        summary: `Estimated overlap is ${formatPercent(overlap, 0)} across ${formatCurrency(combinedValue, currency)}, or ${formatPercent(combinedWeight)} of the portfolio. Two lines, close to one exposure.${feeGap > 0.0001 ? ` ${dearer.symbol} charges ${formatPercent(feeGap, 2)} more.` : ""}`,
        why:
          "Holding two funds that track near-identical exposure does not add diversification — it adds a second set of charges, a second tracking difference and a second thing to rebalance. Overlap usually appears by accident: a fund bought at one broker, the same exposure bought later at another, or a provider switch that never got tidied up.",
        evidence: [
          { label: "Estimated overlap", value: formatPercent(overlap, 0), detail: "from disclosed holdings and the funds' structural profile" },
          { label: a.symbol, value: formatPercent(a.weight), detail: `${a.security.fund.indexName} · ${formatPercent(a.security.fund.expenseRatio, 2)} ongoing charge` },
          { label: b.symbol, value: formatPercent(b.weight), detail: `${b.security.fund.indexName} · ${formatPercent(b.security.fund.expenseRatio, 2)} ongoing charge` },
          ...(annualSaving > 1
            ? [{ label: "Cost difference", value: `${formatCurrency(annualSaving, currency)} a year`, detail: `if ${dearer.symbol} were held as ${cheaper.symbol} instead` }]
            : []),
        ],
        learnSlug: "fund-overlap",
        implementation: {
          objective: "Decide whether both funds are earning their place, or consolidate into one.",
          gapValue: annualSaving > 0 ? annualSaving : null,
          routes: [
            {
              label: "Consolidate into the cheaper line",
              detail: `${cheaper.symbol} charges ${formatPercent(cheaper.security.fund.expenseRatio, 2)} against ${formatPercent(dearer.security.fund.expenseRatio, 2)} for ${dearer.symbol}.${annualSaving > 1 ? ` On the current balance that is ${formatCurrency(annualSaving, currency)} a year.` : ""}`,
            },
            {
              label: "Or stop adding to one of them",
              detail: "Directing new money to a single fund lets the duplication fade without a disposal, which matters if the position carries a gain in a taxable account.",
            },
            {
              label: "Check whether the difference is the point",
              detail: `Different domicile, hedging or distribution policy can justify two similar funds. ${a.symbol} is ${a.security.fund.domicile}-domiciled and ${a.security.fund.distribution}; ${b.symbol} is ${b.security.fund.domicile}-domiciled and ${b.security.fund.distribution}.`,
            },
          ],
          screen: null,
          tradeoffs: [
            "Consolidating in a taxable account can realise a gain. The fee saving may take years to outweigh the tax bill — worth working out before acting.",
            "Two funds in different accounts can be deliberate, for example to keep contributions simple at each provider.",
          ],
        },
      });
    }
  }

  return findings.sort((a, b) => b.severity - a.severity).slice(0, 4);
}
