import { DATASET_META } from "@/lib/data/dataset-meta";
import { formatPercent } from "@/lib/format";
import { runDetectors } from "./gaps";
import { computeMetrics } from "./metrics";
import { buildProjection } from "./projection";
import { buildReferenceModel, type ReferenceOverrides } from "./reference";
import type { AnalysisReport, InvestorProfile, Portfolio } from "./types";

/**
 * Coverage caveats.
 *
 * These are printed with every report rather than buried in documentation. A
 * reader cannot judge a finding without knowing what the engine could not see,
 * and several of these limits genuinely change how a finding should be read.
 */
function buildCaveats(portfolio: Portfolio, metrics: ReturnType<typeof computeMetrics>): string[] {
  const caveats: string[] = [DATASET_META.warning];

  if (portfolio.unresolved.length > 0) {
    const unknown = portfolio.unresolved.filter((u) => u.reason === "unknown-symbol").map((u) => u.raw);
    const unpriced = portfolio.unresolved.filter((u) => u.reason === "no-value").map((u) => u.raw);
    if (unknown.length > 0) {
      caveats.push(
        `Not analysed — not in the bundled security master: ${unknown.join(", ")}. Every weight below is a share of the holdings that were resolved, so these are missing from the whole report.`,
      );
    }
    if (unpriced.length > 0) {
      caveats.push(`Not analysed — no quantity, value or percentage given: ${unpriced.join(", ")}.`);
    }
  }

  const fundWeight = portfolio.positions.filter((p) => p.security.kind === "etf").reduce((a, p) => a + p.weight, 0);
  if (fundWeight > 0.1) {
    caveats.push(
      "Look-through figures use each fund's disclosed top holdings plus an even spread across the rest. Single-name concentration through funds is therefore an estimate, and a slight understatement for funds that disclose only a handful of positions.",
    );
  }

  caveats.push(
    "Momentum is not scored for directly held shares: it needs a trailing return series, which this build does not carry. A momentum tilt coming from individual stocks will not appear in the factor section.",
  );

  if (metrics.estimatedVolatility > 0) {
    caveats.push(
      `Volatility of ${formatPercent(metrics.estimatedVolatility)} comes from a single-factor model using each holding's beta and past three-year volatility. Past volatility is a poor guide to the size of a crisis, and correlations move toward one exactly when diversification is most needed.`,
    );
  }

  caveats.push(
    "Tax treatment is flagged as a consideration but never calculated. It depends on your country, your account type and your own circumstances.",
  );

  return caveats;
}

export interface AnalyseOptions {
  referenceOverrides?: ReferenceOverrides;
  /** Override the projection's return, volatility or horizon. */
  projectionOverrides?: { realReturn?: number; volatility?: number; years?: number };
  now?: Date;
}

/**
 * Run the full analysis: metrics, a reference model derived from the investor's
 * own answers, then every gap detector against the difference between them.
 */
export function analysePortfolio(
  portfolio: Portfolio,
  profile: InvestorProfile,
  options: AnalyseOptions = {},
): AnalysisReport {
  const metrics = computeMetrics(portfolio);
  const reference = buildReferenceModel(profile, portfolio.totalValue, options.referenceOverrides ?? {});
  const findings = runDetectors({ portfolio, profile, reference, metrics });
  const projection = buildProjection(reference, profile, portfolio.totalValue, options.projectionOverrides ?? {});

  return {
    generatedAt: (options.now ?? new Date()).toISOString(),
    portfolio,
    profile,
    reference,
    metrics,
    findings,
    projection,
    caveats: buildCaveats(portfolio, metrics),
  };
}
