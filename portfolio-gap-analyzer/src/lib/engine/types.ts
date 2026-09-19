/**
 * Core domain types for the portfolio gap engine.
 *
 * Design note: every exposure map below is expressed as a fraction of the
 * *whole* security's market value, not of a sleeve. A 60/40 fund therefore has
 * sector weights that sum to 0.60, not 1.00. Aggregating positions is then a
 * plain value-weighted sum, and "sector X as a share of my whole portfolio" is
 * readable straight off the total. Normalising to a sleeve is a presentation
 * concern and happens in the UI layer.
 */

export type AssetClass =
  | "equity"
  | "bond"
  | "realEstate"
  | "commodity"
  | "cash"
  | "other";

export type Region =
  | "us"
  | "canada"
  | "uk"
  | "europeExUk"
  | "japan"
  | "asiaPacificDeveloped"
  | "emergingMarkets";

export type Sector =
  | "informationTechnology"
  | "communicationServices"
  | "consumerDiscretionary"
  | "consumerStaples"
  | "energy"
  | "financials"
  | "healthCare"
  | "industrials"
  | "materials"
  | "realEstate"
  | "utilities";

export type SizeBucket = "large" | "mid" | "small";
export type StyleBucket = "value" | "blend" | "growth";

export type Factor =
  | "value"
  | "quality"
  | "momentum"
  | "smallSize"
  | "lowVolatility"
  | "dividendYield";

export type CreditBucket = "government" | "inflationLinked" | "investmentGrade" | "highYield";

export type Currency = "USD" | "GBP" | "EUR" | "JPY" | "CHF" | "CAD" | "AUD" | "other";

export const ASSET_CLASSES: readonly AssetClass[] = [
  "equity",
  "bond",
  "realEstate",
  "commodity",
  "cash",
  "other",
];

export const REGIONS: readonly Region[] = [
  "us",
  "canada",
  "uk",
  "europeExUk",
  "japan",
  "asiaPacificDeveloped",
  "emergingMarkets",
];

export const SECTORS: readonly Sector[] = [
  "informationTechnology",
  "communicationServices",
  "consumerDiscretionary",
  "consumerStaples",
  "energy",
  "financials",
  "healthCare",
  "industrials",
  "materials",
  "realEstate",
  "utilities",
];

export const SIZE_BUCKETS: readonly SizeBucket[] = ["large", "mid", "small"];
export const STYLE_BUCKETS: readonly StyleBucket[] = ["value", "blend", "growth"];
export const FACTORS: readonly Factor[] = [
  "value",
  "quality",
  "momentum",
  "smallSize",
  "lowVolatility",
  "dividendYield",
];
export const CREDIT_BUCKETS: readonly CreditBucket[] = [
  "government",
  "inflationLinked",
  "investmentGrade",
  "highYield",
];

/** A value-weighted breakdown of one security, or of a whole portfolio. */
export interface ExposureProfile {
  assetClass: Record<AssetClass, number>;
  region: Record<Region, number>;
  sector: Record<Sector, number>;
  size: Record<SizeBucket, number>;
  style: Record<StyleBucket, number>;
  /** Factor tilts are loadings, not shares: they need not sum to anything. */
  factor: Record<Factor, number>;
  credit: Record<CreditBucket, number>;
  currency: Partial<Record<Currency, number>>;
  /** Effective duration in years, weighted across the bond sleeve. */
  duration: number;
  /** Trailing 12-month distribution yield as a decimal (0.032 = 3.2%). */
  yield: number;
  /** Weighted ongoing charge as a decimal (0.0007 = 7bps). */
  expenseRatio: number;
  /**
   * Look-through to individual companies: symbol -> weight of this security's
   * value held in that company. Only covers disclosed top holdings for funds,
   * so it will not sum to the fund's equity weight.
   */
  lookThrough: Record<string, number>;
}

export type Replication = "physicalFull" | "physicalSampled" | "synthetic" | "direct";
export type Distribution = "accumulating" | "distributing";

export interface FundFacts {
  expenseRatio: number;
  aumUsd: number;
  inceptionYear: number;
  domicile: string;
  replication: Replication;
  distribution: Distribution;
  indexName: string;
  holdingsCount: number;
  /** Median bid/ask spread as a decimal, a rough tradability proxy. */
  spread: number;
  /** Annualised gap between fund and index return, decimal. Negative = lagging. */
  trackingDifference: number;
  currencyHedged: boolean;
}

export interface Fundamentals {
  revenueUsd: number;
  revenueCagr3y: number;
  epsCagr3y: number;
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
  freeCashFlowMargin: number;
  returnOnInvestedCapital: number;
  returnOnEquity: number;
  netDebtToEbitda: number;
  interestCover: number;
  currentRatio: number;
  /** Positive = dilution, negative = buybacks. 5y annualised change in share count. */
  shareCountCagr5y: number;
  dividendYield: number;
  payoutRatio: number;
  dividendGrowthStreakYears: number;
}

export interface Valuation {
  priceEarnings: number;
  forwardPriceEarnings: number;
  evToEbit: number;
  priceToSales: number;
  priceToBook: number;
  freeCashFlowYield: number;
}

interface SecurityCommon {
  symbol: string;
  name: string;
  currency: Currency;
  listingCountry: string;
  price: number;
  /** Trailing 3-year annualised standard deviation, decimal. */
  volatility3y: number;
  beta: number;
  /** Trailing total returns, used for momentum. */
  trailing: { return3m: number; return12m: number };
}

export interface StockSecurity extends SecurityCommon {
  kind: "stock";
  sector: Sector;
  industry: string;
  region: Region;
  size: SizeBucket;
  style: StyleBucket;
  marketCapUsd: number;
  fundamentals: Fundamentals;
  valuation: Valuation;
  factorTilts: Partial<Record<Factor, number>>;
  description: string;
}

export interface EtfSecurity extends SecurityCommon {
  kind: "etf";
  fund: FundFacts;
  /** Raw declared breakdown; `buildExposure` normalises it. */
  breakdown: {
    assetClass: Partial<Record<AssetClass, number>>;
    region: Partial<Record<Region, number>>;
    sector: Partial<Record<Sector, number>>;
    size: Partial<Record<SizeBucket, number>>;
    style: Partial<Record<StyleBucket, number>>;
    factor: Partial<Record<Factor, number>>;
    credit: Partial<Record<CreditBucket, number>>;
    currency: Partial<Record<Currency, number>>;
  };
  duration: number;
  yield: number;
  topHoldings: { symbol: string; name: string; weight: number }[];
  description: string;
}

export type Security = StockSecurity | EtfSecurity;

/** One line in the user's portfolio, before pricing. */
export interface HoldingInput {
  symbol: string;
  /**
   * How the line was sized. `value` wins over `percent`, which wins over
   * `quantity`, so a partially filled row still resolves predictably.
   */
  quantity?: number;
  value?: number;
  /** Share of the whole portfolio, 0-100. Needs `totalValueHint` to price. */
  percent?: number;
  /** Optional free-text account label, e.g. "ISA" or "401k". */
  account?: string;
}

export interface Position {
  symbol: string;
  security: Security;
  quantity: number | null;
  value: number;
  weight: number;
  account: string | null;
}

/** A holding line we could not resolve against the security master. */
export interface UnresolvedHolding {
  symbol: string;
  value: number;
  reason: "unknown-symbol" | "no-value";
  /** What the user typed, kept so the UI can offer a correction. */
  raw: string;
}

export interface Portfolio {
  positions: Position[];
  unresolved: UnresolvedHolding[];
  /** Un-invested cash held in the account, in base currency. */
  cash: number;
  totalValue: number;
  baseCurrency: Currency;
}

export type Goal =
  | "retirement"
  | "houseDeposit"
  | "incomeNow"
  | "generalGrowth"
  | "educationFund";

export type TaxWrapper = "taxAdvantaged" | "taxable" | "mixed";

export interface InvestorProfile {
  baseCurrency: Currency;
  /** Where the investor's spending liabilities sit. Drives home-bias framing. */
  homeRegion: Region;
  goal: Goal;
  /** Years until the money is needed. */
  horizonYears: number;
  /** Self-reported comfort with volatility, 1 (low) to 5 (high). */
  riskTolerance: 1 | 2 | 3 | 4 | 5;
  /** Monthly amount added to the portfolio, in base currency. */
  monthlyContribution: number;
  /** Months of essential spending held outside the portfolio. */
  emergencyFundMonths: number;
  /** Essential monthly spending, used to size the emergency-fund check. */
  monthlyEssentialSpend: number;
  /** Annual income the portfolio is expected to pay out now, as a decimal of value. */
  incomeNeedRate: number;
  taxWrapper: TaxWrapper;
  /** Extra domestic weight the investor deliberately wants, in percentage points. */
  homeBiasAllowancePp: number;
  /**
   * How much the investor wants the defensive sleeve to defend against
   * inflation rather than only against equity drawdowns. 0 low, 1 moderate,
   * 2 high. Drives the inflation-linked and commodity allocations.
   */
  inflationConcern: 0 | 1 | 2;
}

/** The transparent, user-editable comparison model. Never presented as advice. */
export interface ReferenceModel {
  id: string;
  label: string;
  /** Which published index the equity side is modelled on. */
  presetId: string;
  presetLabel: string;
  /** What choosing this index means for the gaps the report can and cannot find. */
  indexNote: string;
  /** Named risk band the derived allocation falls into, e.g. "Balanced". */
  riskProfileLabel: string;
  /** Which of the three constraints actually set the growth share. */
  bindingConstraint: "tolerance" | "capacity" | "horizon";
  /** Long-run historical real return of this mix, annualised. An assumption. */
  expectedRealReturn: number;
  /** Annualised volatility of this mix. An assumption. */
  expectedVolatility: number;
  /** Plain-English account of how every number below was derived. */
  rationale: string[];
  assetClass: Record<AssetClass, number>;
  region: Record<Region, number>;
  sector: Record<Sector, number>;
  size: Record<SizeBucket, number>;
  credit: Record<CreditBucket, number>;
  targetDuration: number;
  /** Ongoing charge a comparable low-cost index portfolio would carry. */
  costBenchmark: number;
  /** Derived inputs echoed back so the user can see what drove the model. */
  inputs: {
    growthShare: number;
    riskCapacityScore: number;
    homeRegion: Region;
    homeBiasAllowancePp: number;
  };
}

export type FindingCategory =
  | "allocation"
  | "concentration"
  | "overlap"
  | "cost"
  | "factor"
  | "income"
  | "horizon"
  | "currency"
  | "quality"
  | "liquidity"
  | "structure";

export type FindingDirection = "under" | "over" | "neutral";

export interface Evidence {
  label: string;
  /** Pre-formatted for display; the engine owns the formatting decision. */
  value: string;
  detail?: string;
}

export interface CandidateScreen {
  /** Human-readable description of the filter that produced the candidates. */
  description: string;
  symbols: string[];
}

export interface ImplementationIdea {
  objective: string;
  /** Size of the gap in base currency, if it can be expressed that way. */
  gapValue: number | null;
  /** Ordered routes to close the gap, cheapest-friction first. */
  routes: { label: string; detail: string }[];
  screen: CandidateScreen | null;
  tradeoffs: string[];
}

export interface Finding {
  id: string;
  category: FindingCategory;
  direction: FindingDirection;
  /** 0-100 materiality. Ranking only; not a measure of urgency or risk. */
  severity: number;
  title: string;
  summary: string;
  /** The educational "why this matters" body. */
  why: string;
  evidence: Evidence[];
  learnSlug?: string;
  implementation?: ImplementationIdea;
}

export interface DiversificationStats {
  positionCount: number;
  lookThroughNameCount: number;
  topHoldingWeight: number;
  topTenWeight: number;
  /** Herfindahl-Hirschman index over look-through single-name weights. */
  herfindahl: number;
  /** 1 / HHI: the number of equally sized positions this is equivalent to. */
  effectiveNames: number;
}

export interface PortfolioMetrics {
  exposure: ExposureProfile;
  diversification: DiversificationStats;
  lookThrough: { symbol: string; name: string; weight: number; value: number }[];
  weightedExpenseRatio: number;
  annualCost: number;
  estimatedVolatility: number;
  weightedBeta: number;
  /** Value-weighted fundamentals across the directly held stock sleeve only. */
  stockSleeve: {
    weight: number;
    returnOnInvestedCapital: number;
    netDebtToEbitda: number;
    freeCashFlowYield: number;
    priceEarnings: number;
  } | null;
}

export interface AnalysisReport {
  generatedAt: string;
  portfolio: Portfolio;
  profile: InvestorProfile;
  reference: ReferenceModel;
  metrics: PortfolioMetrics;
  findings: Finding[];
  /** An illustration of the reference mix's historical range. Never a forecast. */
  projection: import("./projection").Projection;
  /** Coverage caveats the reader needs in order to judge the findings. */
  caveats: string[];
}
