/** Everything the single-page artifact needs from the engine, on one global. */
export { analysePortfolio } from "@/lib/engine/analyse";
export { buildPortfolio, parseHoldings } from "@/lib/engine/portfolio";
export { buildExposure, normaliseSleeve } from "@/lib/engine/exposure";
export { allScores } from "@/lib/engine/scores";
export {
  SECURITIES,
  ETF_UNIVERSE,
  STOCK_UNIVERSE,
  lookupSecurity,
  searchSecurities,
  normaliseSymbol,
} from "@/lib/data/securities";
export { DATASET_META } from "@/lib/data/dataset-meta";
export { ARTICLES, getArticle } from "@/lib/content/education";
export { GLOSSARY } from "@/lib/content/glossary";
export { compareFees } from "@/lib/engine/fees";
export { DETECTORS } from "@/lib/engine/gaps";
export { PRESET_LIST, PRESETS, DEFAULT_PRESET, INFLATION_STANCES } from "@/lib/engine/presets";
export { buildFanChart, buildPie } from "@/lib/chart";
export {
  formatCurrency,
  formatPercent,
  formatPp,
  formatCompactCurrency,
  formatMultiple,
  label,
} from "@/lib/format";
export {
  ASSET_CLASSES,
  REGIONS,
  SECTORS,
  SIZE_BUCKETS,
  STYLE_BUCKETS,
  FACTORS,
} from "@/lib/engine/types";
export { THEMES, themeById, matchesFor } from "@/lib/engine/themes";
export { themeImpact, applySleeve } from "@/lib/engine/theme-impact";
