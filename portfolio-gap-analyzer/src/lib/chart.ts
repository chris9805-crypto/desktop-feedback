import { CURRENCY_SYMBOL } from "@/lib/data/fx";
import type { ProjectionPoint } from "@/lib/engine/projection";
import type { Currency } from "@/lib/engine/types";

export interface FanChart {
  width: number;
  height: number;
  plot: { left: number; top: number; right: number; bottom: number };
  /** Filled band between the 10th and 90th percentile. */
  bandPath: string;
  medianPath: string;
  contributedPath: string;
  yTicks: { value: number; y: number; label: string }[];
  xTicks: { value: number; x: number; label: string }[];
  maxY: number;
  xFor: (year: number) => number;
  yFor: (value: number) => number;
  /** Index of the point nearest a pixel position, for the hover readout. */
  pointAt: (pixelX: number) => number;
}

/**
 * Round up to a readable number, on a fine enough ladder that the chart is not
 * left with half its height empty. A 1,2,5 ladder pushes a peak of 1.13M up to
 * 2M and wastes 45% of the plot; these steps cap it at 1.25M.
 */
const NICE_STEPS = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalised = value / magnitude;
  const step = NICE_STEPS.find((s) => normalised <= s + 1e-9) ?? 10;
  return step * magnitude;
}

/** Axis money, without the trailing ".0" that makes a tick strip look noisy. */
function tickMoney(value: number, currency: Currency): string {
  const symbol = CURRENCY_SYMBOL[currency];
  const abs = Math.abs(value);
  const unit = abs >= 1e9 ? ["B", 1e9] : abs >= 1e6 ? ["M", 1e6] : abs >= 1e3 ? ["K", 1e3] : ["", 1];
  const scaled = abs / (unit[1] as number);
  const digits = scaled < 10 && scaled % 1 !== 0 ? 1 : 0;
  return `${symbol}${scaled.toFixed(digits)}${unit[0] as string}`;
}

/**
 * Geometry for the projection fan chart, kept separate from any renderer so the
 * React app and the single-file artifact draw an identical figure from one
 * implementation rather than two that drift.
 */
export function buildFanChart(
  points: ProjectionPoint[],
  currency: Currency = "USD",
  width = 640,
  height = 260,
): FanChart {
  const plot = { left: 56, top: 14, right: 12, bottom: 26 };
  const innerWidth = Math.max(1, width - plot.left - plot.right);
  const innerHeight = Math.max(1, height - plot.top - plot.bottom);
  const years = Math.max(1, points.length - 1);

  // Pick a round gridline step first, then let the top of the scale fall on a
  // multiple of it. Quartering an arbitrary maximum produces ticks like
  // "$313K", which are values the chart reaches but nobody can read at a glance.
  const peak = points.reduce((a, p) => Math.max(a, p.p90, p.contributed), 0) * 1.02;
  const step = niceCeiling(peak / 4);
  const maxY = step * Math.max(1, Math.ceil(peak / step));

  const xFor = (year: number) => plot.left + (year / years) * innerWidth;
  const yFor = (value: number) => plot.top + innerHeight - (Math.min(value, maxY) / maxY) * innerHeight;

  const line = (pick: (p: ProjectionPoint) => number) =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${xFor(p.year).toFixed(1)},${yFor(pick(p)).toFixed(1)}`).join(" ");

  const upper = points.map((p, i) => `${i === 0 ? "M" : "L"}${xFor(p.year).toFixed(1)},${yFor(p.p90).toFixed(1)}`).join(" ");
  const lower = points
    .slice()
    .reverse()
    .map((p) => `L${xFor(p.year).toFixed(1)},${yFor(p.p10).toFixed(1)}`)
    .join(" ");

  // Gridlines on round multiples of the step, up to the top of the scale.
  const yTicks: { value: number; y: number; label: string }[] = [];
  for (let value = 0; value <= maxY + 1e-6; value += step) {
    yTicks.push({ value, y: yFor(value), label: tickMoney(value, currency) });
  }

  const stride = years <= 10 ? 2 : years <= 20 ? 5 : 10;
  const xValues: number[] = [];
  for (let year = 0; year <= years; year += stride) xValues.push(year);
  // The final year always gets a label; drop the one before it when the two
  // would otherwise print on top of each other.
  const last = xValues[xValues.length - 1];
  if (last !== years) {
    if (last !== undefined && years - last < stride * 0.6) xValues.pop();
    xValues.push(years);
  }
  const xTicks = xValues.map((value) => ({
    value,
    x: xFor(value),
    label: value === 0 ? "now" : `${value}y`,
  }));

  return {
    width,
    height,
    plot,
    bandPath: `${upper} ${lower} Z`,
    medianPath: line((p) => p.p50),
    contributedPath: line((p) => p.contributed),
    yTicks,
    xTicks,
    maxY,
    xFor,
    yFor,
    pointAt: (pixelX) => {
      const ratio = (pixelX - plot.left) / innerWidth;
      return Math.max(0, Math.min(points.length - 1, Math.round(ratio * years)));
    },
  };
}

export interface PieDatum {
  label: string;
  value: number;
}

export interface PieWedge {
  label: string;
  value: number;
  /** Fraction of the whole, 0-1. */
  share: number;
  /** Index into the caller's palette. Fixed by position, never cycled. */
  colorIndex: number;
  path: string;
}

export interface Pie {
  size: number;
  cx: number;
  cy: number;
  radius: number;
  total: number;
  wedges: PieWedge[];
  /** True when the tail was folded into "Other". */
  folded: boolean;
}

const TAU = Math.PI * 2;

/**
 * Wedge geometry for a part-to-whole pie, shared by both renderers.
 *
 * Labels live in the legend rather than inside the wedges: fills vary in
 * lightness, so no single text colour is legible on all of them.
 *
 * Categories beyond the palette's length fold into a single "Other" wedge.
 * That is not a stylistic choice: there are eight categorical hues, and reusing
 * one for a ninth category would make two different things the same colour,
 * which on a pie is the difference between readable and not.
 */
export function buildPie(data: PieDatum[], size = 176, maxWedges = 8): Pie {
  const radius = size / 2 - 1;
  const cx = size / 2;
  const cy = size / 2;

  const sorted = data.filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  const folded = sorted.length > maxWedges;
  const kept = folded ? sorted.slice(0, maxWedges - 1) : sorted;
  if (folded) {
    const tail = sorted.slice(maxWedges - 1).reduce((a, d) => a + d.value, 0);
    kept.push({ label: "Other", value: tail });
  }

  const total = kept.reduce((a, d) => a + d.value, 0);
  if (total <= 0) return { size, cx, cy, radius, total: 0, wedges: [], folded };

  // Start at twelve o'clock and sweep clockwise, the direction people read a pie.
  let angle = -Math.PI / 2;

  const wedges = kept.map((datum, index) => {
    const share = datum.value / total;
    const sweep = share * TAU;

    let path: string;
    if (share >= 0.9995) {
      // A single full-circle wedge: an arc of exactly 360° is degenerate, so it
      // is drawn as two half-circle arcs instead.
      path = `M${cx},${cy - radius} A${radius},${radius} 0 1,1 ${cx},${cy + radius} A${radius},${radius} 0 1,1 ${cx},${cy - radius} Z`;
    } else {
      const x0 = cx + radius * Math.cos(angle);
      const y0 = cy + radius * Math.sin(angle);
      const x1 = cx + radius * Math.cos(angle + sweep);
      const y1 = cy + radius * Math.sin(angle + sweep);
      path = `M${cx},${cy} L${x0.toFixed(2)},${y0.toFixed(2)} A${radius},${radius} 0 ${sweep > Math.PI ? 1 : 0},1 ${x1.toFixed(2)},${y1.toFixed(2)} Z`;
    }

    angle += sweep;

    return {
      label: datum.label,
      value: datum.value,
      share,
      colorIndex: index,
      path,
    };
  });

  return { size, cx, cy, radius, total, wedges, folded };
}

export interface RangeBar {
  label: string;
  /** Percentages of the plot width, so the bar can be laid out in CSS. */
  left: number;
  width: number;
  medianLeft: number;
  p10: number;
  p50: number;
  p90: number;
}

export interface RangeChart {
  bars: RangeBar[];
  ticks: { value: number; left: number; label: string }[];
  /** Marker for money actually paid in, if it fits on the axis. */
  contributed: { value: number; left: number } | null;
  maxX: number;
}

/**
 * Outcome ranges as percentages rather than pixels.
 *
 * This one is laid out in HTML rather than SVG, and the geometry is in percent
 * so that it can be. A fixed-viewBox SVG shrinks its own text along with the
 * drawing, which on a phone took four-word labels like "two-thirds in shares"
 * down to about six pixels; HTML bars keep body text at body size at any width.
 */
export function buildRangeChart(
  bands: { label: string; p10: number; p50: number; p90: number }[],
  currency: Currency = "USD",
  contributed?: number,
): RangeChart {
  const peak = Math.max(1, ...bands.map((b) => b.p90));
  const maxX = niceCeiling(peak);
  const pctFor = (value: number) => (Math.max(0, Math.min(maxX, value)) / maxX) * 100;

  const bars: RangeBar[] = bands.map((band) => {
    const left = pctFor(band.p10);
    return {
      label: band.label,
      left,
      width: Math.max(0.6, pctFor(band.p90) - left),
      medianLeft: pctFor(band.p50),
      p10: band.p10,
      p50: band.p50,
      p90: band.p90,
    };
  });

  const steps = 4;
  const ticks = Array.from({ length: steps + 1 }, (_, index) => {
    const value = (maxX / steps) * index;
    return { value, left: pctFor(value), label: value === 0 ? "0" : tickMoney(value, currency) };
  });

  return {
    bars,
    ticks,
    contributed:
      contributed !== undefined && contributed > 0 && contributed <= maxX
        ? { value: contributed, left: pctFor(contributed) }
        : null,
    maxX,
  };
}


export interface TwoLineChart {
  width: number;
  height: number;
  plot: { left: number; top: number; right: number; bottom: number };
  /** The upper line, the lower line, and the area between them. */
  highPath: string;
  lowPath: string;
  gapPath: string;
  yTicks: { value: number; y: number; label: string }[];
  xTicks: { value: number; x: number; label: string }[];
  /** Where to anchor a label on the gap, at the right-hand end. */
  gapLabel: { x: number; y: number };
  maxY: number;
  xFor: (year: number) => number;
  yFor: (value: number) => number;
}

/**
 * Two compounding paths and the widening gap between them.
 *
 * The shaded area is the whole argument: a charge difference is a constant
 * percentage but its cost is not, because every year's charge also gives up
 * everything that money would have earned afterwards. A pair of end numbers
 * states that; the shape shows it.
 */
export function buildTwoLineChart(
  points: { year: number; low: number; high: number }[],
  currency: Currency = "USD",
  width = 620,
  height = 240,
): TwoLineChart {
  const plot = { left: 56, top: 14, right: 12, bottom: 26 };
  const innerWidth = Math.max(1, width - plot.left - plot.right);
  const innerHeight = Math.max(1, height - plot.top - plot.bottom);
  const years = Math.max(1, points.length - 1);

  const maxY = niceCeiling(Math.max(1, ...points.map((p) => p.low)));
  const xFor = (year: number) => plot.left + (year / years) * innerWidth;
  const yFor = (value: number) => plot.top + innerHeight - (Math.max(0, value) / maxY) * innerHeight;

  const line = (pick: (p: { low: number; high: number }) => number) =>
    points.map((p, index) => `${index === 0 ? "M" : "L"}${xFor(p.year).toFixed(2)},${yFor(pick(p)).toFixed(2)}`).join(" ");

  const upper = line((p) => p.low);
  const lowerBack = points
    .slice()
    .reverse()
    .map((p) => `L${xFor(p.year).toFixed(2)},${yFor(p.high).toFixed(2)}`)
    .join(" ");

  const steps = 4;
  const yTicks = Array.from({ length: steps + 1 }, (_, index) => {
    const value = (maxY / steps) * index;
    return { value, y: yFor(value), label: value === 0 ? "0" : tickMoney(value, currency) };
  });

  const xStep = years <= 10 ? 2 : years <= 25 ? 5 : 10;
  const xTicks: { value: number; x: number; label: string }[] = [];
  for (let year = 0; year <= years; year += xStep) {
    xTicks.push({ value: year, x: xFor(year), label: year === 0 ? "now" : `${year}y` });
  }
  const last = points[points.length - 1]!;
  // Avoid a final tick colliding with the year label already at the end.
  if (years - (xTicks[xTicks.length - 1]?.value ?? 0) > xStep * 0.4) {
    xTicks.push({ value: years, x: xFor(years), label: `${years}y` });
  } else if (xTicks.length > 1) {
    xTicks[xTicks.length - 1] = { value: years, x: xFor(years), label: `${years}y` };
  }

  return {
    width,
    height,
    plot,
    highPath: line((p) => p.high),
    lowPath: upper,
    gapPath: `${upper} ${lowerBack} Z`,
    yTicks,
    xTicks,
    gapLabel: { x: xFor(years), y: (yFor(last.low) + yFor(last.high)) / 2 },
    maxY,
    xFor,
    yFor,
  };
}
