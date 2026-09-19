/**
 * Plain-English definitions for every term of art on the main path.
 *
 * The rule for writing these: explain it to someone who has never bought an
 * investment, in one or two sentences, without using another term from this
 * list unexplained. If a definition needs jargon to work, the definition is
 * wrong.
 */
export interface GlossaryEntry {
  term: string;
  short: string;
  /** Optional second line for the thing people get wrong about it. */
  note?: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  share: {
    term: "Share",
    short: "A small piece of ownership in a company. Own one and you own a sliver of the business, its profits and its losses.",
  },
  equity: {
    term: "Equities",
    short: "Another word for shares in companies. When you see 'equity' on this site, read 'shares'.",
  },
  bond: {
    term: "Bond",
    short: "A loan to a government or company that pays you interest and returns your money on a set date.",
    note: "Steadier than shares, and usually lower returning over long periods.",
  },
  fund: {
    term: "Fund",
    short: "A single thing you can buy that holds hundreds or thousands of investments at once, so you are not betting on one company.",
  },
  etf: {
    term: "ETF",
    short: "Exchange-traded fund — a fund you buy and sell like a share, through any normal broker.",
    note: "Most are index funds and cost very little. That combination is why this tool focuses on them.",
  },
  index: {
    term: "Index",
    short: "A published list of companies that stands in for a market — the S&P 500 is the 500 biggest US companies.",
  },
  indexFund: {
    term: "Index fund",
    short: "A fund that simply holds everything in an index, rather than paying someone to pick winners. Cheap, because there is nothing to decide.",
  },
  portfolio: {
    term: "Portfolio",
    short: "Everything you own, taken together. The word just means 'all your investments as one thing'.",
  },
  diversification: {
    term: "Diversification",
    short: "Spreading money across many investments so no single failure hurts much.",
    note: "It is the one free improvement in investing: it lowers risk without lowering expected return.",
  },
  volatility: {
    term: "Volatility",
    short: "How much the value bounces around. High volatility means big moves up and down, not necessarily losses.",
  },
  drawdown: {
    term: "Fall",
    short: "A drop from the highest value your portfolio has reached. Shares have fallen by a third or more several times in the past century.",
  },
  horizon: {
    term: "Horizon",
    short: "How long until you need the money. The single most important thing about any investment decision.",
  },
  riskCapacity: {
    term: "Risk capacity",
    short: "How much of a fall your circumstances could absorb — your timescale, your cash buffer, whether more money is coming in.",
    note: "Different from how you feel. Being relaxed about a fall does not create the years needed to recover from one.",
  },
  riskTolerance: {
    term: "Risk tolerance",
    short: "How much of a fall you could live through without selling. A plan you abandon at the bottom is worse than a smaller plan you keep.",
  },
  ongoingCharge: {
    term: "Ongoing charge",
    short: "The percentage a fund takes from your money every year, automatically. You never see a bill; it comes out of the value.",
    note: "0.1% is cheap. 1.5% is expensive. Over decades the difference is enormous.",
  },
  basisPoint: {
    term: "Basis point",
    short: "One hundredth of a percent. 25 basis points is 0.25%. Fund people use it constantly.",
  },
  yield: {
    term: "Yield",
    short: "The income an investment pays out each year, as a percentage of its price.",
    note: "A high yield often means the price has fallen, not that the payout has risen.",
  },
  dividend: {
    term: "Dividend",
    short: "Cash a company pays out to its shareholders from its profits.",
  },
  inflation: {
    term: "Inflation",
    short: "Prices rising, so the same money buys less. It is why money left in cash quietly shrinks in what it can buy.",
  },
  realReturn: {
    term: "Real return",
    short: "Your return after taking inflation out. The only version that tells you whether you can actually buy more than before.",
  },
  linker: {
    term: "Inflation-linked bond",
    short: "A bond whose value rises with inflation by contract, so it protects what your money can buy.",
  },
  commodities: {
    term: "Commodities",
    short: "Physical goods like oil, metals and crops, bought through funds rather than in person.",
    note: "They pay no income and swing as hard as shares. Held for what they do during an inflation shock, not for steady growth.",
  },
  marketCap: {
    term: "Market value",
    short: "What the stock market says a whole company is worth: share price times the number of shares.",
  },
  sector: {
    term: "Sector",
    short: "The kind of business a company is in — technology, banks, health care, energy.",
  },
  developed: {
    term: "Developed markets",
    short: "Richer, long-established stock markets: the US, Japan, western Europe, Australia.",
  },
  emerging: {
    term: "Emerging markets",
    short: "Faster-growing but less settled markets such as China, India, Brazil and Taiwan. Higher potential, bumpier ride.",
  },
  largeCap: {
    term: "Large cap",
    short: "The biggest companies — the household names. 'Cap' is short for market value.",
  },
  rebalancing: {
    term: "Rebalancing",
    short: "Periodically selling a bit of whatever has grown too big and topping up whatever has shrunk, to get back to your intended mix.",
  },
  duration: {
    term: "Duration",
    short: "How much a bond's price moves when interest rates move. Longer duration, bigger swings.",
  },
  creditQuality: {
    term: "Credit quality",
    short: "How likely the borrower is to pay you back. Governments are safest; some companies are decidedly not.",
  },
  highYield: {
    term: "High yield",
    short: "Bonds from borrowers who might not repay, paying more to compensate. Often called junk bonds, and they behave more like shares than like safe bonds.",
  },
  lookThrough: {
    term: "Look-through",
    short: "Adding up what you own inside your funds, not just the funds themselves — so three funds all holding Apple show as one Apple position.",
  },
  concentration: {
    term: "Concentration",
    short: "Having too much in one company or one thing, so its bad day becomes your bad year.",
  },
  benchmark: {
    term: "Benchmark",
    short: "Something fixed to measure yourself against, so you can tell whether a difference was a choice or an accident.",
  },
  spread: {
    term: "Spread",
    short: "The small gap between the buying and selling price. You pay it every time you trade.",
  },
  accumulating: {
    term: "Accumulating",
    short: "A fund that reinvests the income for you automatically, instead of paying it into your account.",
  },
  taxWrapper: {
    term: "Tax wrapper",
    short: "An account type with tax advantages — an ISA in the UK, a 401(k) or IRA in the US.",
  },
  percentile: {
    term: "Percentile",
    short: "A way of describing a range. The 10th percentile is the figure that only one outcome in ten fell below.",
  },
};

export function lookupTerm(key: string): GlossaryEntry | undefined {
  return GLOSSARY[key];
}

export const GLOSSARY_KEYS = Object.keys(GLOSSARY);
