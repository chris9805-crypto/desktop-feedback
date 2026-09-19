"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DisclaimerFooter } from "@/components/Disclaimer";
import { FeeCheck } from "@/components/FeeCheck";
import { Button, Card, Field, Pill, SectionHeading, inputClass } from "@/components/ui";
import { SECURITIES } from "@/lib/data/securities";
import { growthScore, qualityScore, valuationScore } from "@/lib/engine/scores";
import { SECTORS, type Sector, type Security } from "@/lib/engine/types";
import { formatCompactCurrency, formatPercent, label } from "@/lib/format";

/** Enough rows to scan without scrolling past the filters that produced them. */
const PAGE_SIZE = 30;

type Kind = "all" | "etf" | "stock";
type SortKey = "name" | "cost" | "yield" | "size" | "quality" | "value" | "growth" | "momentum";

/**
 * The table's columns, each sortable. `numeric` columns default to
 * highest-first, because that is what someone means by "sort by yield".
 * `missing` is what a column reads when it does not apply — ETFs have no
 * quality score, companies have no ongoing charge — and those rows always sort
 * to the bottom rather than jumping to the top on an ascending sort.
 */
const COLUMNS: { id: SortKey | null; label: string; align?: "right"; numeric?: boolean }[] = [
  { id: "name", label: "Instrument" },
  { id: null, label: "Type" },
  { id: "size", label: "Size", align: "right", numeric: true },
  { id: "yield", label: "Yield", align: "right", numeric: true },
  { id: "cost", label: "Charge", align: "right" },
  { id: "momentum", label: "12m return", align: "right", numeric: true },
  { id: "quality", label: "Quality", align: "right", numeric: true },
  { id: "growth", label: "Growth", align: "right", numeric: true },
  { id: "value", label: "Valuation", align: "right", numeric: true },
];

function yieldOf(security: Security): number {
  return security.kind === "etf" ? security.yield : security.fundamentals.dividendYield;
}

function sizeOf(security: Security): number {
  return security.kind === "etf" ? security.fund.aumUsd : security.marketCapUsd;
}

/** The value a column sorts on, or null where the column does not apply. */
function sortValue(s: Security, key: SortKey): number | null {
  switch (key) {
    case "size":
      return sizeOf(s);
    case "yield":
      return yieldOf(s);
    case "momentum":
      return s.trailing.return12m;
    case "cost":
      return s.kind === "etf" ? s.fund.expenseRatio : null;
    case "quality":
      return s.kind === "stock" ? qualityScore(s).score : null;
    case "growth":
      return s.kind === "stock" ? growthScore(s).score : null;
    case "value":
      return s.kind === "stock" ? valuationScore(s).score : null;
    default:
      return null;
  }
}

export default function ResearchPage() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [sector, setSector] = useState<Sector | "all">("all");
  const [sort, setSort] = useState<SortKey>("size");
  const [descending, setDescending] = useState(true);
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
      if (sort === "name") {
        const order = a.symbol.localeCompare(b.symbol);
        return descending ? -order : order;
      }
      const av = sortValue(a, sort);
      const bv = sortValue(b, sort);
      // Rows where the column does not apply sink to the bottom either way.
      if (av === null && bv === null) return a.symbol.localeCompare(b.symbol);
      if (av === null) return 1;
      if (bv === null) return -1;
      return descending ? bv - av : av - bv;
    });
  }, [query, kind, sector, sort, descending, maxCost]);

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

      <FeeCheck currency="USD" />

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
          <Field label="Sorting" hint="Click any column heading in the table below">
            <div className={`${inputClass} flex items-center justify-between gap-2`}>
              <span>{COLUMNS.find((c) => c.id === sort)?.label ?? "Size"}</span>
              <button
                type="button"
                onClick={() => setDescending((value) => !value)}
                className="text-[12px] text-[var(--accent-text)] hover:underline"
              >
                {descending ? "Highest first" : "Lowest first"}
              </button>
            </div>
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
                {COLUMNS.map((column, index) => {
                  const active = column.id !== null && column.id === sort;
                  const padding = index === 0 ? "px-5" : index === COLUMNS.length - 1 ? "px-5" : "px-3";
                  return (
                    <th
                      key={column.label}
                      scope="col"
                      aria-sort={active ? (descending ? "descending" : "ascending") : undefined}
                      className={`${padding} py-2.5 font-medium ${column.align === "right" ? "text-right" : ""}`}
                    >
                      {column.id === null ? (
                        column.label
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (active) setDescending((value) => !value);
                            else {
                              setSort(column.id as SortKey);
                              setDescending(column.numeric !== false);
                            }
                            setLimit(PAGE_SIZE);
                          }}
                          className={`inline-flex items-center gap-1 uppercase tracking-wide hover:text-[var(--text)] ${
                            active ? "text-[var(--accent-text)]" : ""
                          }`}
                        >
                          {column.label}
                          <span aria-hidden="true" className={active ? "" : "opacity-0"}>
                            {descending ? "▾" : "▴"}
                          </span>
                        </button>
                      )}
                    </th>
                  );
                })}
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
                  <td
                    className="tnum px-3 py-2.5 text-right"
                    style={{ color: security.trailing.return12m >= 0 ? "var(--under)" : "var(--over)" }}
                  >
                    {formatPercent(security.trailing.return12m, 1)}
                  </td>
                  <td className="tnum px-3 py-2.5 text-right">
                    {security.kind === "stock" ? qualityScore(security).score : "—"}
                  </td>
                  <td className="tnum px-3 py-2.5 text-right">
                    {security.kind === "stock" ? growthScore(security).score : "—"}
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
