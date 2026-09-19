import type {
  Currency,
  Fundamentals,
  Region,
  Sector,
  SizeBucket,
  StockSecurity,
  StyleBucket,
  Valuation,
} from "@/lib/engine/types";
import { deriveFactorTilts } from "@/lib/engine/factors";
import { trailingFor } from "./trailing";

/**
 * Fundamentals column order.
 * 0 revenue (USD bn)      1 revenue CAGR 3y     2 EPS CAGR 3y        3 gross margin
 * 4 operating margin      5 net margin          6 FCF margin         7 ROIC
 * 8 ROE                   9 net debt / EBITDA  10 interest cover    11 current ratio
 * 12 share count CAGR 5y (+ = dilution)        13 dividend yield    14 payout ratio
 * 15 consecutive years of dividend growth
 */
type F = [
  number, number, number, number, number, number, number, number,
  number, number, number, number, number, number, number, number,
];

/**
 * Valuation column order.
 * 0 P/E   1 forward P/E   2 EV/EBIT   3 P/S   4 P/B   5 free cash flow yield
 */
type V = [number, number, number, number, number, number];

interface StockRow {
  s: string;
  name: string;
  sector: Sector;
  industry: string;
  region: Region;
  price: number;
  /** Market capitalisation in USD billions. */
  mcap: number;
  vol: number;
  beta: number;
  f: F;
  v: V;
  about: string;
  currency?: Currency;
  country?: string;
}

function sizeFor(marketCapUsd: number): SizeBucket {
  if (marketCapUsd >= 3e10) return "large";
  if (marketCapUsd >= 5e9) return "mid";
  return "small";
}

/**
 * Style is derived rather than stored so it cannot drift out of step with the
 * valuation and growth figures it is supposed to summarise.
 */
function styleFor(v: Valuation, f: Fundamentals): StyleBucket {
  const cheap = (v.priceEarnings > 0 && v.priceEarnings < 18 ? 1 : 0) + (v.priceToBook < 3 ? 1 : 0) + (v.freeCashFlowYield > 0.05 ? 1 : 0);
  const fast = (f.revenueCagr3y > 0.12 ? 1 : 0) + (f.epsCagr3y > 0.15 ? 1 : 0) + (v.forwardPriceEarnings > 28 ? 1 : 0);
  if (cheap - fast >= 2) return "value";
  if (fast - cheap >= 2) return "growth";
  return "blend";
}

function toFundamentals(f: F): Fundamentals {
  return {
    revenueUsd: f[0] * 1e9,
    revenueCagr3y: f[1],
    epsCagr3y: f[2],
    grossMargin: f[3],
    operatingMargin: f[4],
    netMargin: f[5],
    freeCashFlowMargin: f[6],
    returnOnInvestedCapital: f[7],
    returnOnEquity: f[8],
    netDebtToEbitda: f[9],
    interestCover: f[10],
    currentRatio: f[11],
    shareCountCagr5y: f[12],
    dividendYield: f[13],
    payoutRatio: f[14],
    dividendGrowthStreakYears: f[15],
  };
}

function toValuation(v: V): Valuation {
  return {
    priceEarnings: v[0],
    forwardPriceEarnings: v[1],
    evToEbit: v[2],
    priceToSales: v[3],
    priceToBook: v[4],
    freeCashFlowYield: v[5],
  };
}

function stock(row: StockRow): StockSecurity {
  const fundamentals = toFundamentals(row.f);
  const valuation = toValuation(row.v);
  const marketCapUsd = row.mcap * 1e9;
  const trailing = trailingFor(row.s);
  return {
    kind: "stock",
    symbol: row.s,
    name: row.name,
    currency: row.currency ?? "USD",
    listingCountry: row.country ?? "US",
    price: row.price,
    volatility3y: row.vol,
    beta: row.beta,
    trailing,
    sector: row.sector,
    industry: row.industry,
    region: row.region,
    size: sizeFor(marketCapUsd),
    style: styleFor(valuation, fundamentals),
    marketCapUsd,
    fundamentals,
    valuation,
    factorTilts: deriveFactorTilts({ marketCapUsd, valuation, fundamentals, volatility3y: row.vol, trailing }),
    description: row.about,
  };
}

const ROWS: StockRow[] = [
  { s: "AAPL", name: "Apple", sector: "informationTechnology", industry: "Consumer Electronics", region: "us", price: 228.4, mcap: 3450, vol: 0.246, beta: 1.19,
    f: [391, 0.02, 0.06, 0.464, 0.315, 0.239, 0.238, 0.58, 1.57, 0.35, 45, 0.87, -0.026, 0.0044, 0.16, 12],
    v: [36.8, 33.1, 28.4, 8.8, 57.2, 0.031],
    about: "iPhone, Mac and a fast-growing services arm. Enormous returns on capital, and a valuation that already assumes they continue." },
  { s: "MSFT", name: "Microsoft", sector: "informationTechnology", industry: "Software - Infrastructure", region: "us", price: 428.1, mcap: 3180, vol: 0.229, beta: 1.08,
    f: [245, 0.15, 0.19, 0.697, 0.446, 0.359, 0.235, 0.29, 0.353, 0.28, 52, 1.27, -0.003, 0.0074, 0.26, 20],
    v: [34.2, 30.6, 25.1, 12.9, 10.8, 0.026],
    about: "Cloud, enterprise software and a large AI infrastructure build-out. Capital spending has risen sharply, which is pressuring free cash flow." },
  { s: "NVDA", name: "NVIDIA", sector: "informationTechnology", industry: "Semiconductors", region: "us", price: 132.6, mcap: 3260, vol: 0.492, beta: 1.68,
    f: [130, 0.68, 1.12, 0.751, 0.622, 0.553, 0.472, 0.85, 0.915, -0.6, 120, 4.1, 0.004, 0.0003, 0.01, 1],
    v: [52.4, 34.8, 44.2, 25.1, 47.6, 0.021],
    about: "Designs the accelerators most large AI models are trained on. Growth and margins are extraordinary; so is the share of revenue from a few customers." },
  { s: "AMZN", name: "Amazon", sector: "consumerDiscretionary", industry: "Internet Retail", region: "us", price: 201.3, mcap: 2110, vol: 0.301, beta: 1.15,
    f: [638, 0.11, 0.62, 0.483, 0.108, 0.092, 0.055, 0.135, 0.209, 0.35, 28, 1.09, 0.004, 0, 0, 0],
    v: [36.1, 29.4, 31.8, 3.3, 7.6, 0.017],
    about: "Retail at thin margins plus AWS, which produces most of the profit. Two very different businesses inside one ticker." },
  { s: "GOOGL", name: "Alphabet", sector: "communicationServices", industry: "Interactive Media", region: "us", price: 176.8, mcap: 2160, vol: 0.281, beta: 1.04,
    f: [350, 0.12, 0.31, 0.582, 0.321, 0.281, 0.196, 0.31, 0.317, -0.45, 210, 1.84, -0.019, 0.0045, 0.09, 1],
    v: [22.4, 19.8, 17.9, 6.2, 6.9, 0.039],
    about: "Search advertising funds YouTube, Android and a cloud unit that has only recently turned profitable. Faces live antitrust remedies." },
  { s: "META", name: "Meta Platforms", sector: "communicationServices", industry: "Interactive Media", region: "us", price: 582.4, mcap: 1470, vol: 0.362, beta: 1.21,
    f: [164, 0.18, 0.54, 0.816, 0.418, 0.356, 0.302, 0.285, 0.362, -0.2, 95, 2.72, -0.021, 0.0035, 0.08, 1],
    v: [26.1, 23.4, 19.6, 8.9, 8.4, 0.043],
    about: "Facebook, Instagram and WhatsApp advertising, with a large loss-making reality-labs division attached." },
  { s: "AVGO", name: "Broadcom", sector: "informationTechnology", industry: "Semiconductors", region: "us", price: 168.9, mcap: 789, vol: 0.371, beta: 1.14,
    f: [51.6, 0.28, 0.14, 0.632, 0.312, 0.116, 0.401, 0.196, 0.152, 2.6, 6.8, 1.12, 0.062, 0.0126, 0.46, 14],
    v: [98.4, 32.1, 36.2, 15.3, 12.4, 0.021],
    about: "Networking silicon and infrastructure software, assembled through large debt-funded acquisitions. Reported earnings are heavily distorted by amortisation." },
  { s: "TSLA", name: "Tesla", sector: "consumerDiscretionary", industry: "Auto Manufacturers", region: "us", price: 352.6, mcap: 1130, vol: 0.571, beta: 2.04,
    f: [97.7, 0.08, -0.22, 0.178, 0.073, 0.073, 0.036, 0.089, 0.108, -0.9, 62, 1.84, 0.008, 0, 0, 0],
    v: [158.2, 112.4, 121.6, 11.6, 17.2, 0.004],
    about: "Electric vehicles with software and energy-storage ambitions. Priced far above other manufacturers on every earnings measure." },
  { s: "BRK.B", name: "Berkshire Hathaway", sector: "financials", industry: "Insurance - Diversified", region: "us", price: 456.2, mcap: 984, vol: 0.148, beta: 0.86,
    f: [371, 0.06, 0.09, 0.28, 0.192, 0.242, 0.081, 0.092, 0.121, -1.8, 38, 1.42, -0.012, 0, 0, 0],
    v: [14.8, 22.1, 15.4, 2.7, 1.62, 0.038],
    about: "Insurance float invested across wholly owned businesses and a large listed portfolio. Holds an unusually big cash and T-bill balance." },
  { s: "LLY", name: "Eli Lilly", sector: "healthCare", industry: "Drug Manufacturers", region: "us", price: 786.4, mcap: 746, vol: 0.316, beta: 0.41,
    f: [45.0, 0.21, 0.34, 0.812, 0.294, 0.234, 0.098, 0.216, 0.594, 1.4, 18, 1.18, 0.001, 0.0067, 0.51, 10],
    v: [72.8, 38.4, 54.1, 16.6, 52.4, 0.009],
    about: "Incretin drugs for diabetes and obesity have transformed the growth profile, and the valuation now reflects a lot of that future." },
  { s: "JPM", name: "JPMorgan Chase", sector: "financials", industry: "Banks - Diversified", region: "us", price: 241.8, mcap: 681, vol: 0.212, beta: 1.09,
    f: [177, 0.14, 0.17, 0.62, 0.42, 0.335, 0.21, 0.13, 0.171, 0, 0, 1.0, -0.011, 0.0206, 0.27, 14],
    v: [13.4, 14.6, 11.2, 3.8, 2.14, 0.062],
    about: "The largest US bank by assets, with leading positions in investment banking, cards and asset management." },
  { s: "V", name: "Visa", sector: "financials", industry: "Credit Services", region: "us", price: 312.7, mcap: 604, vol: 0.192, beta: 0.95,
    f: [35.9, 0.11, 0.14, 0.802, 0.668, 0.545, 0.541, 0.298, 0.512, 0.1, 78, 1.42, -0.018, 0.0074, 0.22, 16],
    v: [31.2, 27.8, 23.4, 16.8, 15.1, 0.031],
    about: "A payment network, not a lender: it earns a toll on transaction volume and carries almost no credit risk." },
  { s: "UNH", name: "UnitedHealth", sector: "healthCare", industry: "Healthcare Plans", region: "us", price: 512.3, mcap: 471, vol: 0.224, beta: 0.56,
    f: [400, 0.1, 0.11, 0.236, 0.081, 0.056, 0.061, 0.144, 0.248, 1.1, 14, 0.82, -0.008, 0.0164, 0.34, 15],
    v: [21.4, 17.2, 15.8, 1.18, 4.9, 0.052],
    about: "Health insurance plus Optum, a large care-delivery and pharmacy-benefits arm. Earnings track medical cost trends closely." },
  { s: "XOM", name: "Exxon Mobil", sector: "energy", industry: "Oil & Gas Integrated", region: "us", price: 118.4, mcap: 521, vol: 0.229, beta: 0.84,
    f: [344, -0.04, -0.28, 0.241, 0.121, 0.099, 0.081, 0.114, 0.138, 0.3, 42, 1.31, 0.052, 0.0332, 0.48, 42],
    v: [14.2, 13.8, 10.4, 1.51, 1.94, 0.072],
    about: "Integrated oil and gas with refining and chemicals. Earnings follow the commodity cycle; the dividend record spans four decades." },
  { s: "JNJ", name: "Johnson & Johnson", sector: "healthCare", industry: "Drug Manufacturers", region: "us", price: 152.1, mcap: 366, vol: 0.148, beta: 0.51,
    f: [88.8, 0.05, 0.04, 0.688, 0.264, 0.196, 0.216, 0.168, 0.234, 0.6, 32, 1.12, -0.004, 0.0326, 0.51, 62],
    v: [16.4, 14.1, 12.8, 4.1, 5.4, 0.062],
    about: "Pharmaceuticals and medical devices after the consumer spin-off. Long dividend record; ongoing talc litigation is the main overhang." },
  { s: "PG", name: "Procter & Gamble", sector: "consumerStaples", industry: "Household Products", region: "us", price: 168.9, mcap: 398, vol: 0.142, beta: 0.42,
    f: [84.0, 0.03, 0.07, 0.512, 0.241, 0.184, 0.178, 0.164, 0.312, 1.1, 38, 0.74, -0.008, 0.0241, 0.61, 68],
    v: [26.1, 24.2, 20.4, 4.7, 8.1, 0.041],
    about: "Household and personal-care brands sold worldwide. Growth is low and steady; the appeal is the reliability, not the rate." },
  { s: "HD", name: "Home Depot", sector: "consumerDiscretionary", industry: "Home Improvement Retail", region: "us", price: 412.6, mcap: 410, vol: 0.204, beta: 1.02,
    f: [155, 0.01, -0.02, 0.336, 0.138, 0.096, 0.101, 0.312, 2.84, 2.2, 13, 1.35, -0.012, 0.0221, 0.58, 15],
    v: [26.8, 25.1, 19.6, 2.64, 68.4, 0.038],
    about: "Home-improvement retail, tied to housing turnover and repair spending. Heavy buybacks have pushed book equity close to zero." },
  { s: "MA", name: "Mastercard", sector: "financials", industry: "Credit Services", region: "us", price: 528.4, mcap: 487, vol: 0.198, beta: 1.05,
    f: [28.2, 0.12, 0.16, 0.762, 0.582, 0.452, 0.441, 0.416, 1.84, 0.4, 42, 1.14, -0.016, 0.0052, 0.2, 13],
    v: [38.4, 33.2, 28.6, 17.3, 62.1, 0.026],
    about: "The other global payment network. Same toll-booth economics as Visa, with a slightly faster cross-border mix." },
  { s: "COST", name: "Costco", sector: "consumerStaples", industry: "Discount Stores", region: "us", price: 918.2, mcap: 407, vol: 0.196, beta: 0.79,
    f: [254, 0.08, 0.13, 0.126, 0.037, 0.028, 0.031, 0.214, 0.312, -0.4, 68, 1.07, 0.002, 0.0051, 0.28, 20],
    v: [54.2, 49.8, 42.1, 1.62, 17.4, 0.019],
    about: "Membership warehouse retail where the subscription fee is most of the profit. Rarely cheap on any earnings measure." },
  { s: "KO", name: "Coca-Cola", sector: "consumerStaples", industry: "Beverages", region: "us", price: 62.4, mcap: 269, vol: 0.146, beta: 0.58,
    f: [46.5, 0.06, 0.08, 0.604, 0.298, 0.232, 0.212, 0.178, 0.412, 2.1, 16, 1.13, 0.001, 0.0308, 0.72, 62],
    v: [24.6, 21.8, 19.2, 5.8, 10.2, 0.041],
    about: "Concentrate sales to a bottling network, which keeps capital intensity low. One of the longest dividend-growth records anywhere." },
  { s: "PEP", name: "PepsiCo", sector: "consumerStaples", industry: "Beverages", region: "us", price: 152.8, mcap: 210, vol: 0.148, beta: 0.52,
    f: [92.2, 0.05, 0.04, 0.548, 0.142, 0.098, 0.091, 0.142, 0.482, 2.6, 12, 0.86, 0.001, 0.0354, 0.76, 52],
    v: [22.1, 17.4, 16.8, 2.28, 10.4, 0.048],
    about: "Drinks plus a snacks business that is the more profitable half. Payout ratio leaves less room for dividend growth than it used to." },
  { s: "MRK", name: "Merck", sector: "healthCare", industry: "Drug Manufacturers", region: "us", price: 98.6, mcap: 249, vol: 0.192, beta: 0.44,
    f: [64.2, 0.08, 0.31, 0.762, 0.318, 0.264, 0.238, 0.212, 0.418, 0.7, 24, 1.36, 0.001, 0.0328, 0.42, 14],
    v: [12.8, 11.4, 9.8, 3.88, 5.2, 0.081],
    about: "Oncology-led pharma with a large share of revenue from one drug facing loss of exclusivity later this decade." },
  { s: "ABBV", name: "AbbVie", sector: "healthCare", industry: "Drug Manufacturers", region: "us", price: 176.4, mcap: 312, vol: 0.184, beta: 0.58,
    f: [56.3, 0.02, -0.08, 0.702, 0.302, 0.072, 0.394, 0.148, 0.842, 3.1, 8.4, 0.68, 0.002, 0.0371, 0.82, 12],
    v: [58.4, 15.2, 16.4, 5.54, 24.6, 0.079],
    about: "Immunology and aesthetics drugs after the Humira patent cliff. Carries meaningful leverage from the Allergan acquisition." },
  { s: "WMT", name: "Walmart", sector: "consumerStaples", industry: "Discount Stores", region: "us", price: 91.2, mcap: 733, vol: 0.184, beta: 0.51,
    f: [673, 0.06, 0.12, 0.246, 0.044, 0.026, 0.023, 0.142, 0.221, 1.4, 12, 0.82, -0.002, 0.0091, 0.34, 51],
    v: [38.4, 34.2, 26.8, 1.09, 8.4, 0.021],
    about: "Grocery-led retail with a growing advertising and marketplace business that carries much higher margins than the stores." },
  { s: "CVX", name: "Chevron", sector: "energy", industry: "Oil & Gas Integrated", region: "us", price: 158.4, mcap: 289, vol: 0.238, beta: 0.92,
    f: [196, -0.06, -0.31, 0.298, 0.108, 0.088, 0.072, 0.098, 0.121, 0.4, 36, 1.18, 0.038, 0.0412, 0.58, 37],
    v: [16.2, 13.4, 11.8, 1.47, 1.68, 0.066],
    about: "Integrated oil with a strong balance sheet and a Permian-weighted portfolio. Dividend has risen for more than three decades." },
  { s: "CRM", name: "Salesforce", sector: "informationTechnology", industry: "Software - Application", region: "us", price: 328.4, mcap: 314, vol: 0.298, beta: 1.31,
    f: [37.9, 0.11, 0.42, 0.768, 0.192, 0.162, 0.301, 0.092, 0.104, 0.1, 22, 1.06, 0.004, 0.0049, 0.14, 1],
    v: [46.2, 28.4, 34.6, 8.28, 5.1, 0.036],
    about: "Enterprise CRM software. Margin expansion, not revenue growth, has driven recent earnings gains." },
  { s: "AMD", name: "Advanced Micro Devices", sector: "informationTechnology", industry: "Semiconductors", region: "us", price: 138.6, mcap: 224, vol: 0.446, beta: 1.72,
    f: [25.8, 0.09, 0.28, 0.512, 0.078, 0.062, 0.102, 0.058, 0.041, -0.4, 38, 2.62, 0.012, 0, 0, 0],
    v: [112.4, 32.6, 78.4, 8.68, 3.9, 0.012],
    about: "CPUs and AI accelerators. The second source in a market NVIDIA dominates, priced for a large share gain." },
  { s: "NFLX", name: "Netflix", sector: "communicationServices", industry: "Entertainment", region: "us", price: 842.6, mcap: 361, vol: 0.334, beta: 1.28,
    f: [39.0, 0.13, 0.62, 0.462, 0.267, 0.221, 0.172, 0.204, 0.348, 1.2, 16, 1.22, -0.014, 0, 0, 0],
    v: [42.1, 34.8, 33.2, 9.26, 15.4, 0.021],
    about: "Streaming at global scale, now generating real free cash flow with advertising and password-sharing enforcement added." },
  { s: "ORCL", name: "Oracle", sector: "informationTechnology", industry: "Software - Infrastructure", region: "us", price: 172.4, mcap: 481, vol: 0.312, beta: 1.14,
    f: [53.8, 0.09, 0.12, 0.712, 0.312, 0.202, 0.098, 0.142, 1.24, 3.4, 5.2, 0.72, -0.012, 0.0093, 0.34, 11],
    v: [42.6, 28.4, 31.2, 8.94, 84.2, 0.022],
    about: "Databases and applications, with a capital-hungry push into AI cloud capacity. Leverage is high and equity is small after years of buybacks." },
  { s: "TXN", name: "Texas Instruments", sector: "informationTechnology", industry: "Semiconductors", region: "us", price: 196.4, mcap: 179, vol: 0.246, beta: 1.02,
    f: [15.6, -0.08, -0.24, 0.582, 0.346, 0.301, 0.062, 0.184, 0.324, 1.2, 18, 4.12, -0.004, 0.0281, 0.79, 21],
    v: [38.2, 32.4, 29.8, 11.5, 10.8, 0.014],
    about: "Analogue and embedded chips for industrial and automotive customers. Currently spending heavily on new fabs, which is depressing free cash flow." },
  { s: "CAT", name: "Caterpillar", sector: "industrials", industry: "Farm & Heavy Machinery", region: "us", price: 384.2, mcap: 185, vol: 0.254, beta: 1.12,
    f: [64.8, 0.04, 0.18, 0.336, 0.204, 0.162, 0.122, 0.192, 0.582, 1.6, 22, 1.38, -0.021, 0.0148, 0.26, 31],
    v: [17.2, 18.4, 13.6, 2.86, 9.6, 0.048],
    about: "Construction and mining equipment, plus a captive finance arm. Deeply cyclical, tied to infrastructure and resource capex." },
  { s: "HON", name: "Honeywell", sector: "industrials", industry: "Conglomerates", region: "us", price: 224.6, mcap: 146, vol: 0.192, beta: 0.98,
    f: [38.5, 0.05, 0.08, 0.382, 0.208, 0.152, 0.132, 0.142, 0.312, 2.1, 14, 1.32, -0.008, 0.0196, 0.46, 14],
    v: [24.8, 21.2, 19.4, 3.79, 8.4, 0.042],
    about: "Aerospace, building automation and industrial software. Aerospace aftermarket is the highest-quality part of the mix." },
  { s: "LIN", name: "Linde", sector: "materials", industry: "Specialty Chemicals", region: "us", price: 442.8, mcap: 211, vol: 0.176, beta: 0.86,
    f: [33.0, 0.01, 0.09, 0.472, 0.276, 0.196, 0.158, 0.128, 0.162, 1.5, 28, 0.92, -0.016, 0.0132, 0.41, 31],
    v: [32.4, 28.6, 24.8, 6.39, 5.8, 0.036],
    about: "Industrial gases sold on long-term contracts with pass-through pricing. Unusually stable for a materials company." },
  { s: "NEE", name: "NextEra Energy", sector: "utilities", industry: "Utilities - Regulated", region: "us", price: 72.4, mcap: 149, vol: 0.246, beta: 0.62,
    f: [24.8, 0.02, 0.11, 0.612, 0.284, 0.282, -0.18, 0.062, 0.124, 5.2, 4.1, 0.58, 0.021, 0.0294, 0.62, 29],
    v: [21.6, 20.4, 26.8, 6.01, 3.1, -0.052],
    about: "A regulated Florida utility plus the largest US renewables developer. Growth is funded with debt and equity issuance, so rates matter a lot." },
  { s: "DUK", name: "Duke Energy", sector: "utilities", industry: "Utilities - Regulated", region: "us", price: 114.2, mcap: 88, vol: 0.184, beta: 0.48,
    f: [30.2, 0.04, 0.05, 0.442, 0.242, 0.152, -0.09, 0.048, 0.088, 6.1, 3.2, 0.71, 0.018, 0.0368, 0.68, 19],
    v: [19.4, 17.8, 21.4, 2.91, 1.72, -0.031],
    about: "Regulated electricity and gas across the US south-east. Predictable, capital-hungry and sensitive to allowed returns." },
  { s: "VZ", name: "Verizon", sector: "communicationServices", industry: "Telecom Services", region: "us", price: 41.8, mcap: 176, vol: 0.182, beta: 0.41,
    f: [134, 0.0, -0.02, 0.598, 0.222, 0.128, 0.136, 0.062, 0.191, 3.1, 6.8, 0.64, 0.002, 0.0648, 0.61, 18],
    v: [10.4, 8.9, 11.2, 1.31, 1.78, 0.104],
    about: "US wireless and broadband. High yield backed by steady cash flow, but the debt load leaves little room for growth." },
  { s: "PFE", name: "Pfizer", sector: "healthCare", industry: "Drug Manufacturers", region: "us", price: 25.6, mcap: 145, vol: 0.224, beta: 0.62,
    f: [62.5, -0.18, -0.62, 0.652, 0.182, 0.128, 0.098, 0.052, 0.081, 3.4, 5.1, 1.24, 0.008, 0.0656, 0.94, 14],
    v: [18.2, 9.8, 14.6, 2.32, 1.62, 0.042],
    about: "Post-COVID revenue reset with a debt-funded oncology acquisition to replace it. Payout ratio leaves the dividend with little cover." },
  { s: "MCD", name: "McDonald's", sector: "consumerDiscretionary", industry: "Restaurants", region: "us", price: 292.4, mcap: 209, vol: 0.162, beta: 0.68,
    f: [25.9, 0.04, 0.09, 0.568, 0.452, 0.322, 0.288, 0.212, -1.42, 3.2, 8.2, 1.14, -0.008, 0.0238, 0.58, 48],
    v: [25.4, 23.1, 19.8, 8.07, -42.1, 0.039],
    about: "Mostly a franchisor and property owner rather than a restaurant operator. Buybacks have driven book equity negative." },
  { s: "NKE", name: "Nike", sector: "consumerDiscretionary", industry: "Footwear & Accessories", region: "us", price: 76.4, mcap: 114, vol: 0.278, beta: 1.04,
    f: [51.4, 0.01, -0.12, 0.442, 0.112, 0.098, 0.086, 0.142, 0.348, 0.2, 32, 2.21, -0.014, 0.0206, 0.44, 22],
    v: [22.8, 26.4, 18.2, 2.22, 7.4, 0.044],
    about: "Athletic footwear and apparel working through a direct-to-consumer reset and weak China demand." },
  { s: "GS", name: "Goldman Sachs", sector: "financials", industry: "Capital Markets", region: "us", price: 562.4, mcap: 176, vol: 0.252, beta: 1.24,
    f: [53.5, 0.12, 0.42, 0.68, 0.34, 0.262, 0.18, 0.082, 0.124, 0, 0, 1.0, -0.022, 0.0212, 0.24, 12],
    v: [15.8, 13.4, 12.1, 3.29, 1.82, 0.058],
    about: "Investment banking and trading, with a slower-growing asset and wealth management arm. Earnings swing with market activity." },
  { s: "BAC", name: "Bank of America", sector: "financials", industry: "Banks - Diversified", region: "us", price: 46.2, mcap: 354, vol: 0.246, beta: 1.18,
    f: [101, 0.06, 0.04, 0.58, 0.32, 0.248, 0.19, 0.086, 0.094, 0, 0, 1.0, -0.018, 0.0225, 0.31, 10],
    v: [14.2, 12.1, 11.4, 3.51, 1.24, 0.061],
    about: "Large US consumer bank with rate-sensitive net interest income and a sizeable unrealised loss in its securities book." },
  { s: "AXP", name: "American Express", sector: "financials", industry: "Credit Services", region: "us", price: 296.8, mcap: 209, vol: 0.242, beta: 1.19,
    f: [65.9, 0.14, 0.21, 0.58, 0.212, 0.164, 0.142, 0.118, 0.342, 0, 0, 1.0, -0.021, 0.0096, 0.2, 3],
    v: [21.4, 19.2, 17.6, 3.17, 7.1, 0.048],
    about: "A card network that also lends, with revenue skewed to affluent spenders and annual fees." },
  { s: "UPS", name: "United Parcel Service", sector: "industrials", industry: "Integrated Freight", region: "us", price: 128.4, mcap: 109, vol: 0.246, beta: 1.02,
    f: [91.1, -0.02, -0.28, 0.212, 0.092, 0.068, 0.062, 0.102, 0.302, 1.8, 12, 1.14, -0.002, 0.0512, 0.86, 15],
    v: [18.4, 15.2, 14.8, 1.2, 5.2, 0.052],
    about: "Parcel delivery with high fixed costs and a unionised US workforce. Dividend cover is thin at current earnings." },
  { s: "SBUX", name: "Starbucks", sector: "consumerDiscretionary", industry: "Restaurants", region: "us", price: 98.2, mcap: 111, vol: 0.252, beta: 0.98,
    f: [36.2, 0.05, 0.02, 0.272, 0.148, 0.108, 0.092, 0.182, -0.62, 3.4, 9.1, 0.75, -0.012, 0.0248, 0.72, 14],
    v: [29.4, 27.6, 22.4, 3.07, -18.4, 0.036],
    about: "Global coffee retail, mid-turnaround in the US and China. Leverage and negative book equity are legacies of past buybacks." },
  { s: "LOW", name: "Lowe's", sector: "consumerDiscretionary", industry: "Home Improvement Retail", region: "us", price: 262.4, mcap: 148, vol: 0.224, beta: 1.08,
    f: [83.7, -0.04, -0.06, 0.332, 0.124, 0.084, 0.086, 0.242, -1.84, 3.1, 9.4, 1.18, -0.038, 0.0176, 0.42, 62],
    v: [21.2, 19.8, 16.4, 1.77, -14.2, 0.049],
    about: "The number-two home-improvement retailer, more weighted to DIY customers than to trade professionals." },
  { s: "T", name: "AT&T", sector: "communicationServices", industry: "Telecom Services", region: "us", price: 22.8, mcap: 163, vol: 0.198, beta: 0.62,
    f: [122, -0.01, 0.06, 0.588, 0.198, 0.084, 0.142, 0.054, 0.102, 3.0, 5.4, 0.71, 0.004, 0.0488, 0.54, 1],
    v: [11.8, 9.4, 12.4, 1.34, 1.32, 0.106],
    about: "US wireless and fibre after divesting media. The dividend was rebased in 2022; the debt load is still the central question." },

  // ------------------------------------------------------------- non-US names
  { s: "ASML", name: "ASML Holding", sector: "informationTechnology", industry: "Semiconductor Equipment", region: "europeExUk", currency: "EUR", country: "NL", price: 682.4, mcap: 268, vol: 0.334, beta: 1.32,
    f: [29.8, 0.08, 0.04, 0.512, 0.312, 0.262, 0.221, 0.284, 0.412, -0.4, 84, 1.42, -0.014, 0.0102, 0.32, 8],
    v: [38.4, 29.6, 30.2, 8.99, 16.2, 0.024],
    about: "The only supplier of extreme-ultraviolet lithography machines. A genuine monopoly, exposed to export controls and the chip cycle." },
  { s: "NESN", name: "Nestle", sector: "consumerStaples", industry: "Packaged Foods", region: "europeExUk", currency: "CHF", country: "CH", price: 78.4, mcap: 218, vol: 0.158, beta: 0.52,
    f: [103, 0.02, 0.01, 0.472, 0.172, 0.114, 0.098, 0.124, 0.242, 2.8, 14, 0.82, -0.012, 0.0382, 0.71, 29],
    v: [18.4, 16.8, 15.2, 2.12, 5.4, 0.054],
    about: "The world's largest food company. Slow organic growth, wide geographic reach and a long payout record." },
  { s: "NOVO", name: "Novo Nordisk", sector: "healthCare", industry: "Drug Manufacturers", region: "europeExUk", currency: "EUR", country: "DK", price: 104.2, mcap: 328, vol: 0.318, beta: 0.48,
    f: [42.1, 0.28, 0.31, 0.842, 0.442, 0.352, 0.302, 0.482, 0.842, 0.2, 68, 1.12, -0.006, 0.0142, 0.46, 28],
    v: [26.4, 21.2, 19.8, 7.79, 21.4, 0.038],
    about: "Diabetes and obesity treatments. The other half of the incretin duopoly with Lilly, and similarly dependent on it." },
  { s: "SAP", name: "SAP", sector: "informationTechnology", industry: "Software - Application", region: "europeExUk", currency: "EUR", country: "DE", price: 218.6, mcap: 268, vol: 0.264, beta: 1.08,
    f: [36.8, 0.07, 0.18, 0.732, 0.242, 0.162, 0.182, 0.098, 0.121, -0.2, 42, 1.04, -0.008, 0.0102, 0.42, 12],
    v: [42.8, 34.2, 32.4, 7.28, 5.2, 0.028],
    about: "European enterprise software, mid-migration from licence sales to cloud subscriptions." },
  { s: "AZN", name: "AstraZeneca", sector: "healthCare", industry: "Drug Manufacturers", region: "uk", currency: "GBP", country: "GB", price: 108.4, mcap: 212, vol: 0.212, beta: 0.52,
    f: [52.2, 0.14, 0.22, 0.822, 0.242, 0.142, 0.156, 0.124, 0.212, 1.6, 12, 0.92, 0.004, 0.0224, 0.52, 12],
    v: [32.4, 16.8, 22.4, 4.06, 5.8, 0.042],
    about: "Oncology-led pharma listed in London with most of its revenue outside the UK. A large index weight in UK equity funds." },
  { s: "SHEL", name: "Shell", sector: "energy", industry: "Oil & Gas Integrated", region: "uk", currency: "GBP", country: "GB", price: 27.4, mcap: 208, vol: 0.246, beta: 0.88,
    f: [284, -0.08, -0.34, 0.212, 0.104, 0.068, 0.092, 0.092, 0.108, 0.6, 24, 1.28, -0.042, 0.0402, 0.44, 4],
    v: [11.4, 10.2, 8.9, 0.73, 1.08, 0.096],
    about: "Integrated oil and LNG. Trades at a persistent discount to US peers, which is part of why buybacks are so large." },
  { s: "ULVR", name: "Unilever", sector: "consumerStaples", industry: "Household Products", region: "uk", currency: "GBP", country: "GB", price: 46.8, mcap: 148, vol: 0.162, beta: 0.48,
    f: [64.2, 0.03, 0.05, 0.442, 0.182, 0.124, 0.112, 0.138, 0.294, 2.2, 14, 0.78, -0.014, 0.0328, 0.68, 12],
    v: [21.4, 18.2, 16.8, 2.3, 6.2, 0.052],
    about: "Home, personal care and food brands with heavy emerging-market exposure. Currently splitting off the ice-cream division." },
  { s: "HSBA", name: "HSBC Holdings", sector: "financials", industry: "Banks - Diversified", region: "uk", currency: "GBP", country: "GB", price: 7.42, mcap: 172, vol: 0.224, beta: 0.86,
    f: [66.1, 0.16, 0.24, 0.62, 0.42, 0.312, 0.22, 0.078, 0.132, 0, 0, 1.0, -0.038, 0.0682, 0.42, 3],
    v: [8.4, 8.1, 7.2, 2.6, 1.02, 0.121],
    about: "A UK-listed bank that earns most of its profit in Asia. High yield, large buybacks and geopolitical exposure in equal measure." },
  { s: "TSM", name: "Taiwan Semiconductor", sector: "informationTechnology", industry: "Semiconductors", region: "emergingMarkets", currency: "other", country: "TW", price: 194.6, mcap: 1010, vol: 0.362, beta: 1.24,
    f: [90.1, 0.18, 0.24, 0.562, 0.452, 0.402, 0.212, 0.284, 0.312, -0.6, 92, 2.42, 0.0, 0.0124, 0.38, 4],
    v: [26.4, 20.8, 19.6, 11.2, 7.8, 0.021],
    about: "Manufactures most of the world's advanced logic chips. Concentration risk is geographic as much as financial." },
  { s: "BABA", name: "Alibaba", sector: "consumerDiscretionary", industry: "Internet Retail", region: "emergingMarkets", currency: "other", country: "CN", price: 86.4, mcap: 208, vol: 0.412, beta: 0.68,
    f: [135, 0.07, 0.04, 0.382, 0.142, 0.118, 0.102, 0.078, 0.092, -0.8, 26, 1.82, -0.042, 0.0116, 0.18, 1],
    v: [14.2, 9.8, 11.4, 1.54, 1.42, 0.098],
    about: "Chinese e-commerce and cloud. Cheap on earnings, with regulatory and listing-structure risks that explain much of the discount." },
  { s: "TCEHY", name: "Tencent", sector: "communicationServices", industry: "Interactive Media", region: "emergingMarkets", currency: "other", country: "CN", price: 52.4, mcap: 468, vol: 0.362, beta: 0.72,
    f: [92.4, 0.08, 0.32, 0.522, 0.312, 0.284, 0.242, 0.142, 0.184, -0.3, 34, 1.38, -0.018, 0.0092, 0.16, 6],
    v: [18.4, 16.2, 15.8, 5.06, 3.8, 0.062],
    about: "Games, messaging and fintech in China, plus a large portfolio of stakes in other companies." },
  { s: "005930", name: "Samsung Electronics", sector: "informationTechnology", industry: "Consumer Electronics", region: "emergingMarkets", currency: "other", country: "KR", price: 41.2, mcap: 272, vol: 0.298, beta: 1.02,
    f: [212, 0.04, 0.42, 0.382, 0.142, 0.118, 0.062, 0.084, 0.098, -1.2, 58, 2.64, 0.0, 0.0212, 0.32, 5],
    v: [12.4, 9.8, 8.6, 1.28, 1.14, 0.048],
    about: "Memory chips, foundry, phones and displays. Deeply cyclical, and trades at a persistent conglomerate discount." },
  { s: "NVS", name: "Novartis", sector: "healthCare", industry: "Drug Manufacturers", region: "europeExUk", currency: "CHF", country: "CH", price: 106.8, mcap: 216, vol: 0.172, beta: 0.46,
    f: [50.3, 0.06, 0.18, 0.762, 0.298, 0.242, 0.238, 0.184, 0.312, 0.8, 22, 0.94, -0.024, 0.0342, 0.48, 27],
    v: [17.8, 14.2, 13.6, 4.29, 4.8, 0.058],
    about: "Swiss pharma focused on patented medicines after spinning off its generics arm." },
  { s: "INFY", name: "Infosys", sector: "informationTechnology", industry: "IT Services", region: "emergingMarkets", currency: "other", country: "IN", price: 22.4, mcap: 92, vol: 0.264, beta: 0.82,
    f: [18.9, 0.05, 0.08, 0.302, 0.212, 0.168, 0.162, 0.312, 0.318, -0.9, 68, 2.12, -0.008, 0.0268, 0.62, 8],
    v: [27.4, 24.6, 20.2, 4.87, 8.4, 0.042],
    about: "Indian IT services. High returns on capital and low capital intensity, with growth tied to Western corporate IT budgets." },
  { s: "7203", name: "Toyota Motor", sector: "consumerDiscretionary", industry: "Auto Manufacturers", region: "japan", currency: "JPY", country: "JP", price: 18.6, mcap: 252, vol: 0.246, beta: 0.68,
    f: [312, 0.09, 0.28, 0.202, 0.112, 0.098, 0.028, 0.068, 0.142, 1.1, 26, 1.24, -0.012, 0.0284, 0.24, 6],
    v: [8.4, 9.6, 7.8, 0.81, 1.08, 0.038],
    about: "The largest carmaker by volume, with a hybrid-heavy line-up and a large captive finance arm." },
];

export const STOCKS: StockSecurity[] = ROWS.map(stock);
