import type { Region, Sector, SizeBucket } from "./types";

export type ReferencePresetId = "msciWorld" | "sp500" | "globalAllCap";

export interface ReferencePreset {
  id: ReferencePresetId;
  label: string;
  /** One line on what the index actually covers. */
  blurb: string;
  /** What this choice means for the gaps the report will and will not find. */
  consequence: string;
  region: Record<Region, number>;
  sector: Record<Sector, number>;
  size: Record<SizeBucket, number>;
  /**
   * Long-run historical real return and volatility for this index, annualised.
   * Assumptions, shown to the reader and editable — not forecasts.
   */
  realReturn: number;
  volatility: number;
}

const WORLD_SECTORS: Record<Sector, number> = {
  informationTechnology: 0.27,
  financials: 0.155,
  industrials: 0.11,
  healthCare: 0.105,
  consumerDiscretionary: 0.105,
  communicationServices: 0.085,
  consumerStaples: 0.06,
  energy: 0.037,
  materials: 0.033,
  utilities: 0.028,
  realEstate: 0.021,
};

const US_SECTORS: Record<Sector, number> = {
  informationTechnology: 0.315,
  financials: 0.131,
  consumerDiscretionary: 0.102,
  healthCare: 0.104,
  communicationServices: 0.098,
  industrials: 0.086,
  consumerStaples: 0.055,
  energy: 0.033,
  utilities: 0.028,
  realEstate: 0.026,
  materials: 0.022,
};

const GLOBAL_SECTORS: Record<Sector, number> = {
  informationTechnology: 0.263,
  financials: 0.163,
  industrials: 0.112,
  consumerDiscretionary: 0.104,
  healthCare: 0.101,
  communicationServices: 0.087,
  consumerStaples: 0.061,
  energy: 0.038,
  materials: 0.035,
  utilities: 0.029,
  realEstate: 0.023,
};

const NO_REGIONS: Record<Region, number> = {
  us: 0, canada: 0, uk: 0, europeExUk: 0, japan: 0, asiaPacificDeveloped: 0, emergingMarkets: 0,
};

export const PRESETS: Record<ReferencePresetId, ReferencePreset> = {
  msciWorld: {
    id: "msciWorld",
    label: "MSCI World",
    blurb: "Large and mid-cap companies across 23 developed markets. Around 1,400 holdings, roughly 70% of it in the United States.",
    consequence:
      "No emerging markets, so EM holdings read as an overweight rather than a gap. That is about a tenth of global listed value — a real exclusion, not a rounding difference.",
    region: { ...NO_REGIONS, us: 0.706, canada: 0.03, uk: 0.037, europeExUk: 0.131, japan: 0.058, asiaPacificDeveloped: 0.038 },
    sector: WORLD_SECTORS,
    size: { large: 0.86, mid: 0.14, small: 0 },
    realReturn: 0.05,
    volatility: 0.15,
  },
  sp500: {
    id: "sp500",
    label: "S&P 500",
    blurb: "The 500 largest US companies, about 85% of the US market by value and roughly 60% of global listed market value.",
    consequence:
      "A single country. Everything outside the US reads as an overweight, and no international gap can be found. Historically a higher return than a global index, and more concentration.",
    region: { ...NO_REGIONS, us: 1 },
    sector: US_SECTORS,
    size: { large: 0.88, mid: 0.12, small: 0 },
    realReturn: 0.063,
    volatility: 0.155,
  },
  globalAllCap: {
    id: "globalAllCap",
    label: "Global all-cap",
    blurb: "Developed and emerging markets, large through small — the closest thing to the whole listed market portfolio.",
    consequence:
      "The broadest of the three, so it finds the most gaps: emerging markets and small caps both carry weight here that the other two do not.",
    region: { us: 0.635, canada: 0.027, uk: 0.034, europeExUk: 0.119, japan: 0.053, asiaPacificDeveloped: 0.037, emergingMarkets: 0.095 },
    sector: GLOBAL_SECTORS,
    size: { large: 0.72, mid: 0.19, small: 0.09 },
    realReturn: 0.051,
    volatility: 0.152,
  },
};

export const PRESET_LIST: ReferencePreset[] = [PRESETS.msciWorld, PRESETS.sp500, PRESETS.globalAllCap];

export const DEFAULT_PRESET: ReferencePresetId = "msciWorld";

/** Long-run historical real returns for the non-equity sleeves, on the same basis. */
export const SLEEVE_ASSUMPTIONS = {
  bonds: { realReturn: 0.016, volatility: 0.06 },
  /**
   * Index-linked government bonds. A lower real yield than nominals is the
   * price of having the principal follow inflation contractually.
   */
  inflationLinked: { realReturn: 0.011, volatility: 0.055 },
  /**
   * Broad commodity futures. Historically close to zero real return over very
   * long periods, with equity-like volatility — held for what it does during
   * an inflation shock, not for what it compounds at.
   */
  commodities: { realReturn: 0.005, volatility: 0.17 },
  cash: { realReturn: 0.005, volatility: 0.011 },
  /** Equity/bond correlation. Positive but low over long periods, and unstable in crises. */
  equityBondCorrelation: 0.1,
  /** Commodities have historically been close to uncorrelated with equities. */
  equityCommodityCorrelation: 0.15,
};

/** How hard the defensive sleeve leans against inflation. */
export const INFLATION_STANCES = [
  {
    id: 0 as const,
    label: "Low",
    blurb: "Nominal government and investment-grade bonds only.",
    detail:
      "The defensive sleeve is built to cushion equity falls. Nominal bonds do that well and lose purchasing power in an inflation shock.",
    commodityShare: 0,
    linkerShareOfBonds: 0,
  },
  {
    id: 1 as const,
    label: "Moderate",
    blurb: "Around a third of the bond sleeve in inflation-linked bonds.",
    detail:
      "Index-linked bonds track inflation contractually, so they defend purchasing power directly rather than by correlation. A small commodity sleeve is added on top.",
    commodityShare: 0.03,
    linkerShareOfBonds: 0.33,
  },
  {
    id: 2 as const,
    label: "High",
    blurb: "Half the bond sleeve in linkers, plus a capped commodity sleeve.",
    detail:
      "The strongest inflation stance the model offers. Commodities are capped because they pay no income and have equity-like volatility — they are funded out of the bond sleeve, which makes that sleeve less reliable as an equity cushion.",
    commodityShare: 0.07,
    linkerShareOfBonds: 0.5,
  },
];
