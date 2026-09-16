"use client";

import { useState } from "react";
import { GapBars, type GapRow } from "@/components/charts";
import { normaliseSleeve } from "@/lib/engine/exposure";
import { REGIONS, SECTORS, SIZE_BUCKETS, STYLE_BUCKETS, type AnalysisReport } from "@/lib/engine/types";
import { formatPercent, label } from "@/lib/format";

type Tab = "region" | "sector" | "size" | "style" | "currency";

const TABS: { id: Tab; label: string; note: string }[] = [
  { id: "region", label: "Geography", note: "As a share of your equity and property sleeve, so the comparison is not distorted by how much you hold in bonds." },
  { id: "sector", label: "Sector", note: "Sector weights drift as markets move. The reference is the global market's own sector mix." },
  { id: "size", label: "Company size", note: "Large, mid and small, at global market weights. Mid caps are the slice most often missing." },
  { id: "style", label: "Style", note: "Value, blend and growth. The market splits roughly into thirds; there is no reference model weight here beyond that." },
  { id: "currency", label: "Currency", note: "What currency your money is actually exposed to, against the one you will spend in." },
];

export function ExposureExplorer({ report }: { report: AnalysisReport }) {
  const [tab, setTab] = useState<Tab>("region");
  const active = TABS.find((t) => t.id === tab)!;

  const rows = buildRows(report, tab);

  return (
    <div>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Exposure dimension">
        {TABS.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`rounded-md px-3 py-1.5 text-[12.5px] transition-colors ${
              tab === item.id
                ? "bg-[var(--accent-soft)] font-medium text-[var(--accent-text)]"
                : "text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-[12.5px] leading-relaxed text-[var(--text-muted)]">{active.note}</p>
      <div className="mt-4">
        <GapBars rows={rows} threshold={tab === "size" ? 0.08 : tab === "sector" ? 0.06 : 0.05} />
      </div>
      <p className="mt-3 flex items-center gap-2 text-[11.5px] text-[var(--text-faint)]">
        <span className="inline-block h-3 w-[2px] bg-[var(--text)]" aria-hidden="true" />
        The tick mark is the reference weight.
      </p>
    </div>
  );
}

function buildRows(report: AnalysisReport, tab: Tab): GapRow[] {
  const exposure = report.metrics.exposure;

  if (tab === "currency") {
    const base = report.portfolio.baseCurrency;
    const entries = Object.entries(exposure.currency)
      .filter(([, weight]) => (weight ?? 0) > 0.004)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
    return entries.map(([code, weight]) => ({
      label: code === base ? `${code} (your spending currency)` : code,
      current: weight ?? 0,
      reference: 0,
    }));
  }

  if (tab === "style") {
    const current = normaliseSleeve(exposure.style, STYLE_BUCKETS);
    const marketStyle: Record<string, number> = { value: 0.31, blend: 0.38, growth: 0.31 };
    return STYLE_BUCKETS.map((key) => ({
      label: label(key),
      current: current[key],
      reference: marketStyle[key] ?? 0,
    }));
  }

  const keys = tab === "region" ? REGIONS : tab === "sector" ? SECTORS : SIZE_BUCKETS;
  const current = normaliseSleeve(exposure[tab] as Record<string, number>, keys);
  const reference = normaliseSleeve(report.reference[tab] as Record<string, number>, keys);
  return [...keys]
    .map((key) => ({ label: label(key), current: current[key] ?? 0, reference: reference[key] ?? 0 }))
    .sort((a, b) => b.current - a.current);
}

export function formatWeight(value: number): string {
  return formatPercent(value);
}
