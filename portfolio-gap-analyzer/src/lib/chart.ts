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
