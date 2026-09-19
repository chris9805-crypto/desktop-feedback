/**
 * Trailing total returns, illustrative like the rest of the bundled dataset.
 *
 * Kept in its own table keyed by symbol rather than inside each security row:
 * returns are the one field a real provider would refresh daily, so isolating
 * them keeps the swap to live data to a single file.
 *
 * Figures are total return (price plus income) over the period ending at the
 * dataset's as-of date, as decimals.
 */
export interface TrailingReturns {
  return3m: number;
  return12m: number;
}

const T = (return3m: number, return12m: number): TrailingReturns => ({ return3m, return12m });

export const TRAILING: Record<string, TrailingReturns> = {
  // --- broad equity funds
  VTI: T(0.041, 0.238), VOO: T(0.043, 0.245), SPY: T(0.042, 0.244), ITOT: T(0.041, 0.237),
  QQQ: T(0.068, 0.312), VT: T(0.035, 0.196), VXUS: T(0.022, 0.121), VEA: T(0.024, 0.128),
  IEFA: T(0.025, 0.131), VWO: T(0.018, 0.107), IEMG: T(0.019, 0.112), VGK: T(0.028, 0.142),
  EWJ: T(0.011, 0.094), EWU: T(0.031, 0.151), VWRP: T(0.035, 0.194), IWDA: T(0.038, 0.221),
  EIMI: T(0.019, 0.109), VUSA: T(0.043, 0.243),
  // --- size and style
  VTV: T(0.029, 0.164), VUG: T(0.056, 0.318), IJR: T(0.012, 0.081), IJH: T(0.021, 0.118),
  AVUV: T(0.008, 0.062), VYM: T(0.031, 0.158), SCHD: T(0.018, 0.098),
  // --- factor
  QUAL: T(0.045, 0.259), USMV: T(0.026, 0.131), MTUM: T(0.074, 0.351), VLUE: T(0.024, 0.141),
  // --- sectors
  XLK: T(0.072, 0.328), XLV: T(0.014, 0.062), XLE: T(-0.021, 0.041), XLF: T(0.038, 0.271),
  XLU: T(0.048, 0.212), XLP: T(0.016, 0.081),
  // --- bonds and cash
  BND: T(0.014, 0.058), AGG: T(0.014, 0.057), BNDX: T(0.012, 0.051), VGIT: T(0.015, 0.054),
  VGSH: T(0.011, 0.049), TLT: T(0.021, 0.018), TIP: T(0.016, 0.062), LQD: T(0.017, 0.074),
  HYG: T(0.018, 0.101), SGOV: T(0.012, 0.051), AGGU: T(0.013, 0.053),
  // --- real assets
  VNQ: T(0.032, 0.104), IAU: T(0.081, 0.284),

  // --- US companies
  AAPL: T(0.062, 0.181), MSFT: T(0.021, 0.128), NVDA: T(0.148, 0.842), AMZN: T(0.054, 0.312),
  GOOGL: T(0.038, 0.224), META: T(0.091, 0.514), AVGO: T(0.112, 0.628), TSLA: T(0.038, -0.062),
  "BRK.B": T(0.034, 0.192), LLY: T(0.072, 0.386), JPM: T(0.046, 0.318), V: T(0.028, 0.164),
  UNH: T(-0.041, -0.082), XOM: T(-0.018, 0.062), JNJ: T(0.012, 0.041), PG: T(0.008, 0.052),
  HD: T(0.024, 0.118), MA: T(0.031, 0.178), COST: T(0.041, 0.264), KO: T(0.018, 0.088),
  PEP: T(-0.012, -0.031), MRK: T(-0.028, -0.048), ABBV: T(0.036, 0.201), WMT: T(0.058, 0.348),
  CVX: T(-0.012, 0.028), CRM: T(0.018, 0.092), AMD: T(-0.034, 0.041), NFLX: T(0.082, 0.412),
  ORCL: T(0.094, 0.468), TXN: T(0.022, 0.104), CAT: T(0.048, 0.216), HON: T(0.014, 0.068),
  LIN: T(0.026, 0.121), NEE: T(0.052, 0.188), DUK: T(0.038, 0.142), VZ: T(0.019, 0.124),
  PFE: T(-0.052, -0.118), MCD: T(0.011, 0.058), NKE: T(-0.068, -0.241), GS: T(0.064, 0.392),
  BAC: T(0.042, 0.286), AXP: T(0.051, 0.334), UPS: T(-0.044, -0.162), SBUX: T(-0.021, -0.088),
  LOW: T(0.019, 0.102), T: T(0.028, 0.176),

  // --- non-US companies
  ASML: T(-0.048, 0.081), NESN: T(-0.031, -0.112), NOVO: T(0.044, 0.218), SAP: T(0.062, 0.341),
  AZN: T(0.021, 0.094), SHEL: T(0.014, 0.068), ULVR: T(0.026, 0.108), HSBA: T(0.041, 0.264),
  TSM: T(0.088, 0.462), BABA: T(0.032, 0.058), TCEHY: T(0.046, 0.182), "005930": T(-0.018, 0.024),
  NVS: T(0.018, 0.086), INFY: T(0.012, 0.074), "7203": T(0.008, 0.042),
};

/** A security with no entry is treated as flat rather than as missing data. */
export const NO_TRAILING: TrailingReturns = { return3m: 0, return12m: 0 };

export function trailingFor(symbol: string): TrailingReturns {
  return TRAILING[symbol] ?? NO_TRAILING;
}
