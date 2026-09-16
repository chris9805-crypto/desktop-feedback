import type {
  Currency,
  Region,
  Sector,
  SizeBucket,
  StyleBucket,
} from "@/lib/engine/types";

/**
 * Reusable breakdown blends so fund records stay short and consistent.
 * All maps are normalised by `buildExposure`, so they only need to be roughly
 * proportional — they do not have to sum to exactly 1.
 */

export const US_SECTORS: Partial<Record<Sector, number>> = {
  informationTechnology: 0.315,
  communicationServices: 0.098,
  consumerDiscretionary: 0.102,
  consumerStaples: 0.055,
  energy: 0.033,
  financials: 0.131,
  healthCare: 0.104,
  industrials: 0.086,
  materials: 0.022,
  realEstate: 0.026,
  utilities: 0.028,
};

export const DEV_EXUS_SECTORS: Partial<Record<Sector, number>> = {
  informationTechnology: 0.126,
  communicationServices: 0.06,
  consumerDiscretionary: 0.108,
  consumerStaples: 0.078,
  energy: 0.049,
  financials: 0.226,
  healthCare: 0.105,
  industrials: 0.175,
  materials: 0.062,
  realEstate: 0.018,
  utilities: 0.033,
};

export const EM_SECTORS: Partial<Record<Sector, number>> = {
  informationTechnology: 0.245,
  communicationServices: 0.101,
  consumerDiscretionary: 0.132,
  consumerStaples: 0.049,
  energy: 0.049,
  financials: 0.244,
  healthCare: 0.036,
  industrials: 0.065,
  materials: 0.055,
  realEstate: 0.016,
  utilities: 0.028,
};

export const GLOBAL_SECTORS: Partial<Record<Sector, number>> = {
  informationTechnology: 0.263,
  communicationServices: 0.087,
  consumerDiscretionary: 0.104,
  consumerStaples: 0.061,
  energy: 0.038,
  financials: 0.163,
  healthCare: 0.101,
  industrials: 0.112,
  materials: 0.035,
  realEstate: 0.023,
  utilities: 0.029,
};

export const GLOBAL_REGIONS: Partial<Record<Region, number>> = {
  us: 0.635,
  canada: 0.027,
  uk: 0.034,
  europeExUk: 0.119,
  japan: 0.053,
  asiaPacificDeveloped: 0.037,
  emergingMarkets: 0.095,
};

export const DEV_EXUS_REGIONS: Partial<Record<Region, number>> = {
  canada: 0.087,
  uk: 0.107,
  europeExUk: 0.375,
  japan: 0.213,
  asiaPacificDeveloped: 0.148,
  emergingMarkets: 0.07,
};

export const DEV_WORLD_REGIONS: Partial<Record<Region, number>> = {
  us: 0.706,
  canada: 0.03,
  uk: 0.037,
  europeExUk: 0.131,
  japan: 0.058,
  asiaPacificDeveloped: 0.038,
};

export const US_ONLY: Partial<Record<Region, number>> = { us: 1 };
export const EM_ONLY: Partial<Record<Region, number>> = { emergingMarkets: 1 };

export const GLOBAL_CURRENCIES: Partial<Record<Currency, number>> = {
  USD: 0.66,
  EUR: 0.11,
  JPY: 0.055,
  GBP: 0.04,
  CHF: 0.024,
  CAD: 0.028,
  AUD: 0.016,
  other: 0.067,
};

export const DEV_EXUS_CURRENCIES: Partial<Record<Currency, number>> = {
  EUR: 0.32,
  JPY: 0.215,
  GBP: 0.115,
  CHF: 0.075,
  CAD: 0.087,
  AUD: 0.05,
  USD: 0.04,
  other: 0.098,
};

export const USD_ONLY: Partial<Record<Currency, number>> = { USD: 1 };

export const LARGE_BLEND: Partial<Record<SizeBucket, number>> = {
  large: 0.86,
  mid: 0.11,
  small: 0.03,
};
export const TOTAL_MARKET_SIZE: Partial<Record<SizeBucket, number>> = {
  large: 0.72,
  mid: 0.19,
  small: 0.09,
};
export const SMALL_CAP_SIZE: Partial<Record<SizeBucket, number>> = {
  large: 0.01,
  mid: 0.14,
  small: 0.85,
};
export const MID_CAP_SIZE: Partial<Record<SizeBucket, number>> = {
  large: 0.06,
  mid: 0.82,
  small: 0.12,
};

export const BLEND_STYLE: Partial<Record<StyleBucket, number>> = {
  value: 0.31,
  blend: 0.38,
  growth: 0.31,
};
export const VALUE_STYLE: Partial<Record<StyleBucket, number>> = {
  value: 0.78,
  blend: 0.19,
  growth: 0.03,
};
export const GROWTH_STYLE: Partial<Record<StyleBucket, number>> = {
  value: 0.03,
  blend: 0.18,
  growth: 0.79,
};
