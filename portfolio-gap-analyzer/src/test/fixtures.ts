import { buildPortfolio } from "@/lib/engine/portfolio";
import type { InvestorProfile } from "@/lib/engine/types";

export const BASE_PROFILE: InvestorProfile = {
  baseCurrency: "USD",
  homeRegion: "us",
  goal: "retirement",
  horizonYears: 25,
  riskTolerance: 3,
  monthlyContribution: 1000,
  emergencyFundMonths: 6,
  monthlyEssentialSpend: 3000,
  incomeNeedRate: 0,
  taxWrapper: "taxAdvantaged",
  homeBiasAllowancePp: 0,
  inflationConcern: 1,
};

export function profile(overrides: Partial<InvestorProfile> = {}): InvestorProfile {
  return { ...BASE_PROFILE, ...overrides };
}

/** A concentrated US technology portfolio, the shape this tool exists to describe. */
export const TECH_HEAVY = () =>
  buildPortfolio(
    [
      { symbol: "QQQ", value: 40000 },
      { symbol: "VUG", value: 25000 },
      { symbol: "NVDA", value: 15000 },
      { symbol: "AAPL", value: 12000 },
      { symbol: "MSFT", value: 8000 },
    ],
    { baseCurrency: "USD" },
  );

/** Two funds tracking the same index, one materially dearer. */
export const DUPLICATED = () =>
  buildPortfolio(
    [
      { symbol: "VOO", value: 50000 },
      { symbol: "SPY", value: 50000 },
    ],
    { baseCurrency: "USD" },
  );

/** A broadly diversified portfolio close to the market. */
export const BALANCED = () =>
  buildPortfolio(
    [
      { symbol: "VT", value: 65000 },
      { symbol: "BND", value: 30000 },
      { symbol: "SGOV", value: 5000 },
    ],
    { baseCurrency: "USD" },
  );
