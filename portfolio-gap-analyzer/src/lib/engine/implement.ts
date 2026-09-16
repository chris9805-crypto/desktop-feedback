import { ETF_UNIVERSE } from "@/lib/data/securities";
import { formatCurrency, formatPercent, label } from "@/lib/format";
import { buildExposure } from "./exposure";
import type { CandidateScreen, EtfSecurity, InvestorProfile } from "./types";

export type ScreenDimension = "assetClass" | "region" | "sector" | "size" | "style" | "factor" | "credit";

export interface ScreenOptions {
  dimension: ScreenDimension;
  bucket: string;
  /** Minimum share of the fund that sits in the target bucket. */
  minPurity: number;
  maxExpenseRatio?: number;
  excludeSymbols?: string[];
  /** Restrict to funds listed in this country, for wrapper and tax reasons. */
  listingCountry?: string;
  /** Extra constraint applied after the exposure filter, e.g. a duration band. */
  extraFilter?: (etf: EtfSecurity) => boolean;
  extraFilterLabel?: string;
  limit?: number;
}

/**
 * Find instruments that deliver a given exposure.
 *
 * This is a filter over the fund universe, not a recommendation: the screen
 * criteria are returned alongside the matches so the reader can see exactly
 * what was and was not asked for, and re-run it with different limits.
 */
export function screenForExposure(options: ScreenOptions): CandidateScreen | null {
  // Some exposures have no dedicated fund in the universe — industrials is the
  // clearest example, since it is a large sector that broad funds cover and
  // sector funds mostly do not. Relaxing the purity bar in steps finds the
  // closest available match; the description always states the bar that was
  // actually met, so a relaxed result cannot be mistaken for a precise one.
  for (const purity of [options.minPurity, options.minPurity * 0.6, options.minPurity * 0.35]) {
    const screen = runScreen({ ...options, minPurity: purity });
    if (screen.symbols.length > 0) return screen;
  }
  return null;
}

function runScreen(options: ScreenOptions): CandidateScreen {
  const { dimension, bucket, minPurity, maxExpenseRatio, excludeSymbols = [], listingCountry, limit = 4 } = options;
  const excluded = new Set(excludeSymbols.map((s) => s.toUpperCase()));

  const matches = ETF_UNIVERSE.map((etf) => {
    const exposure = buildExposure(etf);
    const map = exposure[dimension] as Record<string, number>;
    return { etf, purity: map[bucket] ?? 0 };
  })
    .filter((row) => row.purity >= minPurity)
    .filter((row) => !excluded.has(row.etf.symbol.toUpperCase()))
    .filter((row) => (maxExpenseRatio === undefined ? true : row.etf.fund.expenseRatio <= maxExpenseRatio))
    .filter((row) => (listingCountry ? row.etf.listingCountry === listingCountry : true))
    .filter((row) => (options.extraFilter ? options.extraFilter(row.etf) : true))
    .sort((a, b) => {
      // Cost first among funds that clear the purity bar, then scale as a
      // rough proxy for how easy the fund is to trade and how likely it is to survive.
      if (Math.abs(a.etf.fund.expenseRatio - b.etf.fund.expenseRatio) > 0.0002) {
        return a.etf.fund.expenseRatio - b.etf.fund.expenseRatio;
      }
      return b.etf.fund.aumUsd - a.etf.fund.aumUsd;
    });

  const parts = [
    `at least ${formatPercent(minPurity, 0)} ${label(bucket).toLowerCase()} exposure`,
    maxExpenseRatio !== undefined ? `ongoing charge at or below ${formatPercent(maxExpenseRatio, 2)}` : null,
    listingCountry ? `listed in ${listingCountry}` : null,
    options.extraFilterLabel ?? null,
  ].filter(Boolean);

  return {
    description: `Funds in the bundled universe with ${parts.join(", ")}, ranked by cost then fund size.`,
    symbols: matches.slice(0, limit).map((r) => r.etf.symbol),
  };
}

/**
 * Standard ways to close a gap, ordered by how much friction they cause.
 * Directing new money first is deliberate: it avoids realising gains and
 * avoids trading costs, and for a regular saver it is often enough on its own.
 */
export function routesToClose(
  gapValue: number,
  profile: InvestorProfile,
  overweightLabel: string | null,
): { label: string; detail: string }[] {
  const routes: { label: string; detail: string }[] = [];
  const currency = profile.baseCurrency;

  if (profile.monthlyContribution > 0 && gapValue > 0) {
    const months = Math.ceil(gapValue / profile.monthlyContribution);
    routes.push({
      label: "Direct new contributions",
      detail:
        months <= 36
          ? `At ${formatCurrency(profile.monthlyContribution, currency)} a month, roughly ${months} month${months === 1 ? "" : "s"} of contributions would cover the ${formatCurrency(gapValue, currency)} difference without selling anything.`
          : `New contributions alone would take about ${Math.round(months / 12)} years to cover ${formatCurrency(gapValue, currency)}, so this would likely be one part of a wider change rather than the whole of it.`,
    });
  }

  if (overweightLabel) {
    routes.push({
      label: "Rebalance from the largest overweight",
      detail: `Trimming ${overweightLabel} is the only route here that changes the exposure immediately, and the only one that triggers a disposal.`,
    });
  }

  if (profile.taxWrapper !== "taxAdvantaged") {
    routes.push({
      label: "Check the tax position first",
      detail:
        "Selling in a taxable account can realise a gain. Using new money, or making the change inside a tax-advantaged account first, avoids that. Tax treatment depends on your circumstances and your country's rules.",
    });
  }

  routes.push({
    label: "Or decide the gap is intentional",
    detail:
      "A difference from the reference is not automatically a mistake. If you are deliberately taking this position, record why — then it is a decision you can review rather than a drift you never noticed.",
  });

  return routes;
}
