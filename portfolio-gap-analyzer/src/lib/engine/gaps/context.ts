import type {
  InvestorProfile,
  Portfolio,
  PortfolioMetrics,
  ReferenceModel,
} from "../types";

export interface GapContext {
  portfolio: Portfolio;
  profile: InvestorProfile;
  reference: ReferenceModel;
  metrics: PortfolioMetrics;
}

/**
 * Rank findings against each other.
 *
 * `magnitude` is how far off the portfolio is in whatever unit the check uses,
 * and `scaleAt` is the point at which that check is considered fully material.
 * `valueShare` is how much of the portfolio the finding touches, so a 10-point
 * gap in a sleeve worth 4% of the portfolio ranks below the same gap in a
 * sleeve worth 40%.
 *
 * This orders the list. It is not a risk score, and a low number does not mean
 * a finding is unimportant to a particular investor.
 */
export function materiality(opts: {
  magnitude: number;
  scaleAt: number;
  valueShare: number;
  weight?: number;
}): number {
  const magnitude = Math.min(1, Math.abs(opts.magnitude) / opts.scaleAt);
  const valueShare = Math.min(1, Math.max(0, opts.valueShare));
  const raw = 0.65 * magnitude + 0.35 * valueShare;
  return Math.round(Math.max(1, Math.min(100, raw * 100 * (opts.weight ?? 1))));
}

/** Label of the position that contributes most to a given bucket, for trim routes. */
export function largestContributor(
  ctx: GapContext,
  pick: (symbol: string) => number,
): string | null {
  let best: { symbol: string; name: string; contribution: number } | null = null;
  for (const position of ctx.portfolio.positions) {
    const contribution = pick(position.symbol) * position.weight;
    if (contribution > 0 && (!best || contribution > best.contribution)) {
      best = { symbol: position.symbol, name: position.security.name, contribution };
    }
  }
  return best ? `${best.name} (${best.symbol})` : null;
}
