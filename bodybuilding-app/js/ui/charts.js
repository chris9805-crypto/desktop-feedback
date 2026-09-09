/**
 * Charts.
 *
 * Two forms, both single-series, both hand-drawn in SVG so they inherit the
 * theme tokens and need no library.
 *
 *   volumeChart - weekly hard sets per muscle against that muscle's landmarks.
 *                 One colour for every bar (the bar length is the magnitude;
 *                 colouring by value would burn a channel restating it). The
 *                 MEV-MRV band sits behind the bars in a surface step, and the
 *                 status ("Below MEV", "Over MRV") is written as text - never
 *                 carried by colour alone.
 *
 *   trendChart  - estimated 1RM over time. 2px line, endpoint labelled, the
 *                 rest left to the axis and the hover tooltip.
 */

import { svg, h, fmtNumber } from './dom.js';

const BAR_THICKNESS = 18;
const BAR_GAP = 10;          // surface gap between adjacent bars
const LABEL_WIDTH = 96;
const VALUE_WIDTH = 58;

export function volumeChart(rows, { max: forcedMax } = {}) {
  const data = rows.filter((r) => r.sets > 0 || r.mev > 0);
  if (!data.length) return h('p', { class: 'muted small' }, 'No volume logged yet.');

  const max = forcedMax ?? Math.max(...data.map((r) => Math.max(r.sets, r.mrv)), 10) * 1.06;
  const height = data.length * (BAR_THICKNESS + BAR_GAP) + 26;
  const width = 640;
  const plotLeft = LABEL_WIDTH;
  const plotRight = width - VALUE_WIDTH;
  const plotWidth = plotRight - plotLeft;
  const x = (v) => plotLeft + (v / max) * plotWidth;

  const wrap = h('div', { class: 'chart-wrap' });
  const tip = h('div', { class: 'tooltip', hidden: true });
  const chart = svg('svg', {
    class: 'chart', viewBox: `0 0 ${width} ${height}`,
    role: 'img', 'aria-label': 'Weekly hard sets per muscle against volume landmarks',
  });

  // Axis ticks, rounded to clean numbers.
  const step = max > 30 ? 10 : 5;
  for (let v = 0; v <= max; v += step) {
    chart.appendChild(svg('line', { class: 'grid-line', x1: x(v), x2: x(v), y1: 16, y2: height - 8 }));
    chart.appendChild(svg('text', { class: 'axis-label', x: x(v), y: 10, 'text-anchor': 'middle' }, String(v)));
  }

  data.forEach((row, i) => {
    const y = 20 + i * (BAR_THICKNESS + BAR_GAP);

    // The productive band, behind the bar: where this muscle wants to live.
    chart.appendChild(svg('rect', {
      class: 'zone', x: x(row.mev), y: y - 3, width: Math.max(0, x(row.mrv) - x(row.mev)),
      height: BAR_THICKNESS + 6, rx: 3,
    }));

    chart.appendChild(svg('text', {
      class: 'axis-label', x: LABEL_WIDTH - 10, y: y + BAR_THICKNESS / 2 + 4, 'text-anchor': 'end',
    }, row.name));

    const barWidth = Math.max(row.sets > 0 ? 3 : 0, x(row.sets) - plotLeft);
    if (barWidth > 0) {
      chart.appendChild(svg('path', {
        class: 'bar',
        d: roundedEndBar(plotLeft, y, barWidth, BAR_THICKNESS, 4),
      }));
    }

    chart.appendChild(svg('text', {
      class: 'value-label', x: plotLeft + barWidth + 8, y: y + BAR_THICKNESS / 2 + 4,
    }, fmtNumber(row.sets, row.sets % 1 ? 1 : 0)));

    const hit = svg('rect', { class: 'hit', x: 0, y: y - 4, width, height: BAR_THICKNESS + 8 });
    hit.addEventListener('pointerenter', (ev) => {
      tip.innerHTML = '';
      tip.append(
        h('div', { class: 't-title' }, `${row.name} — ${row.status.label}`),
        h('div', { class: 'muted' }, `${fmtNumber(row.sets, 1)} hard sets · MEV ${row.mev} · MAV ${row.mav} · MRV ${row.mrv}`),
      );
      positionTip(tip, wrap, ev);
      tip.hidden = false;
    });
    hit.addEventListener('pointermove', (ev) => positionTip(tip, wrap, ev));
    hit.addEventListener('pointerleave', () => { tip.hidden = true; });
    chart.appendChild(hit);
  });

  wrap.append(chart, tip);
  return wrap;
}

/** Bar with rounded data-end, square where it meets the baseline. */
function roundedEndBar(x, y, w, hgt, r) {
  const radius = Math.min(r, w);
  return `M ${x} ${y} H ${x + w - radius} Q ${x + w} ${y} ${x + w} ${y + radius} ` +
         `V ${y + hgt - radius} Q ${x + w} ${y + hgt} ${x + w - radius} ${y + hgt} H ${x} Z`;
}

export function trendChart(points, { unit = 'kg', label = 'Estimated 1RM', height = 190 } = {}) {
  if (points.length < 2) {
    return h('p', { class: 'muted small' }, 'Two sessions of history are needed before a trend means anything.');
  }

  const width = 640;
  const pad = { top: 18, right: 62, bottom: 26, left: 44 };
  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || Math.max(1, hi * 0.1);
  const yMin = lo - span * 0.25;
  const yMax = hi + span * 0.25;

  const x = (i) => pad.left + (i / (points.length - 1)) * (width - pad.left - pad.right);
  const y = (v) => pad.top + (1 - (v - yMin) / (yMax - yMin)) * (height - pad.top - pad.bottom);

  const wrap = h('div', { class: 'chart-wrap' });
  const tip = h('div', { class: 'tooltip', hidden: true });
  const chart = svg('svg', {
    class: 'chart', viewBox: `0 0 ${width} ${height}`,
    role: 'img', 'aria-label': `${label} over time`,
  });

  for (const v of niceTicks(yMin, yMax, 3)) {
    chart.appendChild(svg('line', { class: 'grid-line', x1: pad.left, x2: width - pad.right, y1: y(v), y2: y(v) }));
    chart.appendChild(svg('text', { class: 'axis-label', x: pad.left - 8, y: y(v) + 4, 'text-anchor': 'end' }, fmtNumber(v)));
  }

  const line = points.map((p, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(p.value)}`).join(' ');
  chart.appendChild(svg('path', {
    class: 'area',
    d: `${line} L ${x(points.length - 1)} ${height - pad.bottom} L ${x(0)} ${height - pad.bottom} Z`,
  }));
  chart.appendChild(svg('path', { class: 'line', d: line }));

  const crosshair = svg('line', { class: 'crosshair', y1: pad.top, y2: height - pad.bottom, opacity: 0 });
  chart.appendChild(crosshair);

  points.forEach((p, i) => {
    chart.appendChild(svg('circle', { class: 'dot', cx: x(i), cy: y(p.value), r: 4.5 }));
    if (i === 0 || i === points.length - 1 || points.length <= 6) {
      chart.appendChild(svg('text', {
        class: 'axis-label', x: x(i), y: height - pad.bottom + 15, 'text-anchor': i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle',
      }, p.label));
    }
  });

  // Only the endpoint gets a direct value label; the axis carries the rest.
  const last = points[points.length - 1];
  chart.appendChild(svg('text', {
    class: 'value-label', x: x(points.length - 1) + 10, y: y(last.value) + 4,
  }, `${fmtNumber(last.value)}${unit}`));

  const hit = svg('rect', { class: 'hit', x: pad.left, y: 0, width: width - pad.left - pad.right, height });
  hit.addEventListener('pointermove', (ev) => {
    const box = chart.getBoundingClientRect();
    const rel = ((ev.clientX - box.left) / box.width) * width;
    const i = Math.max(0, Math.min(points.length - 1, Math.round(((rel - pad.left) / (width - pad.left - pad.right)) * (points.length - 1))));
    const p = points[i];
    crosshair.setAttribute('x1', x(i));
    crosshair.setAttribute('x2', x(i));
    crosshair.setAttribute('opacity', 1);
    tip.innerHTML = '';
    tip.append(
      h('div', { class: 't-title' }, `${fmtNumber(p.value)}${unit}`),
      h('div', { class: 'muted' }, p.detail ?? p.label),
    );
    positionTip(tip, wrap, ev);
    tip.hidden = false;
  });
  hit.addEventListener('pointerleave', () => { tip.hidden = true; crosshair.setAttribute('opacity', 0); });
  chart.appendChild(hit);

  wrap.append(chart, tip);
  return wrap;
}

function niceTicks(lo, hi, count) {
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

function positionTip(tip, wrap, ev) {
  const box = wrap.getBoundingClientRect();
  tip.style.left = `${Math.max(60, Math.min(box.width - 60, ev.clientX - box.left))}px`;
  tip.style.top = `${ev.clientY - box.top}px`;
}
