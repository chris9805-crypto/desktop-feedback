import { SECURITIES, lookupSecurity } from "@/lib/data/securities";
import { buildExposure } from "./exposure";
import type { Security, StockSecurity } from "./types";

/**
 * Themes as rules, not as baskets.
 *
 * A hand-picked list of "the best AI stocks" is a model portfolio somebody
 * vetted, which is exactly what this tool does not do. Every theme here is a
 * filter over the same universe the screener uses, its criteria are printed
 * next to the results, and anyone can disagree with the rule rather than with
 * a name on a list.
 *
 * Each theme also carries the argument against itself. Thematic funds are
 * reliably most popular after the theme has already run, and concentration is
 * the thing the rest of this tool spends its time measuring — so a page that
 * helps you concentrate had better say so.
 */
export interface Theme {
  id: string;
  label: string;
  /** What the theme actually is, in one line. */
  blurb: string;
  /** The filter, stated so a reader can argue with it. */
  criteria: string;
  /** The honest case against, specific to this theme. */
  caution: string;
  matches: (s: Security) => boolean;
  /** Higher sorts first within the theme. */
  rank: (s: Security) => number;
}

const isStock = (s: Security): s is StockSecurity => s.kind === "stock";
const industryIn = (s: Security, industries: string[]) => isStock(s) && industries.includes(s.industry);
const sectorWeight = (s: Security, sector: string) => (buildExposure(s)[ "sector" ] as Record<string, number>)[sector] ?? 0;

/**
 * Does a fund's disclosed top holdings actually look like the theme?
 *
 * A sector weight alone is too blunt: a cybersecurity fund is 88% information
 * technology, so a "60% tech" rule pulls it into an AI-infrastructure list
 * where it plainly does not belong. Checking the fund's own largest holdings
 * against the same company test the theme applies to stocks keeps the rule
 * short enough to print and specific enough to be right.
 */
const fundLedBy = (s: Security, test: (stock: StockSecurity) => boolean, share = 0.5) => {
  if (s.kind !== "etf" || s.topHoldings.length === 0) return false;
  const hits = s.topHoldings.filter((holding) => {
    const held = lookupSecurity(holding.symbol);
    return held !== undefined && held.kind === "stock" && test(held);
  }).length;
  return hits / s.topHoldings.length >= share;
};

const AI_INDUSTRIES = [
  "Semiconductors",
  "Semiconductor Equipment",
  "Networking",
  "Electrical Equipment",
  "Software - Infrastructure",
  "Computer Hardware",
];

export const THEMES: Theme[] = [
  {
    id: "ai-infrastructure",
    label: "AI infrastructure",
    blurb: "The picks and shovels: the chips, networking, power and platforms an AI build-out runs on.",
    criteria:
      "Companies in semiconductors, semiconductor equipment, networking, data-centre electrical equipment or cloud platforms — plus funds that are at least 60% information technology and whose largest disclosed holdings are mostly those same companies. Ranked by 12-month return.",
    caution:
      "This is one sector, one supply chain and largely one customer group. The same handful of names already sit at the top of any index fund you own, so a sleeve here concentrates what you already hold rather than adding something new.",
    matches: (s) =>
      industryIn(s, AI_INDUSTRIES) ||
      (s.kind === "etf" &&
        sectorWeight(s, "informationTechnology") >= 0.6 &&
        fundLedBy(s, (stock) => AI_INDUSTRIES.includes(stock.industry))),
    rank: (s) => s.trailing.return12m,
  },
  {
    id: "dividend-growers",
    label: "Dividend growers",
    blurb: "Companies that have raised their payout for a decade or more, and can still afford to.",
    criteria:
      "At least 10 consecutive years of dividend growth, a payout ratio below 75%, and a yield above 1.5%. Funds tracking dividend-growth indices are included. Ranked by years of growth.",
    caution:
      "A long record is history, not a promise — dividends get cut, usually right when the economy turns. This screen deliberately excludes the highest yields, because a high yield with a thin payout is the shape of a dividend about to be cut rather than a reliable one.",
    matches: (s) =>
      (isStock(s) &&
        s.fundamentals.dividendGrowthStreakYears >= 10 &&
        s.fundamentals.payoutRatio < 0.75 &&
        s.fundamentals.dividendYield > 0.015) ||
      (s.kind === "etf" && (s.breakdown.factor?.dividendYield ?? 0) >= 0.5),
    rank: (s) => (isStock(s) ? s.fundamentals.dividendGrowthStreakYears : 25),
  },
  {
    id: "cybersecurity",
    label: "Cybersecurity",
    blurb: "Software and services that defend networks, devices and cloud infrastructure.",
    criteria: "Companies classified in the cybersecurity industry, plus funds tracking cybersecurity indices. Ranked by revenue growth.",
    caution:
      "A narrow slice of software. The funds here charge several times what a broad technology fund does, and their largest holdings are already inside any index fund you own. Structural demand for a product is not the same as a good return from its shares.",
    matches: (s) => industryIn(s, ["Cybersecurity"]) || (s.kind === "etf" && /cybersecurity/i.test(s.fund.indexName)),
    rank: (s) => (isStock(s) ? s.fundamentals.revenueCagr3y : 0.2),
  },
  {
    id: "energy-transition",
    label: "Energy transition",
    blurb: "Solar, renewables generation and the equipment behind them.",
    criteria: "Companies in solar or regulated utilities with renewables exposure, plus global clean-energy funds. Ranked by 12-month return.",
    caution:
      "The clearest cautionary theme in this dataset: the main fund here fell roughly 60% from its 2021 peak. Returns depend heavily on subsidy and interest-rate policy, neither of which is a business quality you can analyse.",
    matches: (s) =>
      industryIn(s, ["Solar"]) ||
      (s.kind === "etf" && /clean energy/i.test(s.fund.indexName)) ||
      (isStock(s) && s.sector === "utilities" && s.fundamentals.revenueCagr3y > 0),
    rank: (s) => s.trailing.return12m,
  },
  {
    id: "quality-compounders",
    label: "Quality compounders",
    blurb: "Highly profitable businesses with little debt — the ones that fund their own growth.",
    criteria:
      "Return on invested capital above 20%, net debt below 2x EBITDA, and a positive free cash flow margin. Quality-factor funds included. Ranked by return on invested capital.",
    caution:
      "Quality is the most expensive thing to buy in markets, because everyone can see it. These businesses are usually excellent and usually priced accordingly, so the risk is the multiple rather than the company.",
    matches: (s) =>
      (isStock(s) &&
        s.fundamentals.returnOnInvestedCapital > 0.2 &&
        s.fundamentals.netDebtToEbitda < 2 &&
        s.fundamentals.freeCashFlowMargin > 0) ||
      (s.kind === "etf" && (s.breakdown.factor?.quality ?? 0) >= 0.6),
    rank: (s) => (isStock(s) ? s.fundamentals.returnOnInvestedCapital : 0.25),
  },
  {
    id: "defensive-income",
    label: "Defensive income",
    blurb: "Steadier businesses and funds that pay out — staples, utilities, health care and low-volatility strategies.",
    criteria:
      "Beta below 0.8 with a yield above 2%, in consumer staples, utilities, health care or telecoms. Low-volatility and high-dividend funds included. Ranked by yield.",
    caution:
      "Defensive is not the same as safe. These companies carry more debt than average and their share prices move with long-term interest rates, so they can fall alongside bonds rather than cushioning them.",
    matches: (s) =>
      (isStock(s) &&
        s.beta < 0.8 &&
        s.fundamentals.dividendYield > 0.02 &&
        ["consumerStaples", "utilities", "healthCare", "communicationServices"].includes(s.sector)) ||
      (s.kind === "etf" && ((s.breakdown.factor?.lowVolatility ?? 0) >= 0.5 || (s.breakdown.factor?.dividendYield ?? 0) >= 0.7)),
    rank: (s) => (s.kind === "etf" ? s.yield : s.fundamentals.dividendYield),
  },
];

export function themeById(id: string): Theme | undefined {
  return THEMES.find((t) => t.id === id);
}

export interface ThemeMatches {
  theme: Theme;
  stocks: Security[];
  funds: Security[];
}

export function matchesFor(theme: Theme): ThemeMatches {
  const all = SECURITIES.filter((s) => theme.matches(s)).sort((a, b) => theme.rank(b) - theme.rank(a));
  return {
    theme,
    stocks: all.filter((s) => s.kind === "stock"),
    funds: all.filter((s) => s.kind === "etf"),
  };
}
