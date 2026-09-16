import { formatCurrency, formatMultiple, formatPercent } from "@/lib/format";
import { screenForExposure } from "../implement";
import type { Finding, StockSecurity } from "../types";
import { materiality, type GapContext } from "./context";

export function incomeFindings(ctx: GapContext): Finding[] {
  const findings: Finding[] = [];
  const currency = ctx.portfolio.baseCurrency;
  const total = ctx.portfolio.totalValue;
  const held = ctx.portfolio.positions.map((p) => p.symbol);
  const portfolioYield = ctx.metrics.exposure.yield;

  // --- Income needed now against income the portfolio actually pays.
  if (ctx.profile.incomeNeedRate > 0.005) {
    const shortfall = ctx.profile.incomeNeedRate - portfolioYield;
    if (Math.abs(shortfall) > 0.008) {
      const short = shortfall > 0;
      findings.push({
        id: "income-need-gap",
        category: "income",
        direction: short ? "under" : "over",
        severity: materiality({ magnitude: Math.abs(shortfall), scaleAt: 0.03, valueShare: 0.7 }),
        title: short
          ? `Income drawn exceeds what the portfolio pays out`
          : `The portfolio pays out more income than is being drawn`,
        summary: short
          ? `You are drawing ${formatPercent(ctx.profile.incomeNeedRate)} a year — ${formatCurrency(ctx.profile.incomeNeedRate * total, currency)} — while the portfolio distributes ${formatPercent(portfolioYield)}. The difference, ${formatCurrency(Math.abs(shortfall) * total, currency)} a year, has to come from selling.`
          : `The portfolio distributes ${formatPercent(portfolioYield)} against a stated need of ${formatPercent(ctx.profile.incomeNeedRate)}. The surplus ${formatCurrency(Math.abs(shortfall) * total, currency)} is being paid out whether or not it is wanted.`,
        why: short
          ? "Funding withdrawals by selling is not a failure mode — a total-return approach treats income and capital as the same money, and selling units is how you spend a portfolio that pays less than you need. What it does require is a plan for which assets get sold in a bad year, so the selling does not fall on whatever has just dropped most."
          : "Distributions that are not spent still get taxed in a taxable account, and then have to be reinvested. Accumulating funds, or lower-yielding ones, avoid the round trip. In a tax-advantaged account this matters much less.",
        evidence: [
          { label: "Income need", value: formatPercent(ctx.profile.incomeNeedRate), detail: formatCurrency(ctx.profile.incomeNeedRate * total, currency) },
          { label: "Portfolio distribution yield", value: formatPercent(portfolioYield), detail: formatCurrency(portfolioYield * total, currency) },
          { label: "Account type", value: ctx.profile.taxWrapper },
        ],
        learnSlug: "income-vs-total-return",
        implementation: {
          objective: short ? "Decide how withdrawals will be funded in a year when markets are down." : "Decide whether the income is wanted, and where it is being taxed.",
          gapValue: Math.abs(shortfall) * total,
          routes: short
            ? [
                { label: "Hold the next few years of withdrawals separately", detail: "Keeping two to three years of spending in cash and short bonds means a bad year is funded from the stable sleeve rather than by selling equities into a fall." },
                { label: "Fund withdrawals by rebalancing", detail: "Selling whatever is above its target weight both funds the withdrawal and rebalances the portfolio, without needing a separate decision." },
              ]
            : [
                { label: "Check the wrapper first", detail: "In a tax-advantaged account, surplus income costs nothing but the reinvestment. In a taxable one it is taxed on the way out." },
                { label: "Accumulating share classes", detail: "Where available, an accumulating version of the same fund reinvests internally instead of distributing." },
              ],
          screen: short
            ? screenForExposure({ dimension: "credit", bucket: "government", minPurity: 0.9, excludeSymbols: held, extraFilter: (e) => e.duration <= 3, extraFilterLabel: "duration of 3 years or less", limit: 3 })
            : null,
          tradeoffs: ["Chasing a higher yield to close an income gap changes what the portfolio holds. Selling units to fund spending does not."],
        },
      });
    }
  }

  // --- Dividends that look generous relative to what supports them.
  const strained = ctx.portfolio.positions
    .filter((p): p is typeof p & { security: StockSecurity } => p.security.kind === "stock")
    .filter((p) => p.security.fundamentals.dividendYield > 0.035 && p.security.fundamentals.payoutRatio > 0.75)
    .sort((a, b) => b.weight - a.weight);

  if (strained.length > 0) {
    const strainedWeight = strained.reduce((a, p) => a + p.weight, 0);
    findings.push({
      id: "income-dividend-strain",
      category: "income",
      direction: "over",
      severity: materiality({ magnitude: strainedWeight, scaleAt: 0.2, valueShare: strainedWeight }),
      title: `${strained.length} holding${strained.length === 1 ? "" : "s"} pay${strained.length === 1 ? "s" : ""} a high dividend with little cover`,
      summary: `${strained.map((p) => p.symbol).join(", ")} — ${formatPercent(strainedWeight)} of the portfolio — combine a yield above 3.5% with a payout ratio above 75%.`,
      why:
        "A yield is a ratio, and it rises when the price falls as readily as when the dividend rises. The combination of a high yield and a high payout ratio is the shape a dividend takes shortly before it is cut: most of the earnings are already committed, so there is little room for a bad year. The cut then usually takes the share price with it.",
      evidence: strained.slice(0, 4).map((p) => ({
        label: `${p.security.name} (${p.symbol})`,
        value: formatPercent(p.security.fundamentals.dividendYield),
        detail: `payout ${formatPercent(p.security.fundamentals.payoutRatio, 0)} · net debt/EBITDA ${formatMultiple(p.security.fundamentals.netDebtToEbitda)} · ${p.security.fundamentals.dividendGrowthStreakYears}y of growth`,
      })),
      learnSlug: "dividend-traps",
      implementation: {
        objective: "Look at what funds each dividend, not just the yield it advertises.",
        gapValue: null,
        routes: [
          { label: "Check cover before yield", detail: "Free cash flow against the dividend paid, and net debt against EBITDA, say more about whether a payout survives than the yield does." },
          { label: "Or take income at the portfolio level", detail: "Broad funds spread payout risk across hundreds of companies, so a single cut barely registers in the total." },
        ],
        screen: screenForExposure({ dimension: "factor", bucket: "dividendYield", minPurity: 0.5, excludeSymbols: held, limit: 3 }),
        tradeoffs: ["A high payout ratio is normal for utilities and REITs, where cash flow is stable and regulated. Read the score against the sector, not against the whole market."],
      },
    });
  }

  return findings;
}
