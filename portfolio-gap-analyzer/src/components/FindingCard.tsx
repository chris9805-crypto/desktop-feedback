"use client";

import { useState } from "react";
import { CandidateTable } from "@/components/CandidateTable";
import { Callout, LearnLink, Pill } from "@/components/ui";
import type { Currency, Finding } from "@/lib/engine/types";
import { formatCurrency } from "@/lib/format";

const CATEGORY_LABEL: Record<Finding["category"], string> = {
  allocation: "Allocation",
  concentration: "Concentration",
  overlap: "Duplication",
  cost: "Cost",
  factor: "Tilt",
  income: "Income",
  horizon: "Horizon",
  currency: "Currency",
  quality: "Company quality",
  liquidity: "Liquidity",
  structure: "Structure",
};

export function FindingCard({ finding, currency }: { finding: Finding; currency: Currency }) {
  const [open, setOpen] = useState(false);
  const tone = finding.direction === "over" ? "over" : finding.direction === "under" ? "under" : "neutral";

  return (
    <article className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-start gap-4 p-5 text-left hover:bg-[var(--surface-2)]"
      >
        <span
          className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
          style={{
            background: tone === "over" ? "var(--over-soft)" : tone === "under" ? "var(--under-soft)" : "var(--surface-3)",
            color: tone === "over" ? "var(--over)" : tone === "under" ? "var(--under)" : "var(--text-muted)",
          }}
          aria-hidden="true"
        >
          {finding.severity}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <Pill tone={tone === "neutral" ? "neutral" : tone}>{CATEGORY_LABEL[finding.category]}</Pill>
            <h3 className="text-[14.5px] font-semibold text-[var(--text)]">{finding.title}</h3>
          </span>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-muted)]">{finding.summary}</p>
        </span>
        <span className="mt-1 shrink-0 text-[12px] text-[var(--text-faint)]" aria-hidden="true">
          {open ? "Hide" : "Detail"}
        </span>
      </button>

      {open ? (
        <div className="space-y-5 border-t border-[var(--border)] px-5 py-5">
          <section>
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">The numbers</h4>
            <dl className="mt-2.5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {finding.evidence.map((item) => (
                <div key={`${item.label}-${item.value}`} className="border-l-2 border-[var(--border)] pl-3">
                  <dt className="text-[11.5px] text-[var(--text-muted)]">{item.label}</dt>
                  <dd className="tnum text-[14px] font-semibold text-[var(--text)]">{item.value}</dd>
                  {item.detail ? <dd className="mt-0.5 text-[11.5px] leading-snug text-[var(--text-faint)]">{item.detail}</dd> : null}
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">Why this measure matters</h4>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-muted)]">{finding.why}</p>
            {finding.learnSlug ? (
              <div className="mt-2.5">
                <LearnLink slug={finding.learnSlug}>Read more on this</LearnLink>
              </div>
            ) : null}
          </section>

          {finding.implementation ? (
            <section className="space-y-4">
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
                  Ways this gap could be closed
                </h4>
                <p className="mt-2 text-[13px] font-medium text-[var(--text)]">{finding.implementation.objective}</p>
                {finding.implementation.gapValue !== null ? (
                  <p className="tnum mt-1 text-[12.5px] text-[var(--text-muted)]">
                    Size of the gap: {formatCurrency(finding.implementation.gapValue, currency)}
                  </p>
                ) : null}
              </div>

              <ul className="space-y-3">
                {finding.implementation.routes.map((route) => (
                  <li key={route.label} className="rounded-lg bg-[var(--surface-2)] px-4 py-3">
                    <div className="text-[12.5px] font-semibold text-[var(--text)]">{route.label}</div>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-muted)]">{route.detail}</p>
                  </li>
                ))}
              </ul>

              {finding.implementation.screen ? <CandidateTable screen={finding.implementation.screen} /> : null}

              {finding.implementation.tradeoffs.length > 0 ? (
                <Callout title="What you give up either way">
                  <ul className="space-y-1.5">
                    {finding.implementation.tradeoffs.map((tradeoff) => (
                      <li key={tradeoff} className="flex gap-2">
                        <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--text-faint)]" aria-hidden="true" />
                        {tradeoff}
                      </li>
                    ))}
                  </ul>
                </Callout>
              ) : null}
            </section>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
