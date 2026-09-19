import { analysePortfolio } from "./analyse";
import { buildPortfolio } from "./portfolio";
import type { ReferenceOverrides } from "./reference";
import { SECTORS, type AnalysisReport, type Finding, type HoldingInput, type InvestorProfile, type Sector } from "./types";

/**
 * What a thematic sleeve does to the gap report.
 *
 * A theme page that only lists matching names is a shopping list. The point of
 * putting one inside this tool is that the rest of the app already measures
 * concentration, sector drift, cost and overlap — so a sleeve can be shown as a
 * change to those numbers rather than as an idea in isolation.
 *
 * The sleeve is funded pro-rata out of everything currently held, which is the
 * only assumption that does not quietly invent new money. Cash is left alone:
 * emergency-fund cash is not spending money, and the structure detectors treat
 * it as a separate question.
 */
export interface ThemeSleeve {
  /** Symbols the user picked from the theme's matches. */
  symbols: string[];
  /** Share of the portfolio the sleeve should occupy, 0-1. */
  share: number;
}

export interface ImpactSnapshot {
  topTenWeight: number;
  effectiveNames: number;
  expenseRatio: number;
  annualCost: number;
  estimatedVolatility: number;
  sector: Record<Sector, number>;
  /** Count of findings, as a crude "how much is flagged" line. */
  findingCount: number;
}

export interface SectorShift {
  sector: Sector;
  before: number;
  after: number;
  delta: number;
}

export interface ThemeImpact {
  /** False when there is nothing to compare against — no holdings, or nothing picked. */
  applicable: boolean;
  before: ImpactSnapshot;
  after: ImpactSnapshot;
  /** Sector moves of at least 0.5pp, largest absolute move first. */
  sectorShifts: SectorShift[];
  /** Findings the sleeve would introduce, and ones it would clear. */
  added: Finding[];
  resolved: Finding[];
  /** The holdings list the sleeve produces, ready to save. */
  holdings: HoldingInput[];
}

function snapshot(report: AnalysisReport): ImpactSnapshot {
  const sector = {} as Record<Sector, number>;
  for (const key of SECTORS) sector[key] = report.metrics.exposure.sector[key] ?? 0;
  return {
    topTenWeight: report.metrics.diversification.topTenWeight,
    effectiveNames: report.metrics.diversification.effectiveNames,
    expenseRatio: report.metrics.weightedExpenseRatio,
    annualCost: report.metrics.annualCost,
    estimatedVolatility: report.metrics.estimatedVolatility,
    sector,
    findingCount: report.findings.length,
  };
}

/**
 * Scale existing lines down to make room, then split the sleeve evenly across
 * the picked names. An even split is a deliberate non-choice: weighting the
 * names would be a recommendation about which of them deserves more.
 */
export function applySleeve(holdings: HoldingInput[], totalValue: number, sleeve: ThemeSleeve): HoldingInput[] {
  const symbols = [...new Set(sleeve.symbols.map((s) => s.toUpperCase()))];
  if (symbols.length === 0 || sleeve.share <= 0 || totalValue <= 0) return holdings;

  const share = Math.min(0.9, sleeve.share);
  const perName = (totalValue * share) / symbols.length;
  const scale = 1 - share;

  const scaled = holdings.map((holding) => ({
    ...holding,
    ...(typeof holding.value === "number" ? { value: holding.value * scale } : {}),
    ...(typeof holding.quantity === "number" ? { quantity: holding.quantity * scale } : {}),
    ...(typeof holding.percent === "number" ? { percent: holding.percent * scale } : {}),
  }));

  const merged: HoldingInput[] = [];
  const claimed = new Set<string>();
  for (const holding of scaled) {
    const symbol = holding.symbol.toUpperCase();
    if (symbols.includes(symbol)) {
      // Already held: top the line up to its sleeve size rather than duplicating it.
      claimed.add(symbol);
      merged.push({ ...holding, value: (holding.value ?? 0) + perName, quantity: undefined, percent: undefined });
    } else {
      merged.push(holding);
    }
  }
  for (const symbol of symbols) {
    if (!claimed.has(symbol)) merged.push({ symbol, value: perName });
  }
  return merged;
}

export interface ThemeImpactInput {
  holdings: HoldingInput[];
  cash: number;
  totalValueHint?: number;
  profile: InvestorProfile;
  referenceOverrides?: ReferenceOverrides;
  sleeve: ThemeSleeve;
}

export function themeImpact(input: ThemeImpactInput): ThemeImpact {
  const options = {
    cash: input.cash,
    baseCurrency: input.profile.baseCurrency,
    totalValueHint: input.totalValueHint ?? 0,
  };
  const analyse = (holdings: HoldingInput[]) =>
    analysePortfolio(buildPortfolio(holdings, options), input.profile, {
      referenceOverrides: input.referenceOverrides ?? {},
    });

  const before = analyse(input.holdings);
  // Invested value only: the sleeve is funded from holdings, not from cash.
  const invested = before.portfolio.positions.reduce((total, position) => total + position.value, 0);
  const holdings = applySleeve(input.holdings, invested, input.sleeve);
  const after = analyse(holdings);

  const beforeIds = new Set(before.findings.map((f) => f.id));
  const afterIds = new Set(after.findings.map((f) => f.id));

  const beforeSnapshot = snapshot(before);
  const afterSnapshot = snapshot(after);
  const sectorShifts = SECTORS.map((sector) => ({
    sector,
    before: beforeSnapshot.sector[sector],
    after: afterSnapshot.sector[sector],
    delta: afterSnapshot.sector[sector] - beforeSnapshot.sector[sector],
  }))
    .filter((shift) => Math.abs(shift.delta) >= 0.005)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return {
    applicable: invested > 0 && input.sleeve.symbols.length > 0 && input.sleeve.share > 0,
    before: beforeSnapshot,
    after: afterSnapshot,
    sectorShifts,
    added: after.findings.filter((f) => !beforeIds.has(f.id)),
    resolved: before.findings.filter((f) => !afterIds.has(f.id)),
    holdings,
  };
}
