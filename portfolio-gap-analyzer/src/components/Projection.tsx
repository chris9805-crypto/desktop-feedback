"use client";

import { useState } from "react";
import { Callout, Card, Field, SectionHeading, inputClass } from "@/components/ui";
import { buildFanChart } from "@/lib/chart";
import type { AnalysisReport } from "@/lib/engine/types";
import { formatCurrency, formatPercent } from "@/lib/format";

/**
 * An illustration of the range the reference mix has historically produced.
 *
 * Deliberately a band and never a single number: the median is one outcome out
 * of two thousand, and the distance between the edges is the content. The
 * return assumption is on the page and editable rather than buried, because a
 * projection whose assumption you cannot see is just an impressive number.
 */
export function ProjectionPanel({
  report,
  realReturn,
  onReturnChange,
}: {
  report: AnalysisReport;
  realReturn: number | null;
  onReturnChange: (value: number | null) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const projection = report.projection;
  const currency = report.portfolio.baseCurrency;
  const chart = buildFanChart(projection.points, currency, 640, 260);
  const years = projection.assumptions.years;
  const active = projection.points[hover ?? projection.points.length - 1]!;

  return (
    <Card className="p-5">
      <SectionHeading
        title={`What the ${report.reference.presetLabel} reference mix has historically ranged between`}
        description="A simulation of 2,000 paths, in today's money. It is not a forecast, and it illustrates the reference model rather than the holdings you actually own."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">Lower edge — 1 path in 10 below</div>
          <div className="tnum mt-1 text-[20px] font-semibold text-[var(--over)]">{formatCurrency(projection.final.p10, currency)}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">Middle outcome</div>
          <div className="tnum mt-1 text-[20px] font-semibold">{formatCurrency(projection.final.p50, currency)}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">Upper edge — 1 path in 10 above</div>
          <div className="tnum mt-1 text-[20px] font-semibold text-[var(--under)]">{formatCurrency(projection.final.p90, currency)}</div>
        </div>
      </div>
      <p className="mt-2 text-[12.5px] text-[var(--text-muted)]">
        After {years} years, against {formatCurrency(projection.final.contributed, currency)} of your own money paid in.
      </p>

      <figure className="mt-5">
        <svg
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          width="100%"
          role="img"
          aria-label={`Projected range for the reference mix over ${years} years, from ${formatCurrency(projection.final.p10, currency)} to ${formatCurrency(projection.final.p90, currency)} in today's money.`}
          style={{ maxWidth: "100%", display: "block", touchAction: "none" }}
          onMouseMove={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            const x = ((event.clientX - box.left) / box.width) * chart.width;
            setHover(chart.pointAt(x));
          }}
          onMouseLeave={() => setHover(null)}
        >
          {chart.yTicks.map((tick) => (
            <g key={tick.value}>
              <line x1={chart.plot.left} x2={chart.width - chart.plot.right} y1={tick.y} y2={tick.y} stroke="var(--border)" strokeWidth="1" />
              <text x={chart.plot.left - 8} y={tick.y + 3.5} textAnchor="end" fontSize="10" fill="var(--text-faint)" fontFamily="ui-monospace, monospace">
                {tick.label}
              </text>
            </g>
          ))}
          {chart.xTicks.map((tick) => (
            <text key={tick.value} x={tick.x} y={chart.height - 8} textAnchor="middle" fontSize="10" fill="var(--text-faint)" fontFamily="ui-monospace, monospace">
              {tick.label}
            </text>
          ))}

          <path d={chart.bandPath} fill="var(--accent)" fillOpacity="0.16" stroke="none" />
          <path d={chart.contributedPath} fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeDasharray="4 4" />
          <path d={chart.medianPath} fill="none" stroke="var(--accent)" strokeWidth="2" />

          {hover !== null ? (
            <g>
              <line x1={chart.xFor(active.year)} x2={chart.xFor(active.year)} y1={chart.plot.top} y2={chart.height - chart.plot.bottom} stroke="var(--border-strong)" strokeWidth="1" />
              <circle cx={chart.xFor(active.year)} cy={chart.yFor(active.p50)} r="4" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
            </g>
          ) : null}
        </svg>

        <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11.5px] text-[var(--text-muted)]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-3.5 rounded-[2px]" style={{ background: "var(--accent)", opacity: 0.26 }} aria-hidden="true" />
            10th–90th percentile
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-[2px] w-4" style={{ background: "var(--accent)" }} aria-hidden="true" />
            Median path
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-[2px] w-4" style={{ background: "var(--text-faint)" }} aria-hidden="true" />
            Money paid in
          </span>
          <span className="tnum ml-auto">
            {hover === null ? `At ${years} years` : active.year === 0 ? "Today" : `At ${active.year} year${active.year === 1 ? "" : "s"}`}:{" "}
            {formatCurrency(active.p10, currency)} – {formatCurrency(active.p90, currency)}, middle {formatCurrency(active.p50, currency)}
          </span>
        </figcaption>
      </figure>

      <div className="mt-5 grid gap-4 border-t border-[var(--border)] pt-4 sm:grid-cols-2">
        <Field
          label={`Real return assumption: ${formatPercent(projection.assumptions.realReturn)} a year`}
          hint={`${report.reference.presetLabel} blended with the bond sleeve at this model's weights, on long-run historical figures. After inflation. Change it and the whole range moves.`}
        >
          <input
            type="range"
            min={0}
            max={10}
            step={0.1}
            value={Math.round(projection.assumptions.realReturn * 1000) / 10}
            onChange={(event) => onReturnChange(Number(event.target.value) / 100)}
            className="w-full accent-[var(--accent)]"
            aria-label="Real return assumption"
          />
          {realReturn !== null ? (
            <button type="button" onClick={() => onReturnChange(null)} className="mt-1 text-[12px] text-[var(--accent-text)] hover:underline">
              Back to the historical figure
            </button>
          ) : null}
        </Field>
        <Field label="Volatility" hint="Derived from the reference mix, not set by you. It is what makes the band wide.">
          <input className={inputClass} value={formatPercent(projection.assumptions.volatility)} readOnly aria-readonly="true" />
        </Field>
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => setShowTable((value) => !value)}
          aria-expanded={showTable}
          className="text-[12px] font-medium text-[var(--accent-text)] hover:underline"
        >
          {showTable ? "Hide the figures" : "Show the figures as a table"}
        </button>
        {showTable ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[10.5px] uppercase tracking-wide text-[var(--text-faint)]">
                  <th className="py-2 pr-3 font-medium">Year</th>
                  <th className="py-2 pr-3 text-right font-medium">Paid in</th>
                  <th className="py-2 pr-3 text-right font-medium">Lower edge</th>
                  <th className="py-2 pr-3 text-right font-medium">Middle</th>
                  <th className="py-2 text-right font-medium">Upper edge</th>
                </tr>
              </thead>
              <tbody className="tnum divide-y divide-[var(--border)]">
                {projection.points
                  .filter((p) => p.year % Math.max(1, Math.round(years / 6)) === 0 || p.year === years)
                  .map((p) => (
                    <tr key={p.year}>
                      <td className="py-2 pr-3">{p.year === 0 ? "Today" : `${p.year}y`}</td>
                      <td className="py-2 pr-3 text-right text-[var(--text-muted)]">{formatCurrency(p.contributed, currency)}</td>
                      <td className="py-2 pr-3 text-right">{formatCurrency(p.p10, currency)}</td>
                      <td className="py-2 pr-3 text-right font-medium">{formatCurrency(p.p50, currency)}</td>
                      <td className="py-2 text-right">{formatCurrency(p.p90, currency)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div className="mt-4">
        <Callout tone="warn" title="How to read this, and how not to">
          <ul className="space-y-1.5">
            {projection.notes.map((note) => (
              <li key={note} className="flex gap-2">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--warn)]" aria-hidden="true" />
                {note}
              </li>
            ))}
          </ul>
        </Callout>
      </div>
    </Card>
  );
}
