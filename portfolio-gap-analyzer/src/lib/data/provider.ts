import type { Security } from "@/lib/engine/types";
import { DATASET_META } from "./dataset-meta";
import { SECURITIES, lookupSecurity, searchSecurities } from "./securities";

/**
 * The seam between the analysis engine and wherever security data comes from.
 *
 * The engine itself is pure: it takes `Security` records and produces a report,
 * with no knowledge of how those records were obtained. Everything bundled in
 * this build comes from `BundledProvider`, which reads the illustrative sample
 * dataset. Replacing it with a live feed means implementing this interface and
 * nothing else — no engine change, no detector change, no UI change.
 *
 * Two things a real implementation has to get right, because the sample data
 * papers over both:
 *
 *  1. Fund breakdowns and top holdings come from provider factsheets and are
 *     updated monthly at best. Every finding that depends on look-through is
 *     therefore as stale as the slowest factsheet, and the caveats in the
 *     report should say which date each fund's data carries.
 *  2. Prices, fundamentals and FX all need a consistent as-of date. Mixing a
 *     live price with a year-old book value produces a valuation figure that
 *     looks precise and is not.
 */
export interface MarketDataProvider {
  readonly id: string;
  /** What this provider's data is and how far it can be trusted. */
  readonly meta: { kind: "illustrative" | "live" | "delayed"; asOf: string; warning: string };
  getSecurity(symbol: string): Promise<Security | undefined>;
  search(query: string, limit?: number): Promise<Security[]>;
  listAll(): Promise<Security[]>;
}

export const BundledProvider: MarketDataProvider = {
  id: "bundled-sample",
  meta: DATASET_META,
  async getSecurity(symbol) {
    return lookupSecurity(symbol);
  },
  async search(query, limit = 12) {
    return searchSecurities(query, limit);
  },
  async listAll() {
    return SECURITIES;
  },
};

let active: MarketDataProvider = BundledProvider;

export function getProvider(): MarketDataProvider {
  return active;
}

/** Swap the data source. Call once at startup, before anything reads securities. */
export function setProvider(provider: MarketDataProvider): void {
  active = provider;
}
