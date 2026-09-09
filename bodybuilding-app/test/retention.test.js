/**
 * Strength retention.
 *
 * The claim this makes has to stay honest: it measures strength held against
 * a personal peak, and it is labelled as a proxy for muscle rather than as a
 * measurement of it, because no training log can measure tissue.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  retentionByLift, overallRetention, verdictFor, heldInSession,
  VERDICT_COPY, HELD_THRESHOLD,
} from '../js/engine/retention.js';

const DAY = 86400000;
const at = (daysAgo) => Date.now() - daysAgo * DAY;
const s = (weight, reps, rir = 1) => ({ weight, reps, rir, done: true, warmup: false });
const session = (date, lifts) => ({
  id: `x${date}${Math.random()}`, date, mesoId: 'm', week: 0, programId: 'ul4',
  entries: Object.entries(lifts).map(([exerciseId, sets]) => ({ exerciseId, sets })),
});

test('a lift held at its peak reads as held', () => {
  const rows = retentionByLift([
    session(at(60), { 'bb-bench': [s(100, 5)] }),
    session(at(10), { 'bb-bench': [s(100, 5)] }),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].pct, 100);
  assert.equal(rows[0].held, true);
});

test('a lift a few percent down is still held, not failed', () => {
  // A cut that costs 2% of a bench is a successful cut, and the wording has to
  // say so or people eat to chase a number.
  const rows = retentionByLift([
    session(at(60), { 'bb-bench': [s(100, 8)] }),
    session(at(5), { 'bb-bench': [s(100, 7)] }),
  ]);
  assert.ok(rows[0].pct >= 97, `expected a small drop, got ${rows[0].pct}%`);
  assert.equal(rows[0].held, true);
});

test('a real decline is reported as one', () => {
  const rows = retentionByLift([
    session(at(60), { 'bb-bench': [s(120, 8)] }),
    session(at(5), { 'bb-bench': [s(95, 6)] }),
  ]);
  assert.ok(rows[0].pct < 90);
  assert.equal(rows[0].held, false);
});

test('one bad session does not define where you are', () => {
  // Best recent effort, not the last one - judging a diet on a single off day
  // would be wrong and would push people to abandon it.
  const rows = retentionByLift([
    session(at(60), { 'bb-bench': [s(100, 5)] }),
    session(at(10), { 'bb-bench': [s(100, 5)] }),
    session(at(2), { 'bb-bench': [s(70, 5)] }),
  ]);
  assert.equal(rows[0].pct, 100);
});

test('peak comes from the whole log, not the current block', () => {
  const rows = retentionByLift([
    session(at(300), { 'bb-bench': [s(140, 5)] }),   // old peak
    session(at(20), { 'bb-bench': [s(100, 5)] }),
    session(at(5), { 'bb-bench': [s(100, 5)] }),
  ]);
  assert.ok(rows[0].pct < 80, 'the thing you are keeping is your best ever');
});

test('a lift with one session is not judged', () => {
  assert.deepEqual(retentionByLift([session(at(5), { 'bb-bench': [s(100, 5)] })]), []);
});

test('a lift you have not done recently is flagged rather than counted', () => {
  const rows = retentionByLift([
    session(at(300), { 'bb-bench': [s(100, 5)] }),
    session(at(250), { 'bb-bench': [s(100, 5)] }),
  ]);
  assert.equal(rows[0].stale, true);
  assert.equal(overallRetention([
    session(at(300), { 'bb-bench': [s(100, 5)] }),
    session(at(250), { 'bb-bench': [s(100, 5)] }),
  ]).pct, null, 'stale lifts should not produce a confident headline number');
});

test('compounds count for more than isolation work', () => {
  // A squat drifting is not the same news as a lateral raise drifting.
  const squatDown = overallRetention([
    session(at(60), { 'back-squat': [s(140, 5)], 'lateral-raise': [s(12, 15)] }),
    session(at(5), { 'back-squat': [s(112, 5)], 'lateral-raise': [s(12, 15)] }),
  ]);
  const raiseDown = overallRetention([
    session(at(60), { 'back-squat': [s(140, 5)], 'lateral-raise': [s(15, 15)] }),
    session(at(5), { 'back-squat': [s(140, 5)], 'lateral-raise': [s(12, 15)] }),
  ]);
  assert.ok(squatDown.pct < raiseDown.pct,
    'the same proportional loss on a compound should read worse');
});

test('a spike on one lift cannot mask a slide on the rest', () => {
  const r = overallRetention([
    session(at(60), { 'bb-bench': [s(100, 5)], 'back-squat': [s(140, 5)] }),
    session(at(5), { 'bb-bench': [s(160, 5)], 'back-squat': [s(100, 5)] }),
  ]);
  assert.ok(r.pct < 100, `an outlier should not paper over a real loss - got ${r.pct}%`);
});

test('every verdict has wording, and the thresholds are generous where they should be', () => {
  assert.equal(verdictFor(1.02), 'gaining');
  assert.equal(verdictFor(1), 'holding');
  assert.equal(verdictFor(HELD_THRESHOLD), 'holding');
  assert.equal(verdictFor(0.95), 'slipping');
  assert.equal(verdictFor(0.85), 'losing');
  for (const key of ['gaining', 'holding', 'slipping', 'losing', 'unknown']) {
    assert.ok(VERDICT_COPY[key].label && VERDICT_COPY[key].line.length > 30, `${key} needs wording`);
  }
  // The tone at the top has to be right: holding through a diet is a success.
  assert.match(VERDICT_COPY.holding.line, /exactly what a cut is supposed to look like/i);
});

test('an empty log says so rather than inventing a number', () => {
  const r = overallRetention([]);
  assert.equal(r.pct, null);
  assert.equal(r.verdict, 'unknown');
  assert.deepEqual(r.lifts, []);
});

test('a session counts the lifts it held, which is what a cut celebrates', () => {
  const history = [
    session(at(30), { 'bb-bench': [s(100, 5)], 'bb-row': [s(80, 8)] }),
  ];
  const today = session(at(1), { 'bb-bench': [s(100, 5)], 'bb-row': [s(60, 8)] });
  assert.equal(heldInSession(today, history), 1, 'bench held, row did not');
});

test('a first-ever session holds nothing, and does not claim to', () => {
  const today = session(at(1), { 'bb-bench': [s(100, 5)] });
  assert.equal(heldInSession(today, []), 0);
});

test('the metric is described as strength, never as muscle', () => {
  // The honest limit: no training log can measure tissue.
  const text = Object.values(VERDICT_COPY).map((v) => `${v.label} ${v.line}`).join(' ');
  assert.ok(!/muscle retained|muscle retention|measures muscle/i.test(text),
    'the wording must not claim to measure muscle');
});
