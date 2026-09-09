import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  e1rm, e1rmBrzycki, loadForTarget, percentOfMax, confidenceFor,
  roundToIncrement, repsToFailure, tonnage,
} from '../js/engine/onerm.js';

test('a true single is its own 1RM', () => {
  assert.equal(e1rm(100, 1, 0), 100);
});

test('RIR is folded into reps to failure', () => {
  assert.equal(repsToFailure(8, 3), 11);
  // 8 reps with 3 left is the same effort as a hard set of 11
  assert.equal(e1rm(100, 8, 3), e1rm(100, 11, 0));
});

test('e1RM rises with reps and with reserve', () => {
  assert.ok(e1rm(100, 10, 0) > e1rm(100, 5, 0));
  assert.ok(e1rm(100, 5, 2) > e1rm(100, 5, 0));
});

test('rubbish input does not produce a number to act on', () => {
  assert.equal(e1rm(0, 5, 0), 0);
  assert.equal(e1rm(-20, 5, 0), 0);
  assert.equal(e1rm(undefined, 5, 0), 0);
  assert.equal(loadForTarget(0, 5, 0), 0);
});

test('loadForTarget inverts e1rm', () => {
  const max = e1rm(100, 8, 2);
  assert.ok(Math.abs(loadForTarget(max, 8, 2) - 100) < 1e-9);
});

test('percentOfMax falls as the set gets longer', () => {
  assert.ok(percentOfMax(1, 0) > percentOfMax(5, 0));
  assert.ok(percentOfMax(5, 0) > percentOfMax(12, 0));
  assert.ok(percentOfMax(1, 0) <= 1);
});

test('the two formulas cross at 10 reps and diverge either side', () => {
  assert.ok(Math.abs(e1rm(100, 10, 0) - e1rmBrzycki(100, 10, 0)) < 0.01);
  assert.ok(e1rmBrzycki(100, 3, 0) < e1rm(100, 3, 0));
  assert.ok(e1rmBrzycki(100, 15, 0) > e1rm(100, 15, 0));
});

test('confidence degrades with long sets', () => {
  assert.equal(confidenceFor(3, 1), 'high');
  assert.equal(confidenceFor(8, 2), 'medium');
  assert.equal(confidenceFor(15, 2), 'low');
});

test('loads round to what you can load on the bar', () => {
  assert.equal(roundToIncrement(63.7, 2.5), 62.5);
  assert.equal(roundToIncrement(64.0, 2.5), 65);
  assert.equal(roundToIncrement(61.2, 2.5), 60);
  assert.equal(roundToIncrement(61.2, 0), 61.2);
});

test('tonnage ignores warm-ups and unfinished sets', () => {
  const sets = [
    { weight: 60, reps: 10, done: true, warmup: true },
    { weight: 100, reps: 5, done: true },
    { weight: 100, reps: 5, done: false },
  ];
  assert.equal(tonnage(sets), 500);
});
