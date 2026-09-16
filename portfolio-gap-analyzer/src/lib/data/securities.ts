import type { EtfSecurity, Security, StockSecurity } from "@/lib/engine/types";
import { ETFS } from "./etfs";
import { STOCKS } from "./stocks";

export const SECURITIES: Security[] = [...ETFS, ...STOCKS];

/** Strip the punctuation people type differently: BRK.B, BRK-B and BRKB are one thing. */
export function normaliseSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/[.\-_\s]/g, "");
}

const BY_SYMBOL = new Map<string, Security>();
for (const security of SECURITIES) {
  BY_SYMBOL.set(normaliseSymbol(security.symbol), security);
}

/** Common tickers for the same exposure, so a lookup does not dead-end on a listing variant. */
const ALIASES: Record<string, string> = {
  BRKA: "BRK.B",
  GOOG: "GOOGL",
  FB: "META",
  VWRL: "VWRP",
  SWDA: "IWDA",
  VUAG: "VUSA",
  "0P0000": "VWRP",
  TSMC: "TSM",
  "9988": "BABA",
  "0700": "TCEHY",
  SSNLF: "005930",
  RDSA: "SHEL",
  UL: "ULVR",
  HSBC: "HSBA",
  NVO: "NOVO",
  TM: "7203",
};

export function lookupSecurity(symbol: string): Security | undefined {
  const key = normaliseSymbol(symbol);
  const direct = BY_SYMBOL.get(key);
  if (direct) return direct;
  const alias = ALIASES[key];
  return alias ? BY_SYMBOL.get(normaliseSymbol(alias)) : undefined;
}

export function isEtf(s: Security): s is EtfSecurity {
  return s.kind === "etf";
}

export function isStock(s: Security): s is StockSecurity {
  return s.kind === "stock";
}

export const ETF_UNIVERSE: EtfSecurity[] = SECURITIES.filter(isEtf);
export const STOCK_UNIVERSE: StockSecurity[] = SECURITIES.filter(isStock);

export function searchSecurities(query: string, limit = 12): Security[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored = SECURITIES.map((s) => {
    const symbol = s.symbol.toLowerCase();
    const name = s.name.toLowerCase();
    let score = -1;
    if (symbol === q) score = 100;
    else if (symbol.startsWith(q)) score = 80;
    else if (name.startsWith(q)) score = 60;
    else if (name.includes(q)) score = 40;
    else if (symbol.includes(q)) score = 30;
    return { s, score };
  })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((r) => r.s);
}

/** Display name for a look-through symbol that may not be in the master. */
export function displayName(symbol: string, fallback?: string): string {
  return lookupSecurity(symbol)?.name ?? fallback ?? symbol;
}
