import type { Currency } from "@/lib/engine/types";

/**
 * Illustrative FX rates, quoted as units of USD per 1 unit of the currency.
 * Frozen at the dataset's as-of date, like everything else in this build.
 */
const USD_PER: Record<Currency, number> = {
  USD: 1,
  GBP: 1.27,
  EUR: 1.08,
  JPY: 0.0064,
  CHF: 1.12,
  CAD: 0.73,
  AUD: 0.66,
  other: 1,
};

export function convert(amount: number, from: Currency, to: Currency): number {
  if (from === to) return amount;
  const usd = amount * USD_PER[from];
  return usd / USD_PER[to];
}

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  USD: "$",
  GBP: "£",
  EUR: "€",
  JPY: "¥",
  CHF: "CHF ",
  CAD: "C$",
  AUD: "A$",
  other: "",
};
