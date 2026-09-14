/**
 * The program editor's engine.
 *
 * The important property is not that editing works - it is that whatever comes
 * out is something the mesocycle engine can run without a single special case
 * for custom programs. Half of these tests exist to prove that.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  blankProgram, forkProgram, normalise, rirRamp,
  addDay, removeDay, updateDay, moveDay,
  addSlot, removeSlot, updateSlot, moveSlot, newSlot,
  validate, isRunnable, weeklySets, isCustomId,
  MAX_DAYS, MAX_SLOTS_PER_DAY,
} from '../js/engine/program-builder.js';
import { PROGRAMS, getProgram, registerPrograms, allPrograms } from '../js/data/programs.js';
import { newMesocycle, weekPlan, totalWeeks, nextSession } from '../js/engine/mesocycle.js';
import { plannedSetsByMuscle } from '../js/engine/volume.js';

const withDay = () => {
  let p = blankProgram({ days: 1 });
  const day = p.days[0].id;
  p = addSlot(p, day, 'bb-bench');
  p = addSlot(p, day, 'bb-row');
  return { program: p, day };
};

test('a blank program is not runnable until it has an exercise in it', () => {
  const p = blankProgram();
  assert.ok(!isRunnable(p));
  assert.ok(validate(p).some((x) => x.level === 'error' && /no exercises/.test(x.message)));
});

test('one day with one lift is enough to run', () => {
  const { program } = withDay();
  assert.ok(isRunnable(program), JSON.stringify(validate(program)));
});

test('custom programs are identifiable by id', () => {
  assert.ok(isCustomId(blankProgram().id));
  assert.ok(!isCustomId('ul4'));
  assert.ok(!isCustomId(undefined));
});

/* --- the rules that protect the engine --------------------------------- */

test('the same lift cannot go on a day twice', () => {
  // The session keys entries by exercise id, so a duplicate would have the two
  // slots writing over each other's sets.
  const { program, day } = withDay();
  const again = addSlot(program, day, 'bb-bench');
  assert.equal(again.days[0].slots.length, 2);
});

test('a day is capped at a length somebody might finish', () => {
  let p = blankProgram({ days: 1 });
  const day = p.days[0].id;
  for (const e of ['bb-bench', 'bb-row', 'back-squat', 'rdl', 'lat-pulldown', 'leg-press',
    'db-shoulder-press', 'cable-row', 'leg-extension', 'lying-leg-curl', 'lateral-raise',
    'pushdown', 'cable-curl', 'standing-calf']) p = addSlot(p, day, e);
  assert.equal(p.days[0].slots.length, MAX_SLOTS_PER_DAY);
});

test('days are capped too', () => {
  let p = blankProgram({ days: 1 });
  for (let i = 0; i < 12; i += 1) p = addDay(p);
  assert.equal(p.days.length, MAX_DAYS);
});

test('block length is clamped to something sane', () => {
  assert.equal(normalise({ days: [], accumulationWeeks: 99 }).accumulationWeeks, 6);
  assert.equal(normalise({ days: [], accumulationWeeks: 1 }).accumulationWeeks, 3);
  assert.equal(normalise({ days: [], accumulationWeeks: 'nonsense' }).accumulationWeeks, 3);
});

test('the effort ramp starts easy and never reaches failure', () => {
  for (const weeks of [3, 4, 5, 6]) {
    const ramp = rirRamp(weeks);
    assert.equal(ramp.length, weeks);
    assert.ok(ramp[0] >= ramp.at(-1), 'effort should climb, not fall');
    assert.ok(ramp.every((r) => r >= 1), 'no week should be programmed to failure');
  }
});

/* --- editing ----------------------------------------------------------- */

test('reordering moves one slot and leaves the rest alone', () => {
  const { program, day } = withDay();
  const moved = moveSlot(program, day, 'bb-row', -1);
  assert.deepEqual(moved.days[0].slots.map((s) => s.exerciseId), ['bb-row', 'bb-bench']);
  // And off the end is a no-op rather than a wrap-around.
  assert.deepEqual(moveSlot(moved, day, 'bb-row', -1).days[0].slots.map((s) => s.exerciseId),
    ['bb-row', 'bb-bench']);
});

test('removing a slot leaves the others intact', () => {
  const { program, day } = withDay();
  const after = removeSlot(program, day, 'bb-bench');
  assert.deepEqual(after.days[0].slots.map((s) => s.exerciseId), ['bb-row']);
});

test('editing never mutates the program handed in', () => {
  const { program, day } = withDay();
  const snapshot = JSON.stringify(program);
  addSlot(program, day, 'back-squat');
  removeSlot(program, day, 'bb-bench');
  updateSlot(program, day, 'bb-bench', { sets: 9 });
  moveDay(program, day, 1);
  assert.equal(JSON.stringify(program), snapshot);
});

test('day names fall back rather than going blank', () => {
  const { program, day } = withDay();
  assert.equal(updateDay(program, day, { name: '   ' }).days[0].name, 'Day A');
  assert.equal(updateDay(program, day, { name: 'Push' }).days[0].name, 'Push');
});

test('derived facts are recomputed on every edit', () => {
  let p = blankProgram({ days: 2 });
  assert.equal(p.daysPerWeek, 2);
  p = addDay(p);
  assert.equal(p.daysPerWeek, 3);
  assert.match(p.subtitle, /3 days/);
  p = removeDay(p, p.days[0].id);
  assert.equal(p.daysPerWeek, 2);
});

test('a new slot takes sensible defaults from the lift', () => {
  assert.equal(newSlot('bb-bench').role, 'secondary');      // compound
  assert.equal(newSlot('lateral-raise').role, 'accessory'); // isolation
  assert.equal(newSlot('bb-bench', { role: 'anchor' }).sets, 4);
  assert.equal(newSlot('lateral-raise').reps, null);        // the lift's own window
});

/* --- forking ----------------------------------------------------------- */

test('a fork copies the shape but shares no ids with its source', () => {
  const source = getProgram('ul4');
  const fork = forkProgram(source);
  assert.notEqual(fork.id, source.id);
  assert.equal(fork.forkedFrom, source.id);
  assert.equal(fork.days.length, source.days.length);
  for (const day of fork.days) {
    assert.ok(!source.days.some((d) => d.id === day.id), 'day ids must not be shared');
  }
  assert.deepEqual(
    fork.days.map((d) => d.slots.map((s) => s.exerciseId)),
    source.days.map((d) => d.slots.map((s) => s.exerciseId)),
  );
});

test('editing a fork cannot reach back into the template', () => {
  const source = getProgram('ul4');
  const before = JSON.stringify(source);
  let fork = forkProgram(source);
  fork = updateSlot(fork, fork.days[0].id, fork.days[0].slots[0].exerciseId, { sets: 8 });
  fork = removeDay(fork, fork.days[1].id);
  assert.equal(JSON.stringify(source), before);
});

/* --- the point of all of it: the engine runs it unchanged -------------- */

test('every built-in template survives a fork and still runs', () => {
  for (const template of PROGRAMS) {
    const fork = forkProgram(template);
    assert.ok(isRunnable(fork), `${template.name} forked into something unrunnable`);
    const meso = newMesocycle(fork);
    assert.equal(totalWeeks(fork), fork.accumulationWeeks + 1);
    const week = weekPlan(meso, [], 0, { program: fork });
    assert.equal(week.days.length, fork.days.length);
    assert.ok(week.days.every((d) => d.slots.length > 0));
  }
});

test('a hand-built program goes through the mesocycle engine like any other', () => {
  let p = blankProgram({ name: 'Mine', days: 2 });
  const [a, b] = p.days.map((d) => d.id);
  p = addSlot(p, a, 'bb-bench');
  p = addSlot(p, a, 'lat-pulldown');
  p = addSlot(p, b, 'back-squat');
  p = addSlot(p, b, 'lying-leg-curl');

  const meso = newMesocycle(p);
  assert.equal(meso.programId, p.id);

  // Volume climbs across the accumulation weeks and drops for the deload.
  const first = plannedSetsByMuscle(weekPlan(meso, [], 0, { program: p }).days);
  const peak = plannedSetsByMuscle(weekPlan(meso, [], p.accumulationWeeks - 1, { program: p }).days);
  const deload = plannedSetsByMuscle(weekPlan(meso, [], p.accumulationWeeks, { program: p }).days);
  assert.ok(peak.chest >= first.chest, 'volume should not fall during accumulation');
  assert.ok(deload.chest < peak.chest, 'the deload should actually deload');

  // Anything that resolves a program by id needs it in the library first, which
  // is why saving registers it and starting a block happens after saving.
  assert.equal(nextSession(meso, []), null);
  registerPrograms([p]);
  try {
    assert.equal(getProgram(p.id).name, 'Mine');
    assert.ok(allPrograms().some((x) => x.id === p.id));
    const next = nextSession(meso, []);
    assert.equal(next.day.id, a);
    assert.equal(next.weekIndex, 0);
  } finally {
    registerPrograms([]);
  }
});

test('a registered custom program does not shadow or disturb the templates', () => {
  const mine = blankProgram({ name: 'Mine' });
  registerPrograms([mine]);
  try {
    assert.equal(getProgram('ul4').name, 'Upper / Lower');
    assert.equal(allPrograms().length, PROGRAMS.length + 1);
  } finally {
    registerPrograms([]);
  }
  assert.equal(getProgram(mine.id), undefined);
  assert.equal(allPrograms().length, PROGRAMS.length);
});

test('effort ramps towards failure across the block, then backs off', () => {
  const { program } = withDay();
  const meso = newMesocycle(program);
  const first = weekPlan(meso, [], 0, { program }).targetRir;
  const last = weekPlan(meso, [], program.accumulationWeeks - 1, { program }).targetRir;
  const deload = weekPlan(meso, [], program.accumulationWeeks, { program }).targetRir;
  assert.ok(last <= first, 'later weeks should be no easier');
  assert.ok(deload > last, 'the deload should be easier than the hardest week');
});

test('weeklySets counts what the first week actually asks for', () => {
  const { program, day } = withDay();
  const base = weeklySets(program);
  assert.equal(base, program.days[0].slots.reduce((n, s) => n + s.sets, 0));
  assert.equal(weeklySets(updateSlot(program, day, 'bb-bench', { sets: 5 })), base + 2);
});

/* --- warnings, which inform without blocking --------------------------- */

test('a very long day warns but still runs', () => {
  let p = blankProgram({ days: 1 });
  const day = p.days[0].id;
  for (const e of ['bb-bench', 'bb-row', 'back-squat', 'rdl', 'lat-pulldown', 'leg-press',
    'db-shoulder-press', 'cable-row', 'leg-extension', 'lying-leg-curl']) p = addSlot(p, day, e);
  const problems = validate(p);
  assert.ok(problems.some((x) => x.level === 'warning'));
  assert.ok(isRunnable(p));
});

test('seven days a week warns about recovery', () => {
  let p = blankProgram({ days: 1 });
  for (let i = 0; i < 6; i += 1) p = addDay(p);
  for (const day of p.days) p = addSlot(p, day.id, 'bb-bench');
  assert.ok(validate(p).some((x) => x.level === 'warning' && /recover/.test(x.message)));
});
