import { formatCurrency, formatPercent } from "@/lib/format";
import { routesToClose, screenForExposure } from "../implement";
import type { Finding } from "../types";
import { materiality, type GapContext } from "./context";

export function structureFindings(ctx: GapContext): Finding[] {
  const findings: Finding[] = [];
  const currency = ctx.portfolio.baseCurrency;
  const { exposure } = ctx.metrics;
  const total = ctx.portfolio.totalValue;
  const held = ctx.portfolio.positions.map((p) => p.symbol);

  // --- Money needed soon, invested in assets that move a lot.
  if (ctx.profile.horizonYears <= 5 && ctx.metrics.estimatedVolatility > 0.11) {
    const illustrativeFall = ctx.metrics.estimatedVolatility * 2;
    findings.push({
      id: "structure-horizon-mismatch",
      category: "horizon",
      direction: "over",
      severity: materiality({ magnitude: ctx.metrics.estimatedVolatility - 0.08, scaleAt: 0.14, valueShare: 1, weight: 1.2 }),
      title: `Money needed in ${ctx.profile.horizonYears} year${ctx.profile.horizonYears === 1 ? "" : "s"} sits in assets that move a lot`,
      summary: `Estimated annual volatility is ${formatPercent(ctx.metrics.estimatedVolatility)}. A fall of around ${formatPercent(illustrativeFall, 0)} — roughly ${formatCurrency(illustrativeFall * total, currency)} — would be an ordinary bad year for a portfolio shaped like this, not an extreme one.`,
      why:
        "Over a long horizon, volatility is something you sit through. Over a short one it decides the outcome, because there is no time to recover before the money is spent. Broad equity markets have fallen by more than a third several times in the past century and taken years to regain the old level. The relevant question is not how likely that is, but what happens to the goal if it occurs in the year before the money is needed.",
      evidence: [
        { label: "Horizon", value: `${ctx.profile.horizonYears} year${ctx.profile.horizonYears === 1 ? "" : "s"}`, detail: `goal: ${ctx.profile.goal}` },
        { label: "Estimated volatility", value: formatPercent(ctx.metrics.estimatedVolatility), detail: "annualised, single-factor estimate" },
        { label: "Growth assets held", value: formatPercent(exposure.assetClass.equity + exposure.assetClass.realEstate + exposure.assetClass.commodity) },
        { label: "Reference growth share", value: formatPercent(ctx.reference.inputs.growthShare), detail: "for this horizon and risk capacity" },
      ],
      learnSlug: "sequence-risk",
      implementation: {
        objective: "Match the volatility of the money to when it is actually needed.",
        gapValue: null,
        routes: [
          { label: "Separate the money by date", detail: "Money needed within a few years and money for decades away are different problems. Splitting them lets each be positioned on its own terms instead of averaging the two." },
          { label: "Shorten as the date approaches", detail: "A pre-decided glidepath — moving a fixed share into short-dated bonds or cash each year — takes the timing decision out of the moment when markets are moving." },
        ],
        screen: screenForExposure({ dimension: "credit", bucket: "government", minPurity: 0.9, excludeSymbols: held, extraFilter: (e) => e.duration <= 3, extraFilterLabel: "duration of 3 years or less", limit: 3 }),
        tradeoffs: [
          "Lowering volatility lowers the expected end value too. If the goal needs the growth, the answer may be a later date or a smaller target rather than more risk.",
        ],
      },
    });
  }

  // --- A cash pile with a long horizon in front of it.
  const cashWeight = exposure.assetClass.cash;
  const referenceCash = ctx.reference.assetClass.cash;
  if (cashWeight - referenceCash > 0.1 && ctx.profile.horizonYears >= 7) {
    const excess = cashWeight - referenceCash;
    const excessValue = excess * total;
    const years = ctx.profile.horizonYears;
    const forgone = excessValue * ((1.05 ** years) - (1.02 ** years));
    findings.push({
      id: "structure-cash-drag",
      category: "horizon",
      direction: "over",
      severity: materiality({ magnitude: excess, scaleAt: 0.3, valueShare: excess, weight: 0.95 }),
      title: `${formatPercent(cashWeight)} of the portfolio is sitting in cash`,
      summary: `That is ${formatCurrency(cashWeight * total, currency)}, against ${formatPercent(referenceCash)} in the reference model. With ${years} years until the money is needed, ${formatCurrency(excessValue, currency)} of it is uninvested for a long time.`,
      why:
        "Cash is the right place for money that is needed soon and for the emergency buffer. Beyond that, a long horizon turns its safety into a cost: cash tends to roughly track inflation, so purchasing power stands still while invested money compounds. The usual reason for a large cash balance is not a decision but a pause — waiting for a better entry point, or simply not having got round to it.",
      evidence: [
        { label: "Cash held", value: formatPercent(cashWeight), detail: formatCurrency(cashWeight * total, currency) },
        { label: "Reference cash", value: formatPercent(referenceCash), detail: "emergency buffer and near-term spending only" },
        { label: "Horizon", value: `${years} years` },
        { label: "Illustrative difference", value: formatCurrency(forgone, currency), detail: `on the excess over ${years} years, comparing a 5% return against 2% — an illustration, not a forecast` },
      ],
      learnSlug: "cash-drag",
      implementation: {
        objective: "Decide what the cash is for, then either name it or invest it.",
        gapValue: excessValue,
        routes: [
          { label: "Name every pot", detail: "Emergency buffer, known spending in the next two years, and everything else. Only the third pot is really a portfolio question." },
          { label: "Invest on a schedule, not on a view", detail: "Splitting the balance into fixed instalments on set dates removes the need to pick a moment. It usually lags investing at once, and it is far easier to stick to." },
          ...routesToClose(excessValue, ctx.profile, null).slice(-1),
        ],
        screen: screenForExposure({ dimension: "assetClass", bucket: "equity", minPurity: 0.9, maxExpenseRatio: 0.0025, excludeSymbols: held, limit: 3 }),
        tradeoffs: ["Investing a large balance right before a fall is the scenario people regret most. A schedule does not avoid it, but it does make it survivable."],
      },
    });
  }

  // --- Emergency buffer, which sits in front of the portfolio rather than in it.
  if (ctx.profile.emergencyFundMonths < 3 && ctx.profile.monthlyEssentialSpend > 0) {
    const shortfall = (3 - ctx.profile.emergencyFundMonths) * ctx.profile.monthlyEssentialSpend;
    findings.push({
      id: "structure-emergency-fund",
      category: "structure",
      direction: "under",
      severity: materiality({ magnitude: 3 - ctx.profile.emergencyFundMonths, scaleAt: 3, valueShare: Math.min(1, shortfall / Math.max(total, 1)), weight: 1.25 }),
      title: `Emergency buffer covers ${ctx.profile.emergencyFundMonths} month${ctx.profile.emergencyFundMonths === 1 ? "" : "s"} of essential spending`,
      summary: `A ${formatCurrency(shortfall, currency)} shortfall against a three-month reference. Without a buffer in front of it, the portfolio becomes the emergency fund.`,
      why:
        "This is the one structural gap that changes everything else. With no buffer, an unexpected bill has to be met by selling — and the times you are most likely to need money unexpectedly are the times markets are most likely to be down. A buffer is what lets the rest of the portfolio be left alone, which is the entire basis on which a long horizon works.",
      evidence: [
        { label: "Buffer held", value: `${ctx.profile.emergencyFundMonths} months`, detail: formatCurrency(ctx.profile.emergencyFundMonths * ctx.profile.monthlyEssentialSpend, currency) },
        { label: "Three-month reference", value: formatCurrency(3 * ctx.profile.monthlyEssentialSpend, currency), detail: "a common starting point; stable income may need less, variable income more" },
        { label: "Shortfall", value: formatCurrency(shortfall, currency) },
      ],
      learnSlug: "emergency-buffer",
      implementation: {
        objective: "Build the buffer before adding to the portfolio.",
        gapValue: shortfall,
        routes: [
          { label: "Fund it from contributions first", detail: ctx.profile.monthlyContribution > 0 ? `At ${formatCurrency(ctx.profile.monthlyContribution, currency)} a month, about ${Math.ceil(shortfall / ctx.profile.monthlyContribution)} months of contributions would close it.` : "Redirect the next contributions to the buffer until it is covered." },
          { label: "Keep it genuinely accessible", detail: "Same-day or next-day access matters more than the interest rate. An instrument that has to be sold at an uncertain price is not a buffer." },
        ],
        screen: null,
        tradeoffs: ["Holding cash you could have invested has a real cost. It buys the ability to leave the portfolio untouched, which is worth more than it looks on a spreadsheet."],
      },
    });
  }

  // --- Bond sleeve duration against the horizon.
  const rateSleeve = exposure.assetClass.bond + exposure.assetClass.cash;
  if (rateSleeve > 0.1) {
    const durationGap = exposure.duration - ctx.reference.targetDuration;
    if (Math.abs(durationGap) > 3) {
      const long = durationGap > 0;
      findings.push({
        id: "structure-duration",
        category: "horizon",
        direction: long ? "over" : "under",
        severity: materiality({ magnitude: Math.abs(durationGap), scaleAt: 8, valueShare: rateSleeve }),
        title: `Bond duration is ${exposure.duration.toFixed(1)} years against a reference of ${ctx.reference.targetDuration.toFixed(1)}`,
        summary: long
          ? `A one-point rise in yields would cost roughly ${formatPercent(exposure.duration * 0.01, 1)} of the ${formatPercent(rateSleeve)} held in bonds and cash — about ${formatCurrency(exposure.duration * 0.01 * rateSleeve * total, currency)}.`
          : `The bond sleeve is shorter than the horizon suggests, which limits both its sensitivity to rates and the yield it locks in.`,
        why:
          "Duration is how much a bond's price moves when yields move: roughly, a one-point rise in yields costs one percent of value per year of duration. Matching duration to the horizon means a rate move changes the price and the reinvestment rate in roughly offsetting ways. A long-duration fund held for a short goal is a rate bet, whatever it says on the label.",
        evidence: [
          { label: "Your bond duration", value: `${exposure.duration.toFixed(1)} years` },
          { label: "Reference duration", value: `${ctx.reference.targetDuration.toFixed(1)} years`, detail: "about 60% of the horizon" },
          { label: "Bond and cash sleeve", value: formatPercent(rateSleeve), detail: formatCurrency(rateSleeve * total, currency) },
        ],
        learnSlug: "duration",
        implementation: {
          objective: "Align the bond sleeve's rate sensitivity with when the money is needed.",
          gapValue: null,
          routes: [
            { label: long ? "Shorten the sleeve" : "Extend the sleeve", detail: long ? "Shorter-dated government funds cut rate sensitivity without adding credit risk." : "Intermediate government funds raise duration while keeping credit risk out of the defensive sleeve." },
          ],
          screen: screenForExposure({
            dimension: "credit",
            bucket: "government",
            minPurity: 0.8,
            excludeSymbols: held,
            extraFilter: (e) => (long ? e.duration < exposure.duration - 2 : e.duration > exposure.duration + 2),
            extraFilterLabel: long ? "shorter duration than the current sleeve" : "longer duration than the current sleeve",
            limit: 3,
          }),
          tradeoffs: ["Shorter duration gives up yield and the cushion long bonds can provide in a sharp equity fall. Longer duration adds price swings."],
        },
      });
    }

    // --- High yield sitting in the sleeve that is supposed to be the ballast.
    const highYieldShare = rateSleeve > 0 ? exposure.credit.highYield / rateSleeve : 0;
    if (highYieldShare > 0.25) {
      findings.push({
        id: "structure-credit-quality",
        category: "structure",
        direction: "over",
        severity: materiality({ magnitude: highYieldShare - 0.25, scaleAt: 0.5, valueShare: exposure.credit.highYield }),
        title: `${formatPercent(highYieldShare)} of the defensive sleeve is high yield`,
        summary: `High-yield bonds are ${formatPercent(exposure.credit.highYield)} of the portfolio. They pay more than government bonds because they can default, and they tend to fall alongside equities rather than against them.`,
        why:
          "The job of a defensive sleeve is to hold its value when equities do not. High-yield credit does not do that reliably — its price is driven by the same economic conditions that drive company earnings, so it has historically fallen at the same time as shares. Counting it as ballast overstates how defensive a portfolio really is.",
        evidence: [
          { label: "High yield held", value: formatPercent(exposure.credit.highYield), detail: formatCurrency(exposure.credit.highYield * total, currency) },
          { label: "Share of defensive sleeve", value: formatPercent(highYieldShare) },
          { label: "Reference", value: "0%", detail: "the reference sleeve is government and investment grade only" },
        ],
        learnSlug: "credit-risk",
        implementation: {
          objective: "Decide whether the extra yield is being counted as income or mistaken for safety.",
          gapValue: exposure.credit.highYield * total,
          routes: [
            { label: "Treat it as part of the growth sleeve", detail: "If the exposure is wanted, counting it alongside equities rather than bonds gives a truer picture of how much risk the portfolio carries." },
            { label: "Or replace it with government bonds", detail: "A government or investment-grade fund gives up yield and buys back the equity-drawdown cushion." },
          ],
          screen: screenForExposure({ dimension: "credit", bucket: "government", minPurity: 0.8, excludeSymbols: held, limit: 3 }),
          tradeoffs: ["High-yield spreads have historically compensated buyers over full cycles. The issue is the timing of the losses, not the long-run return."],
        },
      });
    }
  }

  return findings;
}
