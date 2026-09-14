/**
 * Windowed volume.
 *
 * The normalisation is the whole risk: landmarks are weekly numbers, so a 90-day
 * total compared against them would tell everybody they are massively over their
 * ceiling, every time.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { weeklySetsOverWindow, windowReport, HEATMAP_WINDOWS } from '../js/engine/volume.js';
import { DRAWN_MUSCLES, HEAT_ZONES } from '../js/ui/muscle-map.js';
import { MUSCLE_DISPLAY_ORDER } from '../js/data/muscles.js';

const DAY = 86400000;
const NOW = Date.UTC(2026, 5, 1);
const bench = (n) => Array.from({ length: n }, () => ({ done: true, weight: 100, reps: 8, rir: 2 }));
const session = (daysAgo, sets = 3) => ({
  id: `s${daysAgo}`, date: NOW - daysAgo * DAY,
  entries: [{ exerciseId: 'bb-bench', sets: bench(sets) }],
});

test('an empty log produces an empty window rather than a crash', () => {
  const out = weeklySetsOverWindow([], { days: 30 });
  assert.deepEqual(out.totals, {});
  assert.equal(out.sessions, 0);
  assert.equal(out.from, null);
});

test('sets are averaged per week, not summed over the window', () => {
  // Twelve weekly sessions of 3 sets across 84 days is 3 sets a week, not 36.
  const sessions = Array.from({ length: 12 }, (_, i) => session(i * 7, 3));
  const out = weeklySetsOverWindow(sessions, { days: 90, now: NOW });
  assert.ok(Math.abs(out.totals.chest - 3 * 12 / (90 / 7)) < 0.01);
  assert.ok(out.totals.chest < 4, `${out.totals.chest} should read as a weekly rate`);
});

test('a week window reports the week at face value', () => {
  const sessions = [session(1, 4), session(3, 4)];
  const out = weeklySetsOverWindow(sessions, { days: 7, now: NOW });
  assert.equal(out.totals.chest, 8);
  assert.equal(out.sessions, 2);
});

test('a short burst is never extrapolated into a huge weekly rate', () => {
  // Two sessions in three days is not evidence of a 20-set week.
  const out = weeklySetsOverWindow([session(0, 5), session(2, 5)], { days: 7, now: NOW });
  assert.equal(out.totals.chest, 10);
  assert.equal(out.weeks, 1);
});

test('the window is measured from the last session, not from today', () => {
  // Someone back after a month off should see the block they actually did,
  // not every muscle averaged towards zero by the time away.
  const sessions = [session(40, 6), session(44, 6)];
  const fromToday = weeklySetsOverWindow(sessions, { days: 7, now: NOW });
  const natural = weeklySetsOverWindow(sessions, { days: 7 });
  assert.equal(fromToday.sessions, 0, 'nothing in the last week by the calendar');
  // Both land inside a week of each other, so the natural window sees the block
  // that was actually trained rather than an empty chart.
  assert.equal(natural.sessions, 2);
  assert.equal(natural.totals.chest, 12);
});

test('sessions outside the window are excluded', () => {
  const out = weeklySetsOverWindow([session(0, 3), session(45, 30)], { days: 30, now: NOW });
  assert.equal(out.sessions, 1);
  assert.equal(out.totals.chest, 3 / (30 / 7));
});

test('the report carries a row per muscle with a zone on it', () => {
  const report = windowReport([session(0, 3)], { days: 7, now: NOW });
  assert.equal(report.rows.length, MUSCLE_DISPLAY_ORDER.length);
  const chest = report.rows.find((r) => r.id === 'chest');
  assert.ok(chest.sets > 0);
  assert.ok(chest.status.zone);
  const untouched = report.rows.find((r) => r.id === 'calves');
  assert.equal(untouched.status.zone, 'none');
});

test('every zone the report can produce has a colour and a name in the legend', () => {
  // Colour is never the only carrier of status, so the legend has to be complete.
  const zones = new Set(HEAT_ZONES.map((z) => z.zone));
  for (const zone of ['none', 'below-mev', 'productive', 'near-mrv', 'over-mrv']) {
    assert.ok(zones.has(zone), `no legend entry for ${zone}`);
  }
});

test('every muscle the report returns is one the body can draw', () => {
  const report = windowReport([session(0, 3)], { days: 7, now: NOW });
  const undrawable = report.rows.filter((r) => !DRAWN_MUSCLES.has(r.id));
  assert.deepEqual(undrawable.map((r) => r.id), []);
});

test('the offered windows run short to long and are all positive', () => {
  assert.ok(HEATMAP_WINDOWS.length >= 2);
  const days = HEATMAP_WINDOWS.map((w) => w.days);
  assert.deepEqual(days, [...days].sort((a, b) => a - b));
  assert.ok(days.every((d) => d > 0));
});
