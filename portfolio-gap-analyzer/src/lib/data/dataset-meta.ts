/**
 * The bundled security master is ILLUSTRATIVE SAMPLE DATA.
 *
 * Figures are hand-curated to be plausible and internally consistent so the
 * engine can be exercised end to end, and they are deliberately rounded. They
 * are not live market data, they are not audited, and they will drift from
 * reality the moment you read them. Swap in a real provider through
 * `src/lib/data/provider.ts` before putting this in front of anyone.
 */
export const DATASET_META = {
  kind: "illustrative" as const,
  asOf: "2025-06-30",
  headline: "Illustrative sample data — not live market data",
  warning:
    "Prices, fundamentals and fund breakdowns in this build are hand-curated sample figures, rounded and frozen at a single date. Use them to explore how the analysis works, never to size a real trade. Connect a market-data provider for live figures.",
};
