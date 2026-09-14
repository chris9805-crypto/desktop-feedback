/**
 * Drop sets. The accounting is the whole risk here: counted as extra sets they
 * would push people past their weekly ceiling while the app said they were
 * fine, and counted for records they would make records meaningless.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  suggestDropWeight, drops, hasDrops, dropReps, dropTonnage, isValidDrop,
  describeDrops, MAX_DROPS,
} from '../js/engine/dropsets.js';
import { tonnage } from '../js/engine/onerm.js';
import { setsByMuscle, isStimulating } from '../js/engine/volume.js';
import { recordBook, checkSet } from '../js/engine/records.js';

const set = (weight, reps, extra = {}) => ({ done: true, weight, reps, rir: 1, ...extra });
const withDrops = (...list) => set(100, 8, { drops: list });

test('a suggested drop is about a third off and loadable', () => {
  assert.equal(suggestDropWeight(100, 2.5), 70);
  assert.equal(suggestDropWeight(60, 5), 40);
  assert.equal(suggestDropWeight(102.5, 2.5), 72.5);
  // Never the same weight back, never zero.
  assert.ok(suggestDropWeight(5, 2.5) < 5);
  assert.ok(suggestDropWeight(2.5, 2.5) > 0);
  assert.equal(suggestDropWeight(0, 2.5), null);
  assert.equal(suggestDropWeight(null), null);
});

test('a drop needs a weight and at least one rep', () => {
  assert.ok(isValidDrop({ weight: 70, reps: 6 }));
  assert.ok(isValidDrop({ weight: 0, reps: 6 }));      // bodyweight drop is real
  assert.ok(!isValidDrop({ weight: 70, reps: 0 }));
  assert.ok(!isValidDrop({ weight: null, reps: 6 }));
  assert.ok(!isValidDrop(undefined));
});

test('reading drops off a set never throws on a set without them', () => {
  assert.deepEqual(drops(set(100, 8)), []);
  assert.deepEqual(drops(undefined), []);
  assert.equal(hasDrops(set(100, 8)), false);
  assert.equal(dropReps(set(100, 8)), 0);
  assert.equal(dropTonnage(set(100, 8)), 0);
  assert.equal(describeDrops(set(100, 8)), '');
});

/* --- the accounting ----------------------------------------------------- */

test('tonnage counts every rep, including the ones after the weight came off', () => {
  const plain = tonnage([set(100, 8)]);
  const dropped = tonnage([withDrops({ weight: 70, reps: 6 }, { weight: 50, reps: 5 })]);
  assert.equal(plain, 800);
  assert.equal(dropped, 800 + 420 + 250);
  assert.equal(dropTonnage(withDrops({ weight: 70, reps: 6 })), 420);
  assert.equal(dropReps(withDrops({ weight: 70, reps: 6 }, { weight: 50, reps: 5 })), 11);
});

test('a drop set is one hard set, not three', () => {
  // The drops are extra fatigue on a muscle already stimulated. Counting them
  // as separate sets would take somebody over their weekly ceiling while the
  // volume screen told them they had room.
  const session = (sets) => [{ date: 1, entries: [{ exerciseId: 'bb-bench', sets }] }];
  const plain = setsByMuscle(session([set(100, 8)]));
  const dropped = setsByMuscle(session([withDrops({ weight: 70, reps: 6 }, { weight: 50, reps: 5 })]));
  assert.deepEqual(plain, dropped);
  assert.equal(dropped.chest, 1);
});

test('warm-ups with drops still count for nothing', () => {
  const warm = withDrops({ weight: 70, reps: 6 });
  warm.warmup = true;
  assert.equal(tonnage([warm]), 0);
  assert.equal(isStimulating(warm), false);
});

test('a drop never sets a record', () => {
  // Lighter by definition and taken past failure. If the tail of a drop set
  // could claim a rep record, records would stop meaning anything.
  const book = recordBook([{ date: 1, entries: [{ exerciseId: 'bb-bench', sets: [set(100, 5)] }] }]);
  const record = book.get('bb-bench');
  const heavy = withDrops({ weight: 60, reps: 20 });
  const hits = checkSet(record, heavy);
  // The top set itself is judged normally...
  assert.ok(hits.some((x) => x.type === 'reps'));
  // ...and nothing in the book came from the 20 reps at 60.
  assert.equal(record.frontier.length, 1);
  assert.equal(record.frontier[0].weight, 100);
});

test('the record book ignores drops when building the frontier', () => {
  const book = recordBook([{
    date: 1,
    entries: [{ exerciseId: 'bb-bench', sets: [withDrops({ weight: 60, reps: 25 })] }],
  }]);
  const record = book.get('bb-bench');
  assert.equal(record.frontier.length, 1);
  assert.deepEqual([record.frontier[0].weight, record.frontier[0].reps], [100, 8]);
});

test('the log line says what happened, in order', () => {
  assert.equal(
    describeDrops(withDrops({ weight: 70, reps: 6 }, { weight: 50, reps: 5 })),
    '2 drops · 70kg × 6, 50kg × 5',
  );
  assert.equal(describeDrops(withDrops({ weight: 72.5, reps: 4 }), 'kg'), '1 drop · 72.5kg × 4');
});

test('there is a ceiling on how many drops one set can carry', () => {
  assert.ok(MAX_DROPS >= 2 && MAX_DROPS <= 6);
});
