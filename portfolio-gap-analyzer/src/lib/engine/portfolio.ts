import { convert } from "@/lib/data/fx";
import { lookupSecurity } from "@/lib/data/securities";
import type { Currency, HoldingInput, Portfolio, Position, UnresolvedHolding } from "./types";

export interface BuildPortfolioOptions {
  cash?: number;
  baseCurrency?: Currency;
  /** Total portfolio value, needed only when holdings are sized in percent. */
  totalValueHint?: number;
}

/**
 * Resolve raw holding lines into a priced portfolio.
 *
 * Percent-sized rows are priced off `totalValueHint`; rows we cannot price at
 * all are returned in `unresolved` rather than dropped, because a silently
 * missing holding would skew every weight in the report.
 */
export function buildPortfolio(holdings: HoldingInput[], options: BuildPortfolioOptions = {}): Portfolio {
  const baseCurrency = options.baseCurrency ?? "USD";
  const cash = Math.max(0, options.cash ?? 0);
  const hint = options.totalValueHint ?? 0;

  const positions: Position[] = [];
  const unresolved: UnresolvedHolding[] = [];

  for (const holding of holdings) {
    const security = lookupSecurity(holding.symbol);
    if (!security) {
      unresolved.push({ symbol: holding.symbol, value: holding.value ?? 0, reason: "unknown-symbol", raw: holding.symbol });
      continue;
    }

    let value: number | null = null;
    let quantity: number | null = null;

    if (typeof holding.value === "number" && holding.value > 0) {
      value = holding.value;
    } else if (typeof holding.percent === "number" && holding.percent > 0 && hint > 0) {
      value = (holding.percent / 100) * hint;
    } else if (typeof holding.quantity === "number" && holding.quantity > 0) {
      quantity = holding.quantity;
      value = convert(holding.quantity * security.price, security.currency, baseCurrency);
    }

    if (value === null || value <= 0) {
      unresolved.push({ symbol: security.symbol, value: 0, reason: "no-value", raw: holding.symbol });
      continue;
    }

    positions.push({
      symbol: security.symbol,
      security,
      quantity,
      value,
      weight: 0,
      account: holding.account ?? null,
    });
  }

  // Merge duplicate lines for the same security across accounts, so a holding
  // split over an ISA and a taxable account is analysed as one exposure.
  const merged = new Map<string, Position>();
  for (const position of positions) {
    const existing = merged.get(position.symbol);
    if (existing) {
      existing.value += position.value;
      existing.quantity = existing.quantity !== null && position.quantity !== null ? existing.quantity + position.quantity : null;
      if (existing.account && position.account && existing.account !== position.account) {
        existing.account = `${existing.account}, ${position.account}`;
      }
    } else {
      merged.set(position.symbol, { ...position });
    }
  }

  const finalPositions = [...merged.values()].sort((a, b) => b.value - a.value);
  const totalValue = finalPositions.reduce((a, p) => a + p.value, 0) + cash;
  for (const position of finalPositions) {
    position.weight = totalValue > 0 ? position.value / totalValue : 0;
  }

  return { positions: finalPositions, unresolved, cash, totalValue, baseCurrency };
}

const NUMBER = /-?[\d,]*\.?\d+/;

/**
 * Parse pasted holdings. Accepts comma, tab, semicolon or whitespace separated
 * rows and infers how each was sized:
 *
 *   VTI, 120          -> 120 shares
 *   VTI, $34,000      -> a cash value
 *   VTI, 28%          -> a share of the portfolio
 *   VTI, 120, ISA     -> 120 shares in a named account
 */
export function parseHoldings(text: string): { holdings: HoldingInput[]; errors: string[] } {
  const holdings: HoldingInput[] = [];
  const errors: string[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    // Strip thousands separators before splitting, or "$34,000" would split
    // on its own comma and be read as 34.
    const line = rawLine.trim().replace(/(\d),(?=\d{3}\b)/g, "$1");
    if (!line || line.startsWith("#")) continue;

    const cells = line.split(/[,;\t]+|\s{2,}|\s+/).map((c) => c.trim()).filter(Boolean);
    const [symbolCell, ...rest] = cells;
    if (!symbolCell) continue;

    // Skip a header row rather than reporting it as a bad ticker.
    if (/^(symbol|ticker|holding|name|instrument)$/i.test(symbolCell)) continue;

    const amountCell = rest.find((c) => NUMBER.test(c));
    if (!amountCell) {
      errors.push(`${line} — no quantity, value or percentage found`);
      continue;
    }

    const match = amountCell.match(NUMBER);
    if (!match) {
      errors.push(`${line} — could not read a number`);
      continue;
    }
    const amount = Number(match[0].replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push(`${line} — "${match[0]}" is not a usable amount`);
      continue;
    }

    const account = rest.filter((c) => c !== amountCell && !NUMBER.test(c)).join(" ") || undefined;
    const holding: HoldingInput = { symbol: symbolCell, account };

    if (/%/.test(amountCell)) holding.percent = amount;
    else if (/[$£€¥]/.test(amountCell) || /^(value|gbp|usd|eur)$/i.test(rest.at(-1) ?? "")) holding.value = amount;
    else holding.quantity = amount;

    holdings.push(holding);
  }

  return { holdings, errors };
}
