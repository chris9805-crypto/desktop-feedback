/**
 * The record book. The rules here are the ones a lifter would recognise, and
 * the failure mode to guard against is inflation: an app that calls everything
 * a record is an app whose records mean nothing.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  recordBook, applySet, checkSet, bestRepsAt, heaviest, isWorkingSet, sessionRecords,
} from '../js/engine/records.js';

const set = (weight, reps, rir = 2, extra = {}) => ({ done: true, weight, reps, rir, ...extra });

function build(...sets) {
  return sets.reduce((record, s) => applySet(record, s, 0), undefined);
}

test('a working set needs real numbers and no warm-up flag', () => {
  assert.ok(isWorkingSet(set(100, 5)));
  assert.ok(!isWorkingSet(set(100, 5, 2, { warmup: true })));
  assert.ok(!isWorkingSet({ done: true, weight: null, reps: 5 }));
  assert.ok(!isWorkingSet({ done: true, weight: 100, reps: 0 }));
  assert.ok(!isWorkingSet(undefined));
});

test('nothing is a record the first time you do a lift', () => {
  const first = build();
  assert.deepEqual(checkSet(first, set(100, 8)), []);
});

test('more reps at the same weight is a rep record', () => {
  const record = build(set(100, 6));
  const hits = checkSet(record, set(100, 8));
  assert.equal(hits[0].type, 'reps');
  assert.match(hits[0].detail, /8 at 100kg/);
});

test('the same reps at a heavier weight is a heaviest record', () => {
  const record = build(set(100, 6));
  const hits = checkSet(record, set(105, 6));
  assert.equal(hits[0].type, 'heaviest');
});

test('fewer reps at a lighter weight is not a record', () => {
  const record = build(set(100, 8));
  assert.deepEqual(checkSet(record, set(95, 6)).map((h) => h.type), []);
});

test('reps at a lighter weight still count against the heavier mark', () => {
  // 8 at 100 already proves more than 7 at 90 - claiming a record for the
  // lighter set is exactly the inflation this guards against.
  const record = build(set(100, 8));
  assert.deepEqual(checkSet(record, set(90, 7)).map((h) => h.type), []);
  // But beating what you did at 100 with more reps at 90 is genuinely new.
  assert.ok(checkSet(record, set(90, 12)).some((h) => h.type === 'reps'));
});

test('the frontier drops points that are beaten on both counts', () => {
  const record = build(set(100, 5), set(100, 8));
  assert.equal(record.frontier.length, 1);
  assert.equal(record.frontier[0].reps, 8);
});

test('the frontier keeps points that trade weight for reps', () => {
  const record = build(set(120, 3), set(100, 8), set(80, 15));
  assert.equal(record.frontier.length, 3);
  assert.equal(heaviest(record).weight, 120);
  assert.equal(bestRepsAt(record, 100).reps, 8);
  assert.equal(bestRepsAt(record, 80).reps, 15);
  assert.equal(bestRepsAt(record, 130), null);
});

test('an estimated-max record needs a real margin, not rounding', () => {
  const record = build(set(100, 5, 2));
  // The same set again is not a new record.
  assert.ok(!checkSet(record, set(100, 5, 2)).some((h) => h.type === 'e1rm'));
  // The same set that took everything you had is a *smaller* estimate: no reps
  // left means 100x5 was the limit, where 2 in reserve implied 100x7.
  assert.ok(!checkSet(record, set(100, 5, 0)).some((h) => h.type === 'e1rm'));
  // The same set with more left in the tank does imply a higher max.
  assert.ok(checkSet(record, set(100, 5, 4)).some((h) => h.type === 'e1rm'));
});

test('warm-ups never break records', () => {
  const record = build(set(100, 8));
  assert.deepEqual(checkSet(record, set(200, 12, 2, { warmup: true })), []);
  const after = applySet(record, set(200, 12, 2, { warmup: true }), 0);
  assert.equal(heaviest(after).weight, 100);
});

test('records are ordered with the loudest claim first', () => {
  // A rep record needs something at this load or heavier to beat, so it can
  // only appear *below* the top weight - which is why it never shares a set
  // with a heaviest record.
  const record = build(set(120, 3), set(100, 5));
  const hits = checkSet(record, set(110, 8));
  assert.deepEqual(hits.map((h) => h.type), ['reps', 'e1rm']);
});

test('a first set at a new top weight claims heaviest, not also a rep record', () => {
  // There is no rep mark at 110 or above to beat, and saying "rep record" for
  // a load nobody has touched before would be counting the same news twice.
  const record = build(set(100, 5));
  assert.deepEqual(checkSet(record, set(110, 8)).map((h) => h.type), ['heaviest', 'e1rm']);
});

/* --- across sessions --------------------------------------------------- */

const session = (date, sets) => ({
  id: `s${date}`, date, entries: [{ exerciseId: 'bb-bench', sets }],
});

test('the book is built oldest first regardless of the order given', () => {
  const book = recordBook([
    session(3000, [set(105, 5)]),
    session(1000, [set(100, 5)]),
  ]);
  assert.equal(heaviest(book.get('bb-bench')).weight, 105);
  assert.equal(book.get('bb-bench').sets, 2);
});

test('a session reports one row per lift, carrying its strongest claim', () => {
  const history = [session(1000, [set(100, 5)])];
  const book = recordBook(history);
  const rows = sessionRecords(session(2000, [set(100, 6), set(110, 5)]), book);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].exerciseId, 'bb-bench');
  assert.equal(rows[0].type, 'heaviest');
});

test('a first-ever session breaks nothing', () => {
  assert.deepEqual(sessionRecords(session(1000, [set(100, 5)]), new Map()), []);
});

test('a volume record shows only when nothing louder happened', () => {
  const book = recordBook([session(1000, [set(100, 5)])]);
  // Same top set, but three times the work.
  const rows = sessionRecords(session(2000, [set(100, 5), set(100, 5), set(100, 5)]), book);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].type, 'volume');
});

test('the book is not mutated by checking a set against it', () => {
  const record = build(set(100, 5));
  const before = JSON.stringify(record);
  checkSet(record, set(200, 10));
  assert.equal(JSON.stringify(record), before);
});
