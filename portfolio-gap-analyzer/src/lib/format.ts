import { CURRENCY_SYMBOL } from "@/lib/data/fx";
import type { Currency } from "@/lib/engine/types";

export function formatCurrency(value: number, currency: Currency = "USD", decimals = 0): string {
  const symbol = CURRENCY_SYMBOL[currency];
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  return `${sign}${symbol}${abs.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/** Signed percentage points, for "you are 12pp over the reference". */
export function formatPp(value: number, decimals = 1): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(decimals)}pp`;
}

export function formatBps(value: number): string {
  return `${Math.round(value * 10000)}bps`;
}

export function formatMultiple(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}x`;
}

export function formatCompactCurrency(value: number, currency: Currency = "USD"): string {
  const symbol = CURRENCY_SYMBOL[currency];
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}${symbol}${(abs / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${sign}${symbol}${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}${symbol}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}${symbol}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${symbol}${abs.toFixed(0)}`;
}

const TITLES: Record<string, string> = {
  equity: "Equity",
  bond: "Bonds",
  realEstate: "Listed property",
  commodity: "Commodities",
  cash: "Cash",
  other: "Other",
  us: "United States",
  canada: "Canada",
  uk: "United Kingdom",
  europeExUk: "Europe ex-UK",
  japan: "Japan",
  asiaPacificDeveloped: "Asia-Pacific developed",
  emergingMarkets: "Emerging markets",
  informationTechnology: "Information technology",
  communicationServices: "Communication services",
  consumerDiscretionary: "Consumer discretionary",
  consumerStaples: "Consumer staples",
  energy: "Energy",
  financials: "Financials",
  healthCare: "Health care",
  industrials: "Industrials",
  materials: "Materials",
  utilities: "Utilities",
  large: "Large cap",
  mid: "Mid cap",
  small: "Small cap",
  value: "Value",
  blend: "Blend",
  growth: "Growth",
  quality: "Quality",
  momentum: "Momentum",
  smallSize: "Small size",
  lowVolatility: "Low volatility",
  dividendYield: "Dividend yield",
  government: "Government",
  inflationLinked: "Inflation-linked",
  investmentGrade: "Investment grade",
  highYield: "High yield",
  physicalFull: "Full physical replication",
  physicalSampled: "Sampled physical replication",
  synthetic: "Synthetic (swap-based)",
  direct: "Direct holding",
  accumulating: "Accumulating",
  distributing: "Distributing",
  retirement: "Retirement",
  houseDeposit: "House deposit",
  incomeNow: "Income now",
  generalGrowth: "General growth",
  educationFund: "Education fund",
  taxAdvantaged: "Tax-advantaged",
  taxable: "Taxable",
  mixed: "Mixed",
};

export function label(key: string): string {
  return TITLES[key] ?? key;
}
