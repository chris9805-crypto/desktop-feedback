import type { FundSecurity } from "@/lib/engine/types";
import * as B from "./blends";
import { trailingFor } from "./trailing";

/**
 * Mutual funds, in the same shape as the ETFs.
 *
 * Nothing the engine does to a fund cares which wrapper it comes in — the
 * look-through, exposure, overlap and concentration maths is identical — so
 * these are ordinary `FundSecurity` records with `structure: "mutualFund"`.
 * What the wrapper does change is the cost of owning one, and that is where
 * the fields below earn their place: a sales load is a one-off bite taken
 * before a penny is invested, and no comparison of annual charges can see it.
 *
 * The set is chosen to cover what someone actually finds in a workplace
 * pension or an inherited account: near-free index share classes, the
 * load-bearing broker-sold funds that still hold trillions, and a target-date
 * fund, which is the case where look-through matters most because the thing
 * holds other funds rather than companies.
 */
type FundInit = Omit<FundSecurity, "kind" | "fund" | "breakdown" | "trailing"> & {
  fund: Partial<FundSecurity["fund"]> & Pick<FundSecurity["fund"], "expenseRatio" | "aumUsd" | "indexName">;
  breakdown: Partial<FundSecurity["breakdown"]>;
};

function mutualFund(init: FundInit): FundSecurity {
  return {
    kind: "fund",
    trailing: trailingFor(init.symbol),
    ...init,
    fund: {
      structure: "mutualFund",
      inceptionYear: 1990,
      domicile: "US",
      replication: "physicalFull",
      distribution: "accumulating",
      holdingsCount: 500,
      // Mutual funds transact once a day at net asset value, so there is no
      // bid/ask spread to pay. Zero here is the truth, not a missing figure.
      spread: 0,
      trackingDifference: -0.0004,
      currencyHedged: false,
      minimumInvestment: 3000,
      ...init.fund,
    },
    breakdown: {
      assetClass: {},
      region: {},
      sector: {},
      size: {},
      style: {},
      factor: {},
      credit: {},
      currency: {},
      ...init.breakdown,
    },
  };
}

const SP500_TOP = [
  { symbol: "NVDA", name: "NVIDIA", weight: 0.071 },
  { symbol: "MSFT", name: "Microsoft", weight: 0.067 },
  { symbol: "AAPL", name: "Apple", weight: 0.058 },
  { symbol: "AMZN", name: "Amazon", weight: 0.039 },
  { symbol: "META", name: "Meta Platforms", weight: 0.028 },
  { symbol: "AVGO", name: "Broadcom", weight: 0.024 },
  { symbol: "GOOGL", name: "Alphabet", weight: 0.023 },
  { symbol: "BRK.B", name: "Berkshire Hathaway", weight: 0.017 },
  { symbol: "TSLA", name: "Tesla", weight: 0.016 },
  { symbol: "JPM", name: "JPMorgan Chase", weight: 0.014 },
];

const TOTAL_US_TOP = SP500_TOP.map((h) => ({ ...h, weight: h.weight * 0.88 }));

export const MUTUAL_FUNDS: FundSecurity[] = [
  // ------------------------------------------------- index share classes
  mutualFund({
    symbol: "VFIAX",
    name: "Vanguard 500 Index Fund Admiral",
    currency: "USD",
    listingCountry: "US",
    price: 520.4,
    volatility3y: 0.161,
    beta: 1.0,
    duration: 0,
    yield: 0.0127,
    fund: { expenseRatio: 0.0004, aumUsd: 1.4e12, inceptionYear: 2000, indexName: "S&P 500", holdingsCount: 503, minimumInvestment: 3000 },
    breakdown: { assetClass: { equity: 0.977, realEstate: 0.023 }, region: B.US_ONLY, sector: B.US_SECTORS, size: B.LARGE_BLEND, style: B.BLEND_STYLE, currency: B.USD_ONLY },
    topHoldings: SP500_TOP,
    description:
      "The same 500 companies as an S&P 500 ETF, in mutual-fund form. Trades once a day at net asset value rather than through the day, and needs a $3,000 minimum rather than the price of one share.",
  }),
  mutualFund({
    symbol: "FXAIX",
    name: "Fidelity 500 Index Fund",
    currency: "USD",
    listingCountry: "US",
    price: 196.8,
    volatility3y: 0.161,
    beta: 1.0,
    duration: 0,
    yield: 0.0124,
    fund: { expenseRatio: 0.00015, aumUsd: 6.3e11, inceptionYear: 1988, indexName: "S&P 500", holdingsCount: 503, minimumInvestment: 0 },
    breakdown: { assetClass: { equity: 0.977, realEstate: 0.023 }, region: B.US_ONLY, sector: B.US_SECTORS, size: B.LARGE_BLEND, style: B.BLEND_STYLE, currency: B.USD_ONLY },
    topHoldings: SP500_TOP,
    description:
      "An S&P 500 tracker with no minimum and one of the lowest charges available anywhere. A common default inside US workplace plans.",
  }),
  mutualFund({
    symbol: "VTSAX",
    name: "Vanguard Total Stock Market Index Admiral",
    currency: "USD",
    listingCountry: "US",
    price: 142.1,
    volatility3y: 0.163,
    beta: 1.0,
    duration: 0,
    yield: 0.0124,
    fund: { expenseRatio: 0.0004, aumUsd: 1.6e12, inceptionYear: 2000, indexName: "CRSP US Total Market", holdingsCount: 3600 },
    breakdown: { assetClass: { equity: 0.974, realEstate: 0.026 }, region: B.US_ONLY, sector: B.US_SECTORS, size: B.TOTAL_MARKET_SIZE, style: B.BLEND_STYLE, currency: B.USD_ONLY },
    topHoldings: TOTAL_US_TOP,
    description:
      "Every investable US-listed company, weighted by market value. The mutual-fund twin of a total-market ETF, and the same portfolio underneath.",
  }),
  mutualFund({
    symbol: "VTIAX",
    name: "Vanguard Total International Stock Index Admiral",
    currency: "USD",
    listingCountry: "US",
    price: 37.2,
    volatility3y: 0.155,
    beta: 0.86,
    duration: 0,
    yield: 0.0294,
    fund: { expenseRatio: 0.0009, aumUsd: 4.4e11, inceptionYear: 2010, indexName: "FTSE Global All Cap ex US", holdingsCount: 8600 },
    breakdown: {
      assetClass: { equity: 0.978, realEstate: 0.022 },
      region: { canada: 0.075, uk: 0.093, europeExUk: 0.325, japan: 0.185, asiaPacificDeveloped: 0.127, emergingMarkets: 0.195 },
      sector: B.DEV_EXUS_SECTORS,
      size: B.TOTAL_MARKET_SIZE,
      style: B.BLEND_STYLE,
      currency: B.DEV_EXUS_CURRENCIES,
    },
    topHoldings: [
      { symbol: "TSM", name: "Taiwan Semiconductor", weight: 0.026 },
      { symbol: "NESN", name: "Nestle", weight: 0.011 },
      { symbol: "ASML", name: "ASML Holding", weight: 0.011 },
      { symbol: "SAP", name: "SAP", weight: 0.009 },
      { symbol: "AZN", name: "AstraZeneca", weight: 0.008 },
    ],
    description:
      "Everything outside the US in one fund, developed and emerging. The usual partner to a total-US fund inside a workplace plan.",
  }),
  mutualFund({
    symbol: "VBTLX",
    name: "Vanguard Total Bond Market Index Admiral",
    currency: "USD",
    listingCountry: "US",
    price: 9.6,
    volatility3y: 0.064,
    beta: 0.03,
    duration: 6.0,
    yield: 0.0438,
    fund: { expenseRatio: 0.0005, aumUsd: 3.2e11, inceptionYear: 2001, indexName: "Bloomberg US Aggregate Float Adjusted", holdingsCount: 11000, replication: "physicalSampled" },
    breakdown: { assetClass: { bond: 1 }, credit: { government: 0.68, investmentGrade: 0.32 }, currency: B.USD_ONLY },
    topHoldings: [],
    description:
      "Investment-grade US bonds across government and corporate issuers. The bond half of the standard two- or three-fund portfolio.",
  }),

  // ------------------------------------------------- broker-sold, load-bearing
  mutualFund({
    symbol: "AGTHX",
    name: "American Funds Growth Fund of America A",
    currency: "USD",
    listingCountry: "US",
    price: 78.4,
    volatility3y: 0.182,
    beta: 1.06,
    duration: 0,
    yield: 0.0036,
    fund: {
      expenseRatio: 0.0061,
      aumUsd: 2.9e11,
      inceptionYear: 1973,
      indexName: "Actively managed US large growth",
      holdingsCount: 380,
      replication: "direct",
      activelyManaged: true,
      frontLoad: 0.0575,
      twelveB1Fee: 0.0024,
      minimumInvestment: 250,
    },
    breakdown: {
      assetClass: { equity: 1 },
      region: { us: 0.88, europeExUk: 0.06, emergingMarkets: 0.04, japan: 0.02 },
      sector: { informationTechnology: 0.36, consumerDiscretionary: 0.15, communicationServices: 0.13, healthCare: 0.12, financials: 0.11, industrials: 0.08, consumerStaples: 0.03, energy: 0.02 },
      size: B.LARGE_BLEND,
      style: { growth: 0.72, blend: 0.24, value: 0.04 },
      currency: { USD: 0.9, EUR: 0.05, other: 0.05 },
    },
    topHoldings: [
      { symbol: "MSFT", name: "Microsoft", weight: 0.062 },
      { symbol: "NVDA", name: "NVIDIA", weight: 0.058 },
      { symbol: "META", name: "Meta Platforms", weight: 0.047 },
      { symbol: "AVGO", name: "Broadcom", weight: 0.036 },
      { symbol: "TSM", name: "Taiwan Semiconductor", weight: 0.031 },
      { symbol: "AMZN", name: "Amazon", weight: 0.029 },
    ],
    description:
      "One of the largest actively managed funds in existence, sold through advisers. The A share class charges 5.75% on the way in, so $10,000 buys $9,425 of fund before any return at all.",
  }),
  mutualFund({
    symbol: "ANCFX",
    name: "American Funds Fundamental Investors A",
    currency: "USD",
    listingCountry: "US",
    price: 82.1,
    volatility3y: 0.158,
    beta: 0.97,
    duration: 0,
    yield: 0.0112,
    fund: {
      expenseRatio: 0.0061,
      aumUsd: 1.3e11,
      inceptionYear: 1978,
      indexName: "Actively managed US large blend",
      holdingsCount: 190,
      replication: "direct",
      activelyManaged: true,
      frontLoad: 0.0575,
      twelveB1Fee: 0.0024,
      minimumInvestment: 250,
    },
    breakdown: {
      assetClass: { equity: 1 },
      region: { us: 0.85, europeExUk: 0.07, emergingMarkets: 0.05, japan: 0.03 },
      sector: B.US_SECTORS,
      size: B.LARGE_BLEND,
      style: B.BLEND_STYLE,
      currency: { USD: 0.88, EUR: 0.07, other: 0.05 },
    },
    topHoldings: [
      { symbol: "MSFT", name: "Microsoft", weight: 0.055 },
      { symbol: "AVGO", name: "Broadcom", weight: 0.045 },
      { symbol: "NVDA", name: "NVIDIA", weight: 0.041 },
      { symbol: "META", name: "Meta Platforms", weight: 0.03 },
    ],
    description:
      "A large US blend fund sold with a front-end sales charge. Its portfolio is close enough to a broad US index that the charge, not the strategy, is the main difference.",
  }),
  mutualFund({
    symbol: "FCNTX",
    name: "Fidelity Contrafund",
    currency: "USD",
    listingCountry: "US",
    price: 21.4,
    volatility3y: 0.179,
    beta: 1.04,
    duration: 0,
    yield: 0.0012,
    fund: {
      expenseRatio: 0.0039,
      aumUsd: 1.4e11,
      inceptionYear: 1967,
      indexName: "Actively managed US large growth",
      holdingsCount: 320,
      replication: "direct",
      activelyManaged: true,
      minimumInvestment: 0,
    },
    breakdown: {
      assetClass: { equity: 1 },
      region: { us: 0.91, europeExUk: 0.05, emergingMarkets: 0.04 },
      sector: { informationTechnology: 0.33, communicationServices: 0.19, consumerDiscretionary: 0.14, financials: 0.13, healthCare: 0.1, industrials: 0.07, consumerStaples: 0.04 },
      size: B.LARGE_BLEND,
      style: { growth: 0.68, blend: 0.27, value: 0.05 },
      currency: B.USD_ONLY,
    },
    topHoldings: [
      { symbol: "META", name: "Meta Platforms", weight: 0.142 },
      { symbol: "NVDA", name: "NVIDIA", weight: 0.084 },
      { symbol: "MSFT", name: "Microsoft", weight: 0.057 },
      { symbol: "AMZN", name: "Amazon", weight: 0.051 },
      { symbol: "GOOGL", name: "Alphabet", weight: 0.036 },
    ],
    description:
      "A long-running active fund with no sales charge but a concentrated book — its largest position alone is around 14%, several times what an index fund would hold.",
  }),

  // ------------------------------------------------- a fund made of funds
  mutualFund({
    symbol: "VFIFX",
    name: "Vanguard Target Retirement 2050",
    currency: "USD",
    listingCountry: "US",
    price: 48.7,
    volatility3y: 0.148,
    beta: 0.91,
    duration: 6.1,
    yield: 0.0198,
    fund: { expenseRatio: 0.0008, aumUsd: 8.4e10, inceptionYear: 2006, indexName: "Vanguard Target Retirement 2050 composite", holdingsCount: 4, minimumInvestment: 1000 },
    breakdown: {
      assetClass: { equity: 0.88, bond: 0.1, realEstate: 0.02 },
      region: B.GLOBAL_REGIONS,
      sector: B.GLOBAL_SECTORS,
      size: B.TOTAL_MARKET_SIZE,
      style: B.BLEND_STYLE,
      credit: { government: 0.65, investmentGrade: 0.35 },
      currency: B.GLOBAL_CURRENCIES,
    },
    // Holds four other funds, not companies. The look-through expands these.
    topHoldings: [
      { symbol: "VTSAX", name: "Vanguard Total Stock Market Index Admiral", weight: 0.54 },
      { symbol: "VTIAX", name: "Vanguard Total International Stock Index Admiral", weight: 0.36 },
      { symbol: "VBTLX", name: "Vanguard Total Bond Market Index Admiral", weight: 0.07 },
      { symbol: "BNDX", name: "Vanguard Total International Bond ETF", weight: 0.03 },
    ],
    description:
      "A single fund that holds four other funds and shifts gradually towards bonds as 2050 approaches. Its four holdings are funds, not companies, so a look-through has to go two levels deep to find out what it owns.",
  }),
];
