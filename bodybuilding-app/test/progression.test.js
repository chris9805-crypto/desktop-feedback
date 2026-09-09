import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  prescribe, targetRirFor, setChangeFromFeedback, referenceSet, bestSet,
  loadStep, incrementFor, isDeloadWeek, strengthTrend,
} from '../js/engine/progression.js';
import { getExercise } from '../js/data/exercises.js';
import { getProgram } from '../js/data/programs.js';

const program = getProgram('ul4');              // rirByWeek [3,2,1,0], 4 accumulation weeks
const bench = getExercise('bb-bench');          // compound, low stability, inc 2.5
const lateral = getExercise('lateral-raise');   // isolation, inc 1

const slotFor = (exercise, sets = 4, reps = null) => ({ exerciseId: exercise.id, sets, reps, restSec: null });
const entry = (sets) => ({ sets });
const set = (weight, reps, rir) => ({ weight, reps, rir, done: true, warmup: false });

const run = (o) => prescribe({ program, unit: 'kg', ...o });

test('the reference set is the first working set, not the best or last', () => {
  const sets = [set(60, 10, 5), set(100, 5, 2), set(100, 4, 0)];
  sets[0].warmup = true;
  assert.equal(referenceSet(sets).weight, 100);
  assert.equal(referenceSet(sets).reps, 5);
});

test('bestSet picks the highest estimated max, not the heaviest bar', () => {
  // 100kg x 8 with 2 left is 10 reps to failure -> ~133kg
  // 110kg x 3 with 3 left is 6 reps to failure  -> ~132kg
  const sets = [set(100, 8, 2), set(110, 3, 3)];
  assert.equal(bestSet(sets).weight, 100);
});

test('planned effort tightens across the block', () => {
  const rirs = [0, 1, 2, 3].map((w) => targetRirFor(program, w, lateral));
  assert.deepEqual(rirs, [3, 2, 1, 0]);
});

test('heavy axial lifts never get prescribed to failure', () => {
  // week 4 calls for 0 RIR, but a low-stability barbell lift floors at 1
  assert.equal(targetRirFor(program, 3, bench), 1);
  assert.equal(targetRirFor(program, 3, lateral), 0);
});

test('deload week is detected past the accumulation weeks', () => {
  assert.equal(isDeloadWeek(program, 3), false);
  assert.equal(isDeloadWeek(program, 4), true);
});

test('first exposure asks for a load instead of inventing one', () => {
  const p = run({ exercise: bench, slot: slotFor(bench), weekIndex: 0, previous: null });
  assert.equal(p.weight, null);
  assert.equal(p.tag, 'establish');
  assert.match(p.rationale, /First exposure/);
});

test('first exposure is seeded when an earlier block left an estimated max', () => {
  const p = run({ exercise: bench, slot: slotFor(bench), weekIndex: 0, previous: null, seedE1rm: 140 });
  assert.equal(p.tag, 'establish');
  assert.ok(p.weight > 0 && p.weight < 140);
  assert.equal(p.weight % 2.5, 0);
});

test('topping out the rep range at target effort adds load and resets reps', () => {
  // slot window 5-8; 8 reps at 2 RIR in week 2 (target 2)
  const p = run({
    exercise: bench, slot: { ...slotFor(bench), reps: [5, 8] }, weekIndex: 1,
    previous: entry([set(100, 8, 2)]),
  });
  assert.equal(p.tag, 'load-up');
  assert.ok(p.weight > 100);
  assert.equal(p.targetReps, 5, 'reps reset to the bottom of the window');
});

test('being well inside the window at target effort adds a rep, not load', () => {
  const p = run({
    exercise: bench, slot: { ...slotFor(bench), reps: [5, 8] }, weekIndex: 1,
    previous: entry([set(100, 6, 2)]),
  });
  assert.equal(p.tag, 'rep-up');
  assert.equal(p.weight, 100);
  assert.equal(p.targetReps, 7);
});

test('a rep-up never overshoots the top of the window', () => {
  const p = run({
    exercise: lateral, slot: { ...slotFor(lateral, 3), reps: [12, 15] }, weekIndex: 1,
    previous: entry([set(12, 15, 3)]),
  });
  assert.ok(p.targetReps <= 15);
});

test('far too much left in reserve is corrected in one jump', () => {
  // week 3 targets 1 RIR; 4 left means the load was wrong, not the plan
  const p = run({
    exercise: lateral, slot: { ...slotFor(lateral, 3), reps: [12, 15] }, weekIndex: 2,
    previous: entry([set(10, 13, 4)]),
  });
  assert.equal(p.tag, 'load-up');
  assert.ok(p.weight > 10);
  // capped at +8%, but always at least one plate increment or the jump is unactionable
  const ceiling = Math.max(10 * 1.08, 10 + incrementFor(lateral, 'kg'));
  assert.ok(p.weight <= ceiling + 1e-9, 'a correction, not a leap');
});

test('missing the bottom of the rep window backs the load off', () => {
  const p = run({
    exercise: bench, slot: { ...slotFor(bench), reps: [5, 8] }, weekIndex: 1,
    previous: entry([set(120, 3, 1)]),
  });
  assert.equal(p.tag, 'back-off');
  assert.ok(p.weight < 120);
  assert.equal(p.targetReps, 5);
});

test('training harder than planned consolidates instead of piling on', () => {
  // week 1 asks for 3 RIR, the set came in at 1
  const p = run({
    exercise: bench, slot: { ...slotFor(bench), reps: [5, 8] }, weekIndex: 0,
    previous: entry([set(100, 6, 1)]),
  });
  assert.equal(p.tag, 'hold');
  assert.equal(p.weight, 100);
  assert.equal(p.targetReps, 6);
});

test('deload drops load, halves sets and backs off effort', () => {
  const p = run({
    exercise: bench, slot: slotFor(bench, 4), weekIndex: 4,
    previous: entry([set(100, 6, 1)]),
  });
  assert.equal(p.tag, 'deload');
  assert.equal(p.sets, 2);
  assert.ok(p.weight < 100);
  assert.equal(p.targetRir, 4);
});

test('load steps scale with the bar but never go below the plates', () => {
  assert.equal(loadStep(bench, 60, 'kg'), 2.5);   // 2.5% of 60 is under the increment
  assert.equal(loadStep(bench, 200, 'kg'), 5);    // 2.5% of 200 earns a bigger jump
  assert.equal(loadStep(lateral, 10, 'kg'), 1);
});

test('imperial users get plate-legal increments', () => {
  assert.equal(incrementFor(bench, 'lb'), 5);
  assert.equal(incrementFor(lateral, 'lb'), 2.5);
  assert.equal(incrementFor(bench, 'kg'), 2.5);
});

test('prescriptions always carry the reasoning that produced them', () => {
  const cases = [
    { weekIndex: 1, previous: entry([set(100, 8, 2)]) },
    { weekIndex: 1, previous: entry([set(100, 6, 2)]) },
    { weekIndex: 1, previous: entry([set(120, 3, 1)]) },
    { weekIndex: 0, previous: entry([set(100, 6, 1)]) },
    { weekIndex: 4, previous: entry([set(100, 6, 1)]) },
    { weekIndex: 0, previous: null },
  ];
  for (const c of cases) {
    const p = run({ exercise: bench, slot: { ...slotFor(bench), reps: [5, 8] }, ...c });
    assert.ok(p.rationale.length > 40, `thin rationale for ${p.tag}`);
    assert.ok(p.sets >= 1);
    assert.ok(p.targetReps >= 1);
  }
});

test('feedback moves next week volume in the right direction', () => {
  assert.equal(setChangeFromFeedback({ soreness: 0, pump: 0, joint: 0 }).delta, 2);
  assert.equal(setChangeFromFeedback({ soreness: 1, pump: 2, joint: 0 }).delta, 1);
  assert.equal(setChangeFromFeedback({ soreness: 2, pump: 2, joint: 0 }).delta, 0);
  assert.equal(setChangeFromFeedback({ soreness: 3, pump: 3, joint: 0 }).delta, -1);
});

test('joint pain overrides every other signal', () => {
  assert.equal(setChangeFromFeedback({ soreness: 0, pump: 0, joint: 2 }).delta, -1);
  assert.equal(setChangeFromFeedback({ soreness: 0, pump: 0, joint: 3 }).delta, -2);
});

test('strength trend reads the direction of travel', () => {
  const up = strengthTrend([
    { date: 1, sets: [set(100, 5, 2)] },
    { date: 2, sets: [set(105, 5, 2)] },
  ]);
  assert.equal(up.direction, 'up');
  assert.ok(up.changePct > 0);
  assert.equal(strengthTrend([{ date: 1, sets: [set(100, 5, 2)] }]).direction, 'flat');
});

test('a full block of on-plan sessions produces monotonic progress', () => {
  // Simulate a lifter who hits every target exactly at the planned effort.
  let previous = null;
  let last = { weight: 100, e1rm: 0 };
  for (let week = 0; week < 4; week++) {
    const p = run({
      exercise: bench, slot: { ...slotFor(bench), reps: [5, 8] }, weekIndex: week, previous,
    });
    const weight = p.weight ?? 100;
    previous = entry([set(weight, p.targetReps, p.targetRir)]);
    const e = weight * (1 + (p.targetReps + p.targetRir) / 30);
    assert.ok(e >= last.e1rm, `week ${week + 1} went backwards`);
    last = { weight, e1rm: e };
  }
  assert.ok(last.weight >= 100);
});

test('a set logged with no load is ignored rather than trusted', () => {
  // Weight null means nobody wrote the number down. Prescribing from it would
  // produce a confident, wrong load next week.
  const sets = [
    { weight: null, reps: 8, rir: 2, done: true, warmup: false },
    { weight: 100, reps: 6, rir: 2, done: true, warmup: false },
  ];
  assert.equal(referenceSet(sets).weight, 100);
  assert.equal(bestSet(sets).weight, 100);
});

test('zero is a real load, not a missing one', () => {
  // Bodyweight pull-ups: the engine should start adding weight from here.
  const sets = [{ weight: 0, reps: 9, rir: 1, done: true, warmup: false }];
  assert.equal(referenceSet(sets).weight, 0);
  const pullup = getExercise('pullup');
  const p = run({
    exercise: pullup, slot: { ...slotFor(pullup, 4), reps: [5, 9] }, weekIndex: 2,
    previous: entry(sets),
  });
  assert.equal(p.tag, 'load-up');
  assert.ok(p.weight > 0, 'a full bodyweight set at the top of the range earns added load');
});
