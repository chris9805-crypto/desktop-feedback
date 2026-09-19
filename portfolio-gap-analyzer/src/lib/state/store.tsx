"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { analysePortfolio } from "@/lib/engine/analyse";
import { buildPortfolio } from "@/lib/engine/portfolio";
import type { ReferenceOverrides } from "@/lib/engine/reference";
import type { AnalysisReport, HoldingInput, InvestorProfile } from "@/lib/engine/types";

/**
 * Everything lives in the browser.
 *
 * Holdings and the investor profile are the most sensitive things this tool
 * touches, and there is no analytical reason for them to leave the device: the
 * whole engine is pure TypeScript and runs client-side against a bundled
 * security master. Persisting to localStorage rather than to a server keeps
 * that guarantee simple enough to verify by reading this file.
 */
const STORAGE_KEY = "pga.state.v1";

export interface AppState {
  holdings: HoldingInput[];
  cash: number;
  totalValueHint: number;
  profile: InvestorProfile;
  referenceOverrides: ReferenceOverrides;
  /** Only the return assumption is user-settable; the rest is derived. */
  projectionOverrides: { realReturn?: number };
  /** Set once the user has acknowledged what this tool is and is not. */
  disclaimerAccepted: boolean;
}

export const DEFAULT_PROFILE: InvestorProfile = {
  baseCurrency: "USD",
  homeRegion: "us",
  goal: "retirement",
  horizonYears: 22,
  riskTolerance: 3,
  monthlyContribution: 800,
  emergencyFundMonths: 4,
  monthlyEssentialSpend: 2800,
  incomeNeedRate: 0,
  taxWrapper: "mixed",
  homeBiasAllowancePp: 0,
  inflationConcern: 1,
};

/** A worked example, so the report has something to show before anything is typed. */
export const SAMPLE_HOLDINGS: HoldingInput[] = [
  { symbol: "VOO", value: 42000 },
  { symbol: "QQQ", value: 26000 },
  { symbol: "SPY", value: 14000 },
  { symbol: "NVDA", value: 11000 },
  { symbol: "AAPL", value: 9000 },
  { symbol: "MSFT", value: 7000 },
  { symbol: "SCHD", value: 6000 },
  { symbol: "BND", value: 5000 },
];

export const EMPTY_STATE: AppState = {
  holdings: [],
  cash: 0,
  totalValueHint: 0,
  profile: DEFAULT_PROFILE,
  referenceOverrides: {},
  projectionOverrides: {},
  disclaimerAccepted: false,
};

export const SAMPLE_STATE: AppState = {
  ...EMPTY_STATE,
  holdings: SAMPLE_HOLDINGS,
  cash: 8000,
};

interface StoreValue {
  state: AppState;
  report: AnalysisReport;
  hasHoldings: boolean;
  /** True until localStorage has been read, so the UI can avoid a hydration flash. */
  loading: boolean;
  setHoldings: (holdings: HoldingInput[]) => void;
  setCash: (cash: number) => void;
  setTotalValueHint: (value: number) => void;
  setProfile: (patch: Partial<InvestorProfile>) => void;
  setReferenceOverrides: (overrides: ReferenceOverrides) => void;
  setProjectionReturn: (value: number | null) => void;
  acceptDisclaimer: () => void;
  loadSample: () => void;
  reset: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function readStored(): AppState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      ...EMPTY_STATE,
      ...parsed,
      profile: { ...DEFAULT_PROFILE, ...(parsed.profile ?? {}) },
      referenceOverrides: parsed.referenceOverrides ?? {},
      projectionOverrides: parsed.projectionOverrides ?? {},
    };
  } catch {
    // A corrupt or unreadable entry should not take the app down with it.
    return null;
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setState(readStored() ?? EMPTY_STATE);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (loading) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Private browsing and blocked site data both throw here. The app still
      // works for this session; it just will not remember anything.
    }
  }, [state, loading]);

  const patch = useCallback((next: Partial<AppState>) => setState((prev) => ({ ...prev, ...next })), []);

  const report = useMemo(() => {
    const portfolio = buildPortfolio(state.holdings, {
      cash: state.cash,
      baseCurrency: state.profile.baseCurrency,
      totalValueHint: state.totalValueHint,
    });
    return analysePortfolio(portfolio, state.profile, {
      referenceOverrides: state.referenceOverrides,
      projectionOverrides: state.projectionOverrides,
    });
  }, [state.holdings, state.cash, state.totalValueHint, state.profile, state.referenceOverrides, state.projectionOverrides]);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      report,
      loading,
      hasHoldings: state.holdings.length > 0,
      setHoldings: (holdings) => patch({ holdings }),
      setCash: (cash) => patch({ cash }),
      setTotalValueHint: (totalValueHint) => patch({ totalValueHint }),
      setProfile: (p) => setState((prev) => ({ ...prev, profile: { ...prev.profile, ...p } })),
      setReferenceOverrides: (referenceOverrides) => patch({ referenceOverrides }),
      setProjectionReturn: (value) => patch({ projectionOverrides: value === null ? {} : { realReturn: value } }),
      acceptDisclaimer: () => patch({ disclaimerAccepted: true }),
      loadSample: () => setState((prev) => ({ ...SAMPLE_STATE, disclaimerAccepted: prev.disclaimerAccepted })),
      reset: () => setState((prev) => ({ ...EMPTY_STATE, disclaimerAccepted: prev.disclaimerAccepted })),
    }),
    [state, report, loading, patch],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside a StoreProvider");
  return value;
}
