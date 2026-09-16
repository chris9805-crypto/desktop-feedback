"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DisclaimerFooter } from "@/components/Disclaimer";
import { Button, Card, Field, Pill, SectionHeading, inputClass } from "@/components/ui";
import { SECURITIES } from "@/lib/data/securities";
import { qualityScore, valuationScore } from "@/lib/engine/scores";
import { SECTORS, type Sector, type Security } from "@/lib/engine/types";
import { formatCompactCurrency, formatPercent, label } from "@/lib/format";

/** Enough rows to scan without scrolling past the filters that produced them. */
const PAGE_SIZE = 30;

type Kind = "all" | "etf" | "stock";
type SortKey = "name" | "cost" | "yield" | "size" | "quality" | "value";

const SORTS: { id: SortKey; label: string; appliesTo: Kind }[] = [
  { id: "name", label: "Name", appliesTo: "all" },
  { id: "size", label: "Size", appliesTo: "all" },
  { id: "yield", label: "Yield", appliesTo: "all" },
  { id: "cost", label: "Ongoing charge", appliesTo: "etf" },
  { id: "quality", label: "Quality score", appliesTo: "stock" },
  { id: "value", label: "Valuation score", appliesTo: "stock" },
];

function yieldOf(security: Security): number {
  return security.kind === "etf" ? security.yield : security.fundamentals.dividendYield;
}

function sizeOf(security: Security): number {
  return security.kind === "etf" ? security.fund.aumUsd : security.marketCapUsd;
}

export default function ResearchPage() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [sector, setSector] = useState<Sector | "all">("all");
  const [sort, setSort] = useState<SortKey>("size");
  const [maxCost, setMaxCost] = useState(100);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SECURITIES.filter((security) => {
      if (kind !== "all" && security.kind !== kind) return false;
      if (q && !security.symbol.toLowerCase().includes(q) && !security.name.toLowerCase().includes(q)) return false;
      if (sector !== "all") {
        if (security.kind === "stock" && security.sector !== sector) return false;
        if (security.kind === "etf" && (security.breakdown.sector?.[sector] ?? 0) < 0.3) return false;
      }
      if (security.kind === "etf" && security.fund.expenseRatio * 10000 > maxCost) return false;
      return true;
    }).sort((a, b) => {
      switch (sort) {
        case "name":
          return a.symbol.localeCompare(b.symbol);
        case "yield":
          return yieldOf(b) - yieldOf(a);
        case "cost":
          return (a.kind === "etf" ? a.fund.expenseRatio : 1) - (b.kind === "etf" ? b.fund.expenseRatio : 1);
        case "quality":
          return (b.kind === "stock" ? qualityScore(b).score : -1) - (a.kind === "stock" ? qualityScore(a).score : -1);
        case "value":
          return (b.kind === "stock" ? valuationScore(b).score : -1) - (a.kind === "stock" ? valuationScore(a).score : -1);
        default:
          return sizeOf(b) - sizeOf(a);
      }
    });
  }, [query, kind, sector, sort, maxCost]);

  const visible = rows.slice(0, limit);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text)]">Research</h1>
        <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[var(--text-muted)]">
          Filter the bundled universe of funds and companies. The scores are arithmetic summaries of published metrics,
          shown next to the inputs that produced them — they rank companies on a fixed scale, and nothing more than that.
        </p>
      </div>

      <Card className="p-5">
        <SectionHeading title="Filters" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Search">
            <input
              className={inputClass}
              value={query}
              onChange={(event) => { setQuery(event.target.value); setLimit(PAGE_SIZE); }}
              placeholder="Ticker or name"
            />
          </Field>
          <Field label="Instrument type">
            <select className={inputClass} value={kind} onChange={(event) => { setKind(event.target.value as Kind); setLimit(PAGE_SIZE); }}>
              <option value="all">All</option>
              <option value="etf">ETFs</option>
              <option value="stock">Companies</option>
            </select>
          </Field>
          <Field label="Sector" hint="For funds, at least 30% in the sector">
            <select
              className={inputClass}
              value={sector}
              onChange={(event) => { setSector(event.target.value as Sector | "all"); setLimit(PAGE_SIZE); }}
            >
              <option value="all">Any</option>
              {SECTORS.map((key) => (
                <option key={key} value={key}>
                  {label(key)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sort by">
            <select className={inputClass} value={sort} onChange={(event) => { setSort(event.target.value as SortKey); setLimit(PAGE_SIZE); }}>
              {SORTS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {kind !== "stock" ? (
          <div className="mt-4 max-w-sm">
            <Field label={`Maximum ongoing charge: ${maxCost >= 100 ? "any" : `${maxCost}bps`}`}>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={maxCost}
                onChange={(event) => { setMaxCost(Number(event.target.value)); setLimit(PAGE_SIZE); }}
                className="w-full accent-[var(--accent)]"
              />
            </Field>
          </div>
        ) : null}
      </Card>

      <Card>
        <div className="border-b border-[var(--border)] px-5 py-3 text-[12.5px] text-[var(--text-muted)]">
          Showing {visible.length} of {rows.length} result{rows.length === 1 ? "" : "s"}, from {SECURITIES.length}{" "}
          instruments in the bundled universe
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
                <th className="px-5 py-2.5 font-medium">Instrument</th>
                <th className="px-3 py-2.5 font-medium">Type</th>
                <th className="px-3 py-2.5 text-right font-medium">Size</th>
                <th className="px-3 py-2.5 text-right font-medium">Yield</th>
                <th className="px-3 py-2.5 text-right font-medium">Charge</th>
                <th className="px-3 py-2.5 text-right font-medium">Quality</th>
                <th className="px-5 py-2.5 text-right font-medium">Valuation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {visible.map((security) => (
                <tr key={security.symbol} className="hover:bg-[var(--surface-2)]">
                  <td className="px-5 py-2.5">
                    <Link href={`/research/${security.symbol}`} className="font-semibold text-[var(--text)] hover:underline">
                      {security.symbol}
                    </Link>
                    <div className="text-[12px] text-[var(--text-muted)]">{security.name}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <Pill tone={security.kind === "etf" ? "accent" : "neutral"}>
                      {security.kind === "etf" ? "ETF" : label(security.sector)}
                    </Pill>
                  </td>
                  <td className="tnum px-3 py-2.5 text-right text-[var(--text-muted)]">
                    {formatCompactCurrency(sizeOf(security), "USD")}
                  </td>
                  <td className="tnum px-3 py-2.5 text-right">{formatPercent(yieldOf(security))}</td>
                  <td className="tnum px-3 py-2.5 text-right">
                    {security.kind === "etf" ? formatPercent(security.fund.expenseRatio, 2) : "—"}
                  </td>
                  <td className="tnum px-3 py-2.5 text-right">
                    {security.kind === "stock" ? qualityScore(security).score : "—"}
                  </td>
                  <td className="tnum px-5 py-2.5 text-right">
                    {security.kind === "stock" ? valuationScore(security).score : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-[var(--text-muted)]">
            Nothing matches those filters. Widen one of them.
          </p>
        ) : null}
        {visible.length < rows.length ? (
          <div className="border-t border-[var(--border)] px-5 py-3.5 text-center">
            <Button variant="secondary" onClick={() => setLimit((value) => value + PAGE_SIZE)}>
              Show {Math.min(PAGE_SIZE, rows.length - visible.length)} more
            </Button>
          </div>
        ) : null}
      </Card>

      <DisclaimerFooter />
    </div>
  );
}
