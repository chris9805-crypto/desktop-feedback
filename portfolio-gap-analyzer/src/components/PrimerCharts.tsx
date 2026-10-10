"use client";

import { buildFanChart, buildRangeChart, buildTwoLineChart } from "@/lib/chart";
import type { Alternative, FeePoint, Journey } from "@/lib/engine/primer";
import type { Currency } from "@/lib/engine/types";
import { formatCurrency } from "@/lib/format";

/**
 * Outcome ranges for several mixes, one bar each.
 *
 * The bar is the middle 80% of simulated outcomes and the notch is the median.
 * Reading it as "the bar is the answer" is the mistake this shape is meant to
 * prevent: the eye compares widths first, which is the actual lesson.
 */
export function RangeChart({
  bands,
  currency,
  marker,
  markerLabel,
}: {
  bands: Alternative[];
  currency: Currency;
  marker?: number;
  markerLabel?: string;
}) {
  const chart = buildRangeChart(bands, currency, marker);
  const money = (value: number) => formatCurrency(value, currency);

  return (
    <figure className="m-0">
      <ul className="space-y-3.5">
        {chart.bars.map((bar, index) => (
          <li key={bar.label}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span className="w-full text-[13px] font-medium text-[var(--text)] sm:w-auto">
                {bar.label}
                {bands[index]?.monthly != null ? (
                  <span className="tnum ml-2 font-normal text-[var(--text-muted)]">
                    {money(bands[index]!.monthly!)}/mo
                  </span>
                ) : null}
              </span>
              <span className="tnum text-[12px] text-[var(--text-muted)]">
                {money(bar.p10)} <span className="text-[var(--text-faint)]">to</span> {money(bar.p90)}
                <span className="ml-2 font-semibold text-[var(--text)]">{money(bar.p50)}</span>
              </span>
            </div>
            <div
              className="relative mt-1.5 h-5 w-full rounded-[3px] bg-[var(--surface-2)]"
              role="img"
              aria-label={`${bar.label}: middle outcome ${money(bar.p50)}, middle 80% from ${money(bar.p10)} to ${money(
                bar.p90,
              )}`}
            >
              <span
                className="absolute inset-y-0 rounded-[3px]"
                style={{
                  left: `${bar.left}%`,
                  width: `${bar.width}%`,
                  background: `var(--chart-${index + 1})`,
                  opacity: 0.32,
                }}
              />
              <span
                className="absolute inset-y-[-2px] w-[3px] rounded-full"
                style={{ left: `calc(${bar.medianLeft}% - 1.5px)`, background: `var(--chart-${index + 1})` }}
              />
              {chart.marker ? (
                <span
                  className="absolute inset-y-[-3px] w-px bg-[var(--text)] opacity-55"
                  style={{ left: `${chart.marker.left}%` }}
                  aria-hidden="true"
                />
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <div className="relative mt-2 h-4" aria-hidden="true">
        {chart.ticks.map((tick, index) => (
          <span
            key={tick.value}
            className="tnum absolute top-0 text-[10.5px] text-[var(--text-faint)]"
            style={{
              left: `${tick.left}%`,
              transform:
                index === 0 ? "none" : index === chart.ticks.length - 1 ? "translateX(-100%)" : "translateX(-50%)",
            }}
          >
            {tick.label}
          </span>
        ))}
      </div>

      <figcaption className="mt-3 text-[11.5px] leading-relaxed text-[var(--text-faint)]">
        Each bar is the middle 80% of 2,000 simulated outcomes; the notch is the middle one.
        {chart.marker ? ` The thin line is the ${money(chart.marker.value)} ${markerLabel ?? "mark"}.` : ""} In
        today&apos;s money. An illustration of long-run averages, not a forecast — real returns do not arrive evenly.
      </figcaption>
    </figure>
  );
}

/**
 * The band over time, with a few whole runs drawn through it.
 *
 * A percentile band on its own reads as a smooth widening cone, which is the
 * one thing growth reliably is not. The individual runs are the point: they
 * are real paths out of the same 2,000, they cross each other, and several
 * spend years going sideways or down before finishing where they finish.
 */
export function JourneyChart({
  journey,
  currency,
  marker,
  markerLabel,
}: {
  journey: Journey;
  currency: Currency;
  marker?: number;
  markerLabel?: string;
}) {
  const wide = buildFanChart(journey.points, currency, 640, 260, journey.paths);
  const narrow = buildFanChart(journey.points, currency, 340, 240, journey.paths);
  const final = journey.points[journey.points.length - 1]!;

  const plot = (chart: typeof wide, className: string) => (
    <svg
      viewBox={`0 0 ${chart.width} ${chart.height}`}
      className={`w-full ${className}`}
      style={{ height: "auto" }}
      role="img"
      aria-label={`Simulated outcomes over ${final.year} years: the middle 80% of runs finish between ${formatCurrency(
        final.p10,
        currency,
      )} and ${formatCurrency(final.p90, currency)}, with a middle outcome of ${formatCurrency(final.p50, currency)}.`}
    >
      {chart.yTicks.map((tick) => (
        <g key={tick.value}>
          <line
            x1={chart.plot.left}
            x2={chart.width - chart.plot.right}
            y1={tick.y}
            y2={tick.y}
            stroke="var(--border)"
            strokeWidth={1}
          />
          <text x={chart.plot.left - 8} y={tick.y + 4} textAnchor="end" className="tnum" fontSize={11} fill="var(--text-faint)">
            {tick.label}
          </text>
        </g>
      ))}
      {chart.xTicks.map((tick) => (
        <text
          key={tick.value}
          x={tick.x}
          y={chart.height - 8}
          textAnchor={tick.value === 0 ? "start" : tick.x > chart.width - 40 ? "end" : "middle"}
          className="tnum"
          fontSize={11}
          fill="var(--text-faint)"
        >
          {tick.label}
        </text>
      ))}

      <path d={chart.bandPath} fill="var(--accent)" opacity={0.14} />
      {chart.pathLines.map((d, index) => (
        <path key={index} d={d} fill="none" stroke="var(--text)" strokeWidth={1.1} opacity={0.38} strokeLinejoin="round" />
      ))}
      <path d={chart.medianPath} fill="none" stroke="var(--accent)" strokeWidth={2.4} strokeLinejoin="round" />
      <path
        d={chart.contributedPath}
        fill="none"
        stroke="var(--text-faint)"
        strokeWidth={1.5}
        strokeDasharray="4 3"
        strokeLinejoin="round"
      />
      {marker !== undefined && marker > 0 && marker <= chart.maxY ? (
        <g>
          <line
            x1={chart.plot.left}
            x2={chart.width - chart.plot.right}
            y1={chart.yFor(marker)}
            y2={chart.yFor(marker)}
            stroke="var(--text)"
            strokeWidth={1.5}
          />
          <text x={chart.plot.left + 4} y={chart.yFor(marker) - 5} fontSize={10.5} fill="var(--text-muted)">
            {markerLabel ?? "target"}
          </text>
        </g>
      ) : null}
    </svg>
  );

  return (
    <figure className="m-0">
      {plot(wide, "hidden sm:block")}
      {plot(narrow, "sm:hidden")}
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] text-[var(--text-muted)]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-[2px]" style={{ background: "var(--accent)", opacity: 0.2 }} aria-hidden="true" />
          Middle 80% of runs
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: "var(--accent)" }} aria-hidden="true" />
          Middle outcome
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-px w-4" style={{ background: "var(--text)", opacity: 0.4 }} aria-hidden="true" />
          Seven individual runs
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-px w-4"
            style={{ borderTop: "1.5px dashed var(--text-faint)" }}
            aria-hidden="true"
          />
          Money paid in
        </span>
      </div>
    </figure>
  );
}

/** Two compounding paths under different charges, with the gap shaded. */
function FeePlot({
  points,
  currency,
  width,
  height,
  className,
}: {
  points: FeePoint[];
  currency: Currency;
  width: number;
  height: number;
  className: string;
}) {
  const chart = buildTwoLineChart(points, currency, width, height);
  const last = points[points.length - 1]!;
  const gap = last.low - last.high;

  return (
      <svg
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        className={`w-full ${className}`}
        style={{ height: "auto" }}
        role="img"
        aria-label={`After ${last.year} years the low-charge path reaches ${formatCurrency(
          last.low,
          currency,
        )} and the high-charge path ${formatCurrency(last.high, currency)}, a difference of ${formatCurrency(
          gap,
          currency,
        )}.`}
      >
        {chart.yTicks.map((tick) => (
          <g key={tick.value}>
            <line
              x1={chart.plot.left}
              x2={chart.width - chart.plot.right}
              y1={tick.y}
              y2={tick.y}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text x={chart.plot.left - 8} y={tick.y + 4} textAnchor="end" className="tnum" fontSize={11} fill="var(--text-faint)">
              {tick.label}
            </text>
          </g>
        ))}
        {chart.xTicks.map((tick) => (
          <text
            key={tick.value}
            x={tick.x}
            y={chart.height - 8}
            textAnchor={tick.value === 0 ? "start" : tick.x > chart.width - 40 ? "end" : "middle"}
            className="tnum"
            fontSize={11}
            fill="var(--text-faint)"
          >
            {tick.label}
          </text>
        ))}

        <path d={chart.gapPath} fill="var(--over)" opacity={0.2} />
        <path d={chart.lowPath} fill="none" stroke="var(--under)" strokeWidth={2.2} strokeLinejoin="round" />
        <path d={chart.highPath} fill="none" stroke="var(--over)" strokeWidth={2.2} strokeLinejoin="round" />
      </svg>
  );
}

/**
 * Two compounding paths, drawn twice.
 *
 * An SVG with a fixed viewBox scales its own text down with the drawing, and at
 * phone width a 620-unit plot rendered into 330 pixels left the axis captions
 * at about six pixels. Rather than shrink the text, the narrow break-point gets
 * its own geometry at roughly 1:1, so the labels come out at the size they were
 * written. Only one of the two is ever displayed.
 */
export function FeeGapChart({
  points,
  currency,
  difference,
}: {
  points: FeePoint[];
  currency: Currency;
  difference: number;
}) {
  const last = points[points.length - 1]!;
  return (
    <figure className="m-0">
      <FeePlot points={points} currency={currency} width={620} height={240} className="hidden sm:block" />
      <FeePlot points={points} currency={currency} width={330} height={230} className="sm:hidden" />
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px]">
        <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
          <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: "var(--under)" }} aria-hidden="true" />
          Low charge
          <span className="tnum font-medium text-[var(--text)]">{formatCurrency(last.low, currency)}</span>
        </span>
        <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
          <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: "var(--over)" }} aria-hidden="true" />
          High charge
          <span className="tnum font-medium text-[var(--text)]">{formatCurrency(last.high, currency)}</span>
        </span>
        <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
          <span className="inline-block h-2.5 w-4 rounded-[2px]" style={{ background: "var(--over)", opacity: 0.25 }} aria-hidden="true" />
          The difference
          <span className="tnum font-medium text-[var(--over)]">{formatCurrency(difference, currency)}</span>
        </span>
      </div>
    </figure>
  );
}
