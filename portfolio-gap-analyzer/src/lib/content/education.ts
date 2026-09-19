export interface Article {
  slug: string;
  title: string;
  summary: string;
  topic: "Risk" | "Diversification" | "Cost" | "Income" | "Company analysis";
  readingMinutes: number;
  keyPoints: string[];
  sections: { heading: string; paragraphs: string[] }[];
}

export const ARTICLES: Article[] = [
  {
    slug: "risk-capacity",
    title: "Risk capacity is not risk tolerance",
    summary: "One is about your circumstances and one is about your feelings. Only one of them can be overruled by a bad year.",
    topic: "Risk",
    readingMinutes: 4,
    keyPoints: [
      "Tolerance is how much volatility you are comfortable with; capacity is how much you can absorb without changing your plans.",
      "Capacity comes from the horizon, the cash buffer in front of the portfolio, and how much new money is arriving.",
      "Where the two disagree, capacity is the binding constraint — comfort does not create the ability to wait.",
    ],
    sections: [
      {
        heading: "The two questions are different",
        paragraphs: [
          "Risk tolerance asks how you feel when the value of your portfolio drops by a quarter. It is a real input, because a portfolio you abandon at the bottom performs far worse than one you can sit through. But it is self-reported, it is measured in calm conditions, and it is famously unstable: most people discover their true tolerance during the first serious decline they live through.",
          "Risk capacity asks a factual question instead. If the portfolio fell by a quarter tomorrow and took six years to recover, what would actually break? If the answer is nothing — the money is not needed for twenty years, there is a cash buffer for emergencies, and contributions keep arriving — capacity is high regardless of how the fall feels. If the answer is that a house purchase gets postponed or a withdrawal has to be taken at the bottom, capacity is low no matter how relaxed you are about volatility.",
        ],
      },
      {
        heading: "Why capacity wins",
        paragraphs: [
          "When the two disagree, capacity is the one that binds. Being comfortable with a 40% fall does not create the years needed to recover from one. This is why a short horizon caps the sensible growth allocation even for someone who describes themselves as aggressive, and why the reference model in this tool treats the capacity score as a ceiling rather than as another input to average.",
          "The reverse case matters too, and gets less attention. A low tolerance with a high capacity — someone twenty-five years from retirement who keeps everything in cash — is also a mismatch. It feels safe because the balance never falls, and it quietly guarantees a smaller result, because inflation compounds against cash for the whole period.",
        ],
      },
      {
        heading: "What raises capacity",
        paragraphs: [
          "Three things, none of which are investment decisions: lengthening the horizon, building the emergency buffer so the portfolio is not the first thing sold in a crisis, and increasing regular contributions so new money does some of the work that returns would otherwise have to do. Each of them widens the range of portfolios you can hold without being forced into a sale at a bad moment.",
        ],
      },
    ],
  },
  {
    slug: "home-bias",
    title: "Home bias: the position nobody remembers taking",
    summary: "Almost every investor holds far more of their own market than it represents globally. It is usually an accident, and it is always a bet.",
    topic: "Diversification",
    readingMinutes: 4,
    keyPoints: [
      "The global market portfolio is roughly 64% United States, 12% Europe ex-UK, 10% emerging markets and 3% United Kingdom.",
      "Holding more of your home market than that is a decision, whether or not it was made deliberately.",
      "There are real arguments for some home bias — currency, tax, familiarity — and they justify a tilt, not a concentration.",
    ],
    sections: [
      {
        heading: "The starting point",
        paragraphs: [
          "The market portfolio is what every investor collectively owns. It is not a recommendation; it is an accounting identity. If you hold 70% of your equities in one country that represents 3% of world market value, you have taken a large active position relative to that identity — and someone else is holding the other side of it.",
          "This is the reason a gap analysis can be useful without giving advice. Comparing a portfolio to global market weights does not say what anyone should own. It says what they do own relative to what everyone owns, and leaves the interpretation to them.",
        ],
      },
      {
        heading: "Why it happens",
        paragraphs: [
          "Home bias is rarely chosen. It accumulates: the companies you have heard of are listed at home, the index quoted on the news is the domestic one, the default fund in a workplace scheme is often home-weighted, and employer shares are home by definition. Each individual step is reasonable. The sum of them is a concentrated country bet.",
        ],
      },
      {
        heading: "The arguments for some of it",
        paragraphs: [
          "Home bias is not automatically wrong. Your liabilities — rent, food, school fees — are in your home currency, and home assets match them without exchange-rate risk. Domestic funds can carry better tax treatment, and domestic dividends may avoid withholding tax. Costs are usually lower.",
          "What these arguments support is a tilt of some tens of percentage points, sized deliberately. They do not support holding 80% of a portfolio in a market that is 3% of the world, which is what a UK or Australian investor discovers when they look through their holdings for the first time.",
        ],
      },
      {
        heading: "The subtler version",
        paragraphs: [
          "Country weights are not the whole story. A UK investor holding only FTSE 100 companies has a portfolio of banks, oil, mining and consumer staples with almost no technology — so the country bet is also a large sector bet. Meanwhile many of those companies earn most of their revenue abroad, so the domestic exposure is less domestic than it looks. Looking at sector and revenue mix alongside the country label gives a truer picture than either on its own.",
        ],
      },
    ],
  },
  {
    slug: "concentration",
    title: "The risk you are not paid to take",
    summary: "Markets compensate you for risk that cannot be diversified away. Single-company risk can be, so it is not compensated.",
    topic: "Diversification",
    readingMinutes: 5,
    keyPoints: [
      "Company-specific risk can be removed at no cost by holding more companies, so no premium is paid for bearing it.",
      "Counting holdings overstates diversification: what matters is how uneven the weights are.",
      "Concentration arrives through funds as well as directly, because index funds hold the same large companies.",
    ],
    sections: [
      {
        heading: "Two kinds of risk",
        paragraphs: [
          "The risk in any single share splits into two parts. Some of it is shared with the whole market — recessions, interest rates, broad sentiment — and no amount of diversification removes it. The rest is specific to the company: a failed drug trial, an accounting problem, a lost contract. That part disappears as you add more companies, because individual surprises are not synchronised.",
          "The consequence is uncomfortable but well established: since specific risk can be removed for free, the market does not pay a premium for carrying it. An investor holding one company instead of five hundred takes far more risk for the same expected return. That is the argument for diversification in a sentence, and it does not depend on any forecast.",
        ],
      },
      {
        heading: "Counting holdings is the wrong measure",
        paragraphs: [
          "A portfolio of twenty shares where one is 40% of the value is not a twenty-stock portfolio in any way that matters. A more useful measure is effective holdings: one divided by the sum of squared weights. It answers how many equally sized positions would produce the same concentration. Twenty holdings with one at 40% might score around six.",
          "This tool reports that figure through funds as well as directly, which is where most people get a surprise.",
        ],
      },
      {
        heading: "Concentration through the back door",
        paragraphs: [
          "Index funds are weighted by market value, so the largest companies appear at the top of nearly every equity fund. Holding an S&P 500 fund, a Nasdaq-100 fund and a large-cap growth fund does not give three different exposures — it gives one exposure three times, with the same handful of companies at the top of each.",
          "Add a direct holding in one of those same companies and the real weight can reach double digits without any single line on the statement looking large. The only way to see it is to add up holdings across every fund, which is what a look-through does.",
        ],
      },
      {
        heading: "What to do with a large position",
        paragraphs: [
          "Nothing automatic. Concentration is how significant wealth is usually created, and cutting it lowers the top of the range as well as the bottom. A large holding with a big unrealised gain in a taxable account has a real, calculable cost to reducing. The point of measuring it is to make it a decision with a stated reason, rather than a drift that nobody noticed.",
        ],
      },
    ],
  },
  {
    slug: "fund-overlap",
    title: "When two funds are really one",
    summary: "Overlapping funds add charges and lines to manage without adding diversification.",
    topic: "Diversification",
    readingMinutes: 3,
    keyPoints: [
      "Overlap is the share of value sitting in the same companies across two funds.",
      "Above roughly 80%, a second fund is mostly a duplicate of the first.",
      "Genuine reasons for two similar funds exist: domicile, currency hedging, distribution policy, account structure.",
    ],
    sections: [
      {
        heading: "How duplication happens",
        paragraphs: [
          "Almost nobody sets out to hold two funds tracking the same index. It accumulates: a fund bought years ago at one broker, the same exposure bought later at another because it was the default, a provider switch that left the original in place, a workplace scheme that only offers one option. Each step made sense; the result is two lines doing one job.",
          "The cost is small and permanent. Two sets of charges, two tracking differences, two positions to rebalance, and a portfolio that looks more diversified on the statement than it is in substance.",
        ],
      },
      {
        heading: "Measuring it",
        paragraphs: [
          "Overlap between two funds is the sum, across every company, of the smaller of its two weights. Two identical funds score 100%. Two funds with no shared holdings score zero. An S&P 500 fund and a total US market fund typically score in the high eighties, because the extra companies in the total-market fund are small enough that they carry little weight.",
          "Funds publish only their largest holdings, so any overlap figure from public data is an estimate. This tool blends the disclosed-holdings result with the structural similarity of the two funds and labels the result as an estimate, because treating it as precise would be misleading.",
        ],
      },
      {
        heading: "When two similar funds are justified",
        paragraphs: [
          "Domicile and tax treatment can differ in ways that matter more than the fee. An accumulating fund and a distributing one behave differently in a taxable account. A hedged and an unhedged version of the same index are genuinely different instruments. And keeping one fund per account is sometimes simply easier to administer. The test is whether the difference is doing work, not whether the funds have different tickers.",
        ],
      },
    ],
  },
  {
    slug: "costs",
    title: "The only input you know in advance",
    summary: "Returns are uncertain. Charges are not, and they compound against you in exactly the way returns compound for you.",
    topic: "Cost",
    readingMinutes: 4,
    keyPoints: [
      "An ongoing charge is deducted from the balance every year, so its effect grows with the portfolio.",
      "Over decades, a difference of a few tenths of a percent becomes a meaningful share of the final balance.",
      "Cost is not the only thing that matters: spread, tracking difference, fund size and tax treatment all affect what you keep.",
    ],
    sections: [
      {
        heading: "Why small numbers get large",
        paragraphs: [
          "A 0.75% annual charge against a 0.05% one sounds like a rounding error. On £100,000 growing at 5% a year for thirty years, the cheaper fund ends around £427,000 and the dearer one around £345,000. The £82,000 difference is not the fees paid — it is the fees plus everything those fees would have earned had they stayed invested.",
          "This is the same compounding that makes long-horizon investing work, running in the opposite direction. It is also the reason cost matters most for the money you will hold longest.",
        ],
      },
      {
        heading: "Where to look first",
        paragraphs: [
          "Sort holdings by value, not by fee. A tenth of a percent on the largest position is worth more than a full percent on the smallest. This is unintuitive, because the eye is drawn to the worst-looking number rather than the largest amount of money.",
          "Then check what the charge is buying. A higher fee for a genuinely different exposure — small-cap value, an active strategy you specifically want — is a decision. A higher fee for the same index in a different wrapper is not buying anything.",
        ],
      },
      {
        heading: "The costs that are not in the headline figure",
        paragraphs: [
          "The ongoing charge is the visible part. Bid-ask spread is paid on every trade and matters for smaller or less liquid funds. Tracking difference — how far the fund's return lags its index after everything — is sometimes larger than the stated fee, and sometimes smaller, because securities lending revenue can offset charges. Platform fees and commissions sit on top. For a fund held in a taxable account, the tax treatment of distributions can dwarf all of it.",
        ],
      },
    ],
  },
  {
    slug: "sequence-risk",
    title: "Why the order of returns matters",
    summary: "Two portfolios with identical average returns can end in very different places, depending on when the bad years arrive.",
    topic: "Risk",
    readingMinutes: 4,
    keyPoints: [
      "When money is being added or withdrawn, the order of returns changes the outcome.",
      "A fall just before money is needed is the damaging case, because there is no time to recover.",
      "Holding the next few years of spending in stable assets is the standard defence.",
    ],
    sections: [
      {
        heading: "The arithmetic",
        paragraphs: [
          "If nothing is added or withdrawn, the order of annual returns makes no difference — multiplication is commutative and the end value is the same. The moment money moves in or out, that stops being true. Withdrawing during a decline sells more units to raise the same amount, and those units are not there to recover.",
          "The same effect works in your favour while saving: a long decline early in a savings life buys more units cheaply. The risk is specifically a fall near the point where the money is needed.",
        ],
      },
      {
        heading: "What it means in practice",
        paragraphs: [
          "For someone twenty years from their goal, volatility is something to sit through, and the greater danger is holding too little in growth assets for too long. For someone two years out, the same volatility decides the outcome. The relevant question is not how likely a fall is, but what happens to the goal if one occurs in the final year.",
          "Broad equity markets have fallen by more than a third several times in the past century, and have taken years to regain their previous level. This is not a tail scenario to be dismissed; it is a normal feature of the asset class.",
        ],
      },
      {
        heading: "The usual defences",
        paragraphs: [
          "Hold the next two to three years of spending in cash and short-dated bonds, so a bad year is funded from the stable sleeve rather than by selling equities into a fall. Decide the glidepath in advance — a fixed share moved to short-dated assets each year — so the timing is not decided in the middle of a decline. And treat money with different dates as different problems, rather than averaging a house deposit and a pension into one allocation.",
        ],
      },
    ],
  },
  {
    slug: "inflation-protection",
    title: "What actually defends against inflation",
    summary: "Nominal bonds are built for a different job. Linkers hedge inflation by contract; commodities hedge it by correlation, at a price.",
    topic: "Risk",
    readingMinutes: 4,
    keyPoints: [
      "A nominal bond pays a fixed coupon, so an inflation surprise cuts what that coupon buys and the price falls with it.",
      "Index-linked bonds track inflation contractually — the direct hedge, at the cost of a lower real yield.",
      "Commodities have historically risen in inflation shocks, but pay nothing and carry equity-like volatility.",
    ],
    sections: [
      {
        heading: "Two different jobs",
        paragraphs: [
          "A defensive sleeve is usually asked to do two things at once: hold up when equities fall, and preserve purchasing power. Nominal government bonds are very good at the first and structurally bad at the second. Their coupon is fixed in cash terms, so when inflation surprises to the upside, both the real value of that coupon and the price of the bond fall together.",
          "2022 was the clean demonstration. Equities and nominal bonds fell at the same time, because the shock that hurt equities was the same shock that repriced the bonds. A portfolio that held bonds purely as an equity cushion discovered it had one hedge doing two jobs and failing at both.",
        ],
      },
      {
        heading: "Index-linked bonds: the direct hedge",
        paragraphs: [
          "Inflation-linked bonds — TIPS in the United States, index-linked gilts in the UK — have their principal adjusted by the consumer price index. The link is contractual, not statistical, which makes them the only asset that hedges inflation by construction rather than by historical tendency.",
          "The cost is a lower starting real yield than a nominal bond of the same maturity. That difference is roughly the market's expected inflation plus a risk premium, and it is the price of the protection. They are not free, and they are not a higher-returning bond.",
        ],
      },
      {
        heading: "Commodities: a hedge by correlation",
        paragraphs: [
          "Broad commodity futures have historically had positive sensitivity to unexpected inflation, which is the specific thing a portfolio cannot otherwise insure against. Energy and food are large components of the price indices themselves, so the link is not a coincidence.",
          "But the terms are demanding. Commodities produce no earnings, no coupon and no dividend, so the whole return is the price change plus the roll. Over very long periods the real return has been close to zero, with volatility comparable to equities and drawdowns to match. They are held for what they do during a shock, not for what they compound at.",
          "Gold is often assumed to belong in this category. Over decades it has roughly kept pace with inflation; over any particular five-year stretch it has frequently done nothing of the sort.",
        ],
      },
      {
        heading: "Sizing it",
        paragraphs: [
          "Because commodities substitute for bonds rather than for equities, funding them out of the defensive sleeve makes that sleeve less reliable as an equity cushion. That is the real trade, and it is why a commodity allocation is usually small and capped rather than open-ended.",
          "The ordering that follows from all this: linkers first, because they hedge the risk directly at bond-like volatility; commodities second and in smaller size, for the part of an inflation shock that linkers alone do not cover.",
        ],
      },
    ],
  },
  {
    slug: "cash-drag",
    title: "Cash: safe over one year, expensive over twenty",
    summary: "Cash is the right home for money needed soon. Over a long horizon its safety becomes the cost.",
    topic: "Risk",
    readingMinutes: 3,
    keyPoints: [
      "Cash roughly tracks inflation over long periods, so purchasing power stands still.",
      "Large cash balances usually reflect a pause rather than a decision.",
      "Investing on a fixed schedule removes the need to pick a moment.",
    ],
    sections: [
      {
        heading: "What cash is for",
        paragraphs: [
          "Two jobs, both important: the emergency buffer, and spending that is genuinely near-term. For both, the fact that the balance does not move is the entire point. No amount of expected return compensates for having to sell something at an uncertain price when the boiler fails.",
        ],
      },
      {
        heading: "Beyond that",
        paragraphs: [
          "Once those two pots are funded, additional cash has a cost that does not appear on any statement. Over long periods cash has roughly kept pace with inflation, meaning purchasing power holds steady while invested money compounds. Over twenty years that gap is the difference between preserving money and growing it.",
          "The usual reason for a large balance is not a decision but a pause — waiting for a better entry point, or simply not having got round to it. Both feel like caution and behave like a position.",
        ],
      },
      {
        heading: "Getting invested without picking a moment",
        paragraphs: [
          "Investing a lump sum all at once has historically produced better average outcomes than spreading it, simply because markets rise more often than they fall. It also produces the worst regret if the timing is unlucky. Splitting the balance into fixed instalments on set dates gives up a little expected return in exchange for a plan you can actually follow. The version that fails is the one with no dates, where each instalment waits for conditions to look better.",
        ],
      },
    ],
  },
  {
    slug: "emergency-buffer",
    title: "The buffer that makes everything else work",
    summary: "Without cash in front of the portfolio, the portfolio becomes the emergency fund.",
    topic: "Risk",
    readingMinutes: 3,
    keyPoints: [
      "Three to six months of essential spending is the usual starting range.",
      "Job losses and market falls tend to arrive together, which is exactly the problem.",
      "Access matters more than the interest rate.",
    ],
    sections: [
      {
        heading: "Why it comes first",
        paragraphs: [
          "A long horizon only works if the money can be left alone. Without a buffer, an unexpected bill has to be met by selling investments — and the periods when people most often need money unexpectedly, because work is uncertain, are the periods when markets are most likely to be down. The buffer exists so that the worst moment to sell is never also the moment you are forced to.",
        ],
      },
      {
        heading: "How much",
        paragraphs: [
          "Three months of essential spending is a common floor and six is a common target, but the number depends on how stable the income is. Two salaried earners in secure jobs might reasonably hold less; a single freelancer with variable income should hold more. Essential spending, not total spending — the figure you would need if you cut back.",
        ],
      },
      {
        heading: "Where to hold it",
        paragraphs: [
          "Same-day or next-day access matters more than a few tenths of a percent in interest. An instrument that has to be sold at an uncertain price, or that takes a week to settle, is not performing the function. Money market funds and Treasury bill funds sit close to the line: usually fine, occasionally not, depending on how quickly your provider settles.",
        ],
      },
    ],
  },
  {
    slug: "duration",
    title: "Duration: how much a bond moves when rates move",
    summary: "Roughly, a one-point rise in yields costs one percent of value for each year of duration.",
    topic: "Risk",
    readingMinutes: 4,
    keyPoints: [
      "Duration measures price sensitivity to interest rates, in years.",
      "A long-duration bond fund can be as volatile as equities.",
      "Matching duration to the horizon makes rate moves roughly self-cancelling.",
    ],
    sections: [
      {
        heading: "The rule of thumb",
        paragraphs: [
          "A bond fund with a duration of six years loses roughly 6% of its value when yields rise by one percentage point, and gains roughly the same when they fall. A fund with a duration of seventeen years moves nearly three times as much. That is the whole of the mechanism, and it explains why 2022 was so painful for portfolios that held long bonds as their safe asset.",
        ],
      },
      {
        heading: "Why matching the horizon helps",
        paragraphs: [
          "When yields rise, a bond's price falls but its future coupons are reinvested at the higher rate. Those two effects roughly offset at a horizon equal to the duration. Holding duration near your horizon therefore makes you close to indifferent to rate moves — which is the point of a defensive sleeve.",
          "Holding a long-duration fund for a short goal is a bet on rates falling, whatever the label on the fund says. Sometimes that bet is intended. Often it was made because long bonds had the highest yield on the list.",
        ],
      },
      {
        heading: "The equity-drawdown argument",
        paragraphs: [
          "Long government bonds have historically been the asset most likely to rise sharply during an equity crash, because central banks cut rates in recessions. That is a real benefit and the main case for holding more duration than your horizon suggests. It is also not guaranteed: in an inflation shock, equities and long bonds can fall together, as they did in 2022.",
        ],
      },
    ],
  },
  {
    slug: "credit-risk",
    title: "High yield is not the defensive part",
    summary: "Sub-investment-grade bonds behave more like equity than like ballast, and they do it at the worst time.",
    topic: "Risk",
    readingMinutes: 3,
    keyPoints: [
      "High-yield bonds pay more because issuers can default.",
      "They fall alongside equities, because the same conditions drive both.",
      "Counting them as bonds overstates how defensive a portfolio is.",
    ],
    sections: [
      {
        heading: "What the extra yield is for",
        paragraphs: [
          "A high-yield bond pays more than a government bond because there is a real chance the issuer cannot pay. That compensation is not free money; over a full cycle it approximately pays for the defaults that occur, with something left over for the risk. The problem is not the long-run return. It is when the losses arrive.",
        ],
      },
      {
        heading: "The correlation problem",
        paragraphs: [
          "Defaults cluster in recessions, which is precisely when equities fall. So the asset held to cushion an equity drawdown drops at the same time. Statistically high yield has behaved closer to equity than to government bonds during stress periods, which means a portfolio holding it as its defensive sleeve is more exposed to equity-like risk than the asset-class labels suggest.",
          "The practical fix is not necessarily to dispose of the holding. It is to count it in the growth sleeve rather than the defensive one, so the portfolio's actual risk is visible.",
        ],
      },
    ],
  },
  {
    slug: "income-vs-total-return",
    title: "Income and capital are the same money",
    summary: "A portfolio that pays less than you need is not broken. Selling units is a legitimate way to spend it.",
    topic: "Income",
    readingMinutes: 4,
    keyPoints: [
      "A dividend transfers value out of the share price; it does not create value.",
      "Total-return spending funds withdrawals from income and sales together.",
      "Reaching for yield changes what the portfolio holds, usually toward a few sectors.",
    ],
    sections: [
      {
        heading: "Where a dividend comes from",
        paragraphs: [
          "When a company pays a dividend, cash leaves the business and the share price adjusts down by roughly the same amount. The shareholder is no better off at the moment of payment than before it — value moved from one pocket to another. This is not an argument against dividends, which are a sensible way for mature companies to return cash. It is an argument against treating dividend income as free money that capital gains are not.",
        ],
      },
      {
        heading: "Spending a portfolio",
        paragraphs: [
          "A total-return approach treats income and capital as one pool and funds withdrawals from whichever is more convenient. Where income covers the need, spend it. Where it does not, sell units. The question that actually matters is not where the cash comes from but what gets sold in a bad year — and the standard answer is to hold two to three years of spending in stable assets so that nothing has to be sold into a decline.",
        ],
      },
      {
        heading: "The cost of chasing yield",
        paragraphs: [
          "Building a portfolio to produce a target yield changes what it holds. High-yield equity screens concentrate into utilities, telecoms, energy and mature consumer names, and away from most of the technology sector. That is a real sector bet taken for the sake of a cash-flow pattern that selling units would have produced anyway. In a taxable account it can also be worse after tax than a capital gain.",
        ],
      },
    ],
  },
  {
    slug: "dividend-traps",
    title: "A high yield is often a falling price",
    summary: "Yield is a ratio. It rises when the dividend rises, and it rises when the price falls.",
    topic: "Income",
    readingMinutes: 3,
    keyPoints: [
      "A high yield combined with a high payout ratio is the shape of a dividend under strain.",
      "Check free cash flow cover and leverage, not just the yield.",
      "Sector context matters: utilities and REITs run high payouts by design.",
    ],
    sections: [
      {
        heading: "Reading the ratio correctly",
        paragraphs: [
          "Dividend yield is the annual dividend divided by the price. A yield that has risen from 3% to 7% usually means the price halved, not that the payout doubled — and the market marked the price down for a reason, often because it expects the dividend to be cut.",
        ],
      },
      {
        heading: "What to check instead",
        paragraphs: [
          "The payout ratio says how much of earnings is already committed. Above roughly 80% there is little room for a weak year. Free cash flow cover is stronger still, because it asks whether the cash actually exists after capital spending rather than whether accounting earnings do. Net debt to EBITDA matters because a levered company facing a shortfall pays its lenders first and its shareholders last.",
          "A dividend cut typically takes the share price with it, so the income investor loses twice. That is what makes the combination worth checking before the yield is relied on.",
        ],
      },
      {
        heading: "The sector caveat",
        paragraphs: [
          "Regulated utilities and REITs distribute most of their cash flow by design and by law respectively, so a high payout ratio is normal rather than alarming. Compare a company with its own sector before drawing a conclusion from any of these numbers.",
        ],
      },
    ],
  },
  {
    slug: "currency-risk",
    title: "Owning a foreign company means owning its currency",
    summary: "Over decades currency moves have tended to wash out. Over a few years they can swamp the underlying return.",
    topic: "Risk",
    readingMinutes: 3,
    keyPoints: [
      "Unhedged foreign holdings carry exchange-rate risk on top of asset risk.",
      "For equities over long horizons, most investors leave it unhedged; hedging costs money.",
      "For bonds, currency moves can be several times the yield, so hedged versions are the norm.",
    ],
    sections: [
      {
        heading: "The two exposures",
        paragraphs: [
          "Buying a US-listed fund as a UK investor gives two positions: the companies, and the dollar. If the companies gain 10% and the dollar falls 10% against sterling, the sterling return is close to zero. Nothing went wrong with the investment thesis; the second position simply moved the other way.",
        ],
      },
      {
        heading: "Why equities are usually left unhedged",
        paragraphs: [
          "Over long horizons, currency pairs have tended to mean-revert rather than trend indefinitely, so the effect washes out somewhat. Hedging costs the interest-rate differential between the two currencies, which can be substantial and is paid every year regardless of what happens. And large multinational companies already have revenue in many currencies, so the listing currency overstates the true exposure.",
        ],
      },
      {
        heading: "Why bonds usually are hedged",
        paragraphs: [
          "The calculation reverses for bonds. A 3% yield against a currency that can move 10% in a year means the currency dominates the return entirely — you would be holding a foreign exchange position with a small coupon attached. This is why international bond funds are overwhelmingly sold in currency-hedged form, and why an unhedged one deserves a second look.",
        ],
      },
    ],
  },
  {
    slug: "factor-tilts",
    title: "Factor tilts are decade-long positions",
    summary: "If you cannot hold a tilt through ten bad years, the tilt will cost you rather than pay you.",
    topic: "Diversification",
    readingMinutes: 4,
    keyPoints: [
      "Factor premia, where they exist, show up over decades and disappear for years at a time.",
      "The main risk is abandoning the tilt after a bad stretch, which converts a long-run bet into a realised loss.",
      "Tilts often accumulate accidentally from funds bought for other reasons.",
    ],
    sections: [
      {
        heading: "What a factor is",
        paragraphs: [
          "A factor is a characteristic shared by a group of companies that has historically been associated with different returns: cheapness relative to book value or earnings, profitability, recent price strength, small size, low volatility. Funds built around them are widely available and cheap compared with traditional active management.",
        ],
      },
      {
        heading: "The honest version of the evidence",
        paragraphs: [
          "The historical record is real but weaker than the marketing. Premia are measured over many decades, they vary by market and period, some have shrunk since publication, and every one of them has endured stretches of underperformance long enough to exhaust most investors' patience. Value spent most of the 2010s losing to growth.",
          "That does not make tilts unreasonable. It makes them a commitment with a horizon attached, which should be written down when the position is taken rather than reconstructed during a bad year.",
        ],
      },
      {
        heading: "Accidental tilts",
        paragraphs: [
          "Most factor exposure in retail portfolios was never chosen. A technology fund plus a large-cap growth fund plus a few well-known names produces a large growth and momentum tilt without anyone deciding on one. The first step is measuring what is already there; deciding what it should be comes second.",
        ],
      },
    ],
  },
  {
    slug: "size-and-style",
    title: "Size and style: the shape underneath the labels",
    summary: "A portfolio built from a large-cap index and a few familiar names usually holds almost nothing outside the largest companies.",
    topic: "Diversification",
    readingMinutes: 3,
    keyPoints: [
      "Large caps are around 72% of global market value, mid caps 19% and small caps 9%.",
      "Style splits roughly into thirds: value, blend and growth.",
      "Deviations from those shares are positions, whether or not they were chosen.",
    ],
    sections: [
      {
        heading: "Where the gap usually appears",
        paragraphs: [
          "Mid caps are the most commonly missing slice. An S&P 500 fund covers large caps; a small-cap fund covers the bottom; the middle is left out unless something specifically covers it. Since mid caps are a fifth of market value, that is a meaningful hole to leave by accident.",
        ],
      },
      {
        heading: "Style is a description, not a verdict",
        paragraphs: [
          "Growth companies are priced on expected future earnings rather than current ones, which makes them more sensitive to interest rates and to disappointment. Value companies are cheap on accounting measures, often for identifiable reasons. Neither is better; they behave differently, and a portfolio heavily weighted to one has made a bet on which environment arrives.",
        ],
      },
    ],
  },
  {
    slug: "sector-concentration",
    title: "Sector weights drift on their own",
    summary: "A sector that performs well becomes a larger share of the portfolio without anyone deciding anything.",
    topic: "Diversification",
    readingMinutes: 3,
    keyPoints: [
      "Market-cap weighting means winners automatically grow into larger positions.",
      "Sector funds are concentrated by construction: some hold fewer than 30 companies.",
      "Look-through is the only way to see the true weight across several funds.",
    ],
    sections: [
      {
        heading: "Drift is the default",
        paragraphs: [
          "In a market-cap-weighted index, a sector that doubles while the rest stands still doubles its weight. Nothing was bought and no decision was made, but the portfolio's exposure has changed materially. This is how information technology grew from a fifth to roughly a third of the US market without most holders adjusting anything.",
          "This is not a flaw in index investing — it is how the index reflects the market. It does mean that leaving a portfolio alone is itself a choice with consequences.",
        ],
      },
      {
        heading: "Sector funds are concentrated instruments",
        paragraphs: [
          "A sector ETF sounds diversified because it is a fund. Many hold fewer than forty companies, and the largest few can be half the fund. An energy sector fund with 40% in two companies is closer to a pair of direct holdings than to a diversified position, and should be sized accordingly.",
        ],
      },
    ],
  },
  {
    slug: "balance-sheets",
    title: "Debt removes options",
    summary: "Leverage magnifies both directions, and it decides what a company can do in a bad year.",
    topic: "Company analysis",
    readingMinutes: 4,
    keyPoints: [
      "Net debt to EBITDA says how much debt there is; interest cover says whether it is affordable.",
      "Above roughly three times EBITDA, lenders typically start attaching conditions.",
      "Refinancing dates matter: debt taken out cheaply has to be replaced at today's rates.",
    ],
    sections: [
      {
        heading: "Two numbers, two questions",
        paragraphs: [
          "Net debt to EBITDA compares borrowings, less cash, with annual operating cash generation. It answers how many years of earnings the debt represents. Interest cover — operating profit divided by interest expense — answers whether the payments are comfortably affordable right now. A company can look heavily indebted on the first measure and perfectly safe on the second if its borrowing is cheap and long-dated.",
        ],
      },
      {
        heading: "What debt actually costs you",
        paragraphs: [
          "The visible cost is interest. The larger cost is lost flexibility. A levered company facing a weak year must service its debt before anything else, so the dividend gets cut, capital spending gets deferred, and in the worst case shares get issued at depressed prices — diluting existing holders at precisely the wrong moment. An unlevered competitor can spend through the downturn and take market share.",
        ],
      },
      {
        heading: "Sector context",
        paragraphs: [
          "Utilities, REITs and telecoms carry high leverage by design, because their cash flows are stable and often regulated. Banks cannot be assessed on these measures at all — leverage is their business model, and they are analysed on capital ratios instead. Comparing a company with its own sector is the only way to read these numbers usefully.",
        ],
      },
      {
        heading: "The maturity wall",
        paragraphs: [
          "Debt issued when rates were near zero has to be refinanced at whatever rates prevail when it matures. A company with comfortable interest cover today and a large maturity next year may not have comfortable cover the year after. The maturity schedule is in the annual report and is one of the more useful things to read in it.",
        ],
      },
    ],
  },
  {
    slug: "valuation-basics",
    title: "What a multiple actually tells you",
    summary: "A high multiple is not a forecast of poor returns. It is a statement about how much future growth is already in the price.",
    topic: "Company analysis",
    readingMinutes: 4,
    keyPoints: [
      "A multiple describes expectations, not quality.",
      "Free cash flow is harder to flatter than accounting earnings.",
      "Cheap and good value are different things — companies are often cheap for identifiable reasons.",
    ],
    sections: [
      {
        heading: "The multiple is the expectation",
        paragraphs: [
          "A company trading at 40 times earnings is not necessarily expensive, and one at 8 times is not necessarily cheap. The multiple says what the market already expects. At 40 times, substantial growth has to arrive simply for the shares to hold their value — growing well is not enough, because growing well is already priced. At 8 times, the market expects decline, and merely stabilising can be enough to do well.",
        ],
      },
      {
        heading: "Why cash flow beats earnings",
        paragraphs: [
          "Accounting earnings involve judgement: depreciation schedules, revenue recognition, provisions, the treatment of acquisitions. Free cash flow — cash from operations less capital spending — is harder to shape, because it either arrived in the bank or it did not. Where the two diverge persistently, the divergence is usually the most interesting thing about the company.",
          "Free cash flow yield, which is free cash flow divided by market value, is also directly comparable across companies with different capital structures and tax positions in a way that P/E is not.",
        ],
      },
      {
        heading: "Cheap is not the same as good value",
        paragraphs: [
          "Screens find cheap companies reliably. Most are cheap for reasons a screen cannot see: structural decline, an unsustainable margin, a legal overhang, an accounting question. The valuation score in this tool ranks companies against a fixed scale of ratios and nothing else — it is a starting point for reading the accounts, not a conclusion drawn from them.",
        ],
      },
    ],
  },
];

export const ARTICLES_BY_SLUG = new Map(ARTICLES.map((a) => [a.slug, a]));

export function getArticle(slug: string): Article | undefined {
  return ARTICLES_BY_SLUG.get(slug);
}
