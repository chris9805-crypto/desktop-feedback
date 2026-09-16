import { aggregateExposure, buildExposure } from "./exposure";
import type { DiversificationStats, Portfolio, PortfolioMetrics } from "./types";

/** Long-run volatility of a broad equity index, used as the single market factor. */
const MARKET_VOLATILITY = 0.16;

/**
 * Single-factor risk model.
 *
 * Value-weighting each holding's own volatility would ignore diversification
 * entirely and overstate portfolio risk. Splitting each holding into a market
 * component (which adds up) and an idiosyncratic component (which cancels out
 * across holdings) gets the shape right: adding a 30th stock barely moves the
 * number, while doubling up on one name does.
 */
function estimateVolatility(portfolio: Portfolio): { volatility: number; beta: number } {
  if (portfolio.totalValue <= 0) return { volatility: 0, beta: 0 };

  let beta = 0;
  let idiosyncraticVariance = 0;

  for (const position of portfolio.positions) {
    const w = position.weight;
    const s = position.security;
    beta += w * s.beta;
    const systematic = s.beta * MARKET_VOLATILITY;
    const idio = Math.max(s.volatility3y ** 2 - systematic ** 2, 0);
    idiosyncraticVariance += w ** 2 * idio;
  }

  const variance = (beta * MARKET_VOLATILITY) ** 2 + idiosyncraticVariance;
  return { volatility: Math.sqrt(variance), beta };
}

/**
 * Concentration measured through funds, not just at the ticker level.
 *
 * Disclosed top holdings are counted by name. The rest of each fund is modelled
 * as `holdingsCount - disclosed` equally sized positions, which keeps the
 * Herfindahl index honest: without that residual term, a 3,600-stock index fund
 * would look as concentrated as its ten largest holdings.
 */
function diversification(portfolio: Portfolio): DiversificationStats {
  const names = new Map<string, number>();
  let residualHhi = 0;
  let residualNames = 0;

  for (const position of portfolio.positions) {
    const w = position.weight;
    const exposure = buildExposure(position.security);
    let disclosed = 0;
    for (const [symbol, share] of Object.entries(exposure.lookThrough)) {
      names.set(symbol, (names.get(symbol) ?? 0) + share * w);
      disclosed += share;
    }

    if (position.security.kind === "etf") {
      const equityish = exposure.assetClass.equity + exposure.assetClass.realEstate;
      const residualShare = Math.max(equityish - disclosed, 0);
      const undisclosedCount = Math.max(position.security.fund.holdingsCount - position.security.topHoldings.length, 1);
      if (residualShare > 0) {
        // n positions of size (w * residual / n) contribute (w * residual)^2 / n.
        residualHhi += (w * residualShare) ** 2 / undisclosedCount;
        residualNames += undisclosedCount;
      }
    }
  }

  const weights = [...names.values()].sort((a, b) => b - a);
  const hhi = weights.reduce((a, w) => a + w * w, 0) + residualHhi;

  return {
    positionCount: portfolio.positions.length,
    lookThroughNameCount: names.size + residualNames,
    topHoldingWeight: weights[0] ?? 0,
    topTenWeight: weights.slice(0, 10).reduce((a, b) => a + b, 0),
    herfindahl: hhi,
    effectiveNames: hhi > 0 ? 1 / hhi : 0,
  };
}

export function computeMetrics(portfolio: Portfolio): PortfolioMetrics {
  const exposure = aggregateExposure(portfolio.positions, portfolio.cash, portfolio.totalValue, portfolio.baseCurrency);
  const { volatility, beta } = estimateVolatility(portfolio);

  const stockPositions = portfolio.positions.filter((p) => p.security.kind === "stock");
  const stockWeight = stockPositions.reduce((a, p) => a + p.weight, 0);
  const stockSleeve = stockWeight > 0
    ? {
        weight: stockWeight,
        returnOnInvestedCapital: weighted(stockPositions, (p) => p.security.kind === "stock" ? p.security.fundamentals.returnOnInvestedCapital : 0, stockWeight),
        netDebtToEbitda: weighted(stockPositions, (p) => p.security.kind === "stock" ? p.security.fundamentals.netDebtToEbitda : 0, stockWeight),
        freeCashFlowYield: weighted(stockPositions, (p) => p.security.kind === "stock" ? p.security.valuation.freeCashFlowYield : 0, stockWeight),
        priceEarnings: weighted(stockPositions, (p) => p.security.kind === "stock" ? p.security.valuation.priceEarnings : 0, stockWeight),
      }
    : null;

  const lookThrough = Object.entries(exposure.lookThrough)
    .map(([symbol, weight]) => ({
      symbol,
      name: nameFor(symbol, portfolio),
      weight,
      value: weight * portfolio.totalValue,
    }))
    .sort((a, b) => b.weight - a.weight);

  return {
    exposure,
    diversification: diversification(portfolio),
    lookThrough,
    weightedExpenseRatio: exposure.expenseRatio,
    annualCost: exposure.expenseRatio * portfolio.totalValue,
    estimatedVolatility: volatility,
    weightedBeta: beta,
    stockSleeve,
  };
}

function weighted<T extends { weight: number }>(items: T[], pick: (item: T) => number, total: number): number {
  if (total <= 0) return 0;
  return items.reduce((a, item) => a + pick(item) * item.weight, 0) / total;
}

function nameFor(symbol: string, portfolio: Portfolio): string {
  for (const position of portfolio.positions) {
    if (position.symbol === symbol) return position.security.name;
    if (position.security.kind === "etf") {
      const hit = position.security.topHoldings.find((h) => h.symbol === symbol);
      if (hit) return hit.name;
    }
  }
  return symbol;
}
