/**
 * End-to-end behaviour of the log: start a block, train it, and check that
 * next week's prescription actually reflects what happened this week.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// A minimal localStorage so the store can run outside a browser.
const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
};

const { store, KG_PER_LB } = await import('../js/store.js');
const { getProgram } = await import('../js/data/programs.js');
const { e1rm } = await import('../js/engine/onerm.js');

beforeEach(() => { memory.clear(); store.reset(); });

/** Train every set of the active session at a fixed performance. */
function trainSession({ reps = null, rir = 2, weight = null } = {}) {
  const active = store.state.active;
  for (const entry of active.entries) {
    const p = entry.prescription;
    for (let i = 0; i < entry.sets.length; i++) {
      store.logSet(entry.exerciseId, i, {
        weight: weight ?? p.weight ?? 60,
        reps: reps ?? p.targetReps,
        rir: rir ?? p.targetRir,
        done: true,
      });
    }
  }
  return store.finishSession();
}

test('a block starts on week one, day one', () => {
  const meso = store.startMesocycle('ul4');
  const next = store.nextUp();
  assert.equal(next.weekIndex, 0);
  assert.equal(next.day.id, 'upper-a');
  assert.equal(store.activeMeso().id, meso.id);
});

test('starting a new block archives the old one instead of losing it', () => {
  const first = store.startMesocycle('ul4');
  const second = store.startMesocycle('ppl6');
  assert.equal(store.state.mesocycles.length, 2);
  assert.equal(store.state.mesocycles.find((m) => m.id === first.id).status, 'archived');
  assert.equal(store.activeMeso().id, second.id);
});

test('a finished session advances the plan and is never re-served', () => {
  const meso = store.startMesocycle('ul4');
  store.startSession(meso.id, 0, 'upper-a');
  const session = trainSession();
  assert.ok(session.entries.length > 0);
  assert.equal(store.state.active, null);
  const next = store.nextUp();
  assert.notEqual(next.day.id, 'upper-a');
  assert.equal(next.weekIndex, 0, 'still in week one until the week is finished');
});

test('the week rolls over only once every day in it is done', () => {
  const meso = store.startMesocycle('ul4');
  const program = getProgram('ul4');
  for (const day of program.days) {
    store.startSession(meso.id, 0, day.id);
    trainSession();
  }
  assert.equal(store.nextUp().weekIndex, 1, 'a completed week moves the block forward');
});

test('next week is calculated from what you actually lifted', () => {
  const meso = store.startMesocycle('ul4');
  store.startSession(meso.id, 0, 'upper-a');
  // Bench at 100kg for the top of the window, at the planned effort.
  store.logSet('bb-bench', 0, { weight: 100, reps: 8, rir: 3, done: true });
  store.finishSession();

  const built = store.buildSession(meso.id, 1, 'upper-a');
  const bench = built.entries.find((e) => e.exerciseId === 'bb-bench');
  assert.equal(bench.prescription.tag, 'load-up');
  assert.ok(bench.prescription.weight > 100);
  assert.equal(bench.prescription.previous.weight, 100);
  assert.ok(bench.prescription.rationale.includes('8 reps'));
});

test('a session left far from failure gets corrected, not repeated', () => {
  const meso = store.startMesocycle('ul4');
  store.startSession(meso.id, 0, 'upper-a');
  store.logSet('bb-bench', 0, { weight: 60, reps: 8, rir: 6, done: true });
  store.finishSession();
  const bench = store.buildSession(meso.id, 1, 'upper-a').entries.find((e) => e.exerciseId === 'bb-bench');
  assert.equal(bench.prescription.tag, 'load-up');
  assert.ok(bench.prescription.weight > 60);
});

test('an unfamiliar lift is seeded from history on the same movement', () => {
  const meso = store.startMesocycle('ul4');
  store.startSession(meso.id, 0, 'upper-a');
  store.logSet('bb-bench', 0, { weight: 100, reps: 5, rir: 2, done: true });
  store.finishSession();
  const seed = store.seedE1rmFor('bb-bench');
  assert.ok(Math.abs(seed - e1rm(100, 5, 2)) < 0.01);

  // A different block, same lift: it should not ask you to guess again.
  const second = store.startMesocycle('phul4');
  const built = store.buildSession(second.id, 0, 'power-upper');
  const bench = built.entries.find((e) => e.exerciseId === 'bb-bench');
  assert.ok(bench.prescription.weight > 0, 'known strength should carry across blocks');
});

test('unfinished sets never reach the log', () => {
  const meso = store.startMesocycle('ul4');
  store.startSession(meso.id, 0, 'upper-a');
  store.logSet('bb-bench', 0, { weight: 100, reps: 5, rir: 2, done: true });
  store.logSet('bb-bench', 1, { weight: 100, reps: 5, rir: 2, done: false });
  const session = store.finishSession();
  const bench = session.entries.find((e) => e.exerciseId === 'bb-bench');
  assert.equal(bench.sets.length, 1);
});

test('swapping an exercise keeps the slot and re-prescribes for the new movement', () => {
  const meso = store.startMesocycle('ul4');
  store.startSession(meso.id, 0, 'upper-a');
  store.swapExercise('bb-bench', 'db-bench');
  const entry = store.state.active.entries.find((e) => e.exerciseId === 'db-bench');
  assert.ok(entry, 'the slot now holds the substitute');
  assert.equal(entry.swappedFrom, 'bb-bench');
  assert.equal(store.state.active.entries.some((e) => e.exerciseId === 'bb-bench'), false);
});

test('changing units converts the whole history, not just new entries', () => {
  const meso = store.startMesocycle('ul4');
  store.startSession(meso.id, 0, 'upper-a');
  store.logSet('bb-bench', 0, { weight: 100, reps: 5, rir: 2, done: true });
  store.finishSession();

  store.setUnit('lb');
  const logged = store.state.sessions[0].entries[0].sets[0].weight;
  assert.ok(Math.abs(logged - 100 / KG_PER_LB) < 0.5, `expected ~220lb, got ${logged}`);

  store.setUnit('kg');
  const back = store.state.sessions[0].entries[0].sets[0].weight;
  assert.ok(Math.abs(back - 100) < 0.5, 'a round trip must not drift the log');
});

test('export and import round-trip the whole training history', () => {
  const meso = store.startMesocycle('ul4');
  store.startSession(meso.id, 0, 'upper-a');
  store.logSet('bb-bench', 0, { weight: 100, reps: 5, rir: 2, done: true });
  store.finishSession();

  const json = store.exportJson();
  store.reset();
  assert.equal(store.state.sessions.length, 0);

  store.importJson(json);
  assert.equal(store.state.sessions.length, 1);
  assert.equal(store.state.sessions[0].entries[0].sets[0].weight, 100);
  assert.throws(() => store.importJson('{"nope":true}'), /IronBlock export/);
});

test('deleting a session also frees the day it completed', () => {
  const meso = store.startMesocycle('ul4');
  store.startSession(meso.id, 0, 'upper-a');
  const session = trainSession();
  assert.equal(store.nextUp().day.id, 'lower-a');
  store.deleteSession(session.id);
  assert.equal(store.nextUp().day.id, 'upper-a', 'the day becomes available again');
});

test('the store survives storage being unavailable', () => {
  const original = globalThis.localStorage.setItem;
  globalThis.localStorage.setItem = () => { throw new Error('blocked'); };
  try {
    store.startMesocycle('ul4');
    assert.equal(store.persistFailed, true, 'the failure is recorded so the UI can warn');
    assert.ok(store.activeMeso(), 'the session still works in memory');
  } finally {
    globalThis.localStorage.setItem = original;
  }
});

test('feedback recorded after a session shapes the next week', () => {
  const meso = store.startMesocycle('ul4');
  const program = getProgram('ul4');
  for (const day of program.days) {
    store.startSession(meso.id, 0, day.id);
    store.setFeedback('chest', { soreness: 3, pump: 3, joint: 0 });
    trainSession();
  }
  const week0 = store.buildSession(meso.id, 0, 'upper-a');
  const week1 = store.buildSession(meso.id, 1, 'upper-a');
  const benchSets = (b) => b.entries.find((e) => e.exerciseId === 'bb-bench').prescription.sets;
  const chestTotal = (b) => b.entries
    .filter((e) => ['bb-bench', 'incline-db-press'].includes(e.exerciseId))
    .reduce((n, e) => n + e.prescription.sets, 0);
  assert.ok(chestTotal(week1) <= chestTotal(week0), 'a chest that never recovered should not get more work');
  assert.ok(benchSets(week1) >= 1);
});

test('blocks started back to back get distinct identities', () => {
  // Two mesocycles created in the same millisecond must not collide - a shared
  // id silently files your training under the wrong block.
  const ids = new Set();
  for (let i = 0; i < 50; i++) ids.add(store.startMesocycle(i % 2 ? 'ul4' : 'phul4').id);
  assert.equal(ids.size, 50);
});

test('sessions logged in the same millisecond stay separate records', () => {
  const meso = store.startMesocycle('ul4');
  const ids = new Set();
  for (const dayId of ['upper-a', 'lower-a', 'upper-b', 'lower-b']) {
    store.startSession(meso.id, 0, dayId);
    store.logSet(store.state.active.entries[0].exerciseId, 0, { weight: 50, reps: 8, rir: 2, done: true });
    ids.add(store.finishSession().id);
  }
  assert.equal(ids.size, 4);
});

test('a second block starts heavier than the first one did', () => {
  // The point of block periodisation: the deload converts accumulated fatigue
  // into strength, and the next block has to start from that new level.
  const first = store.startMesocycle('ul4');
  const opening = store.buildSession(first.id, 0, 'upper-a')
    .entries.find((e) => e.exerciseId === 'bb-bench').prescription;
  assert.equal(opening.weight, null, 'nothing known yet, so it asks');

  // Run a block where bench climbs from 100x5 to 100x8.
  for (let week = 0; week < 4; week++) {
    store.startSession(first.id, week, 'upper-a');
    store.logSet('bb-bench', 0, { weight: 100, reps: 5 + week, rir: 2, done: true });
    store.finishSession();
  }

  const second = store.startMesocycle('ul4');
  const restart = store.buildSession(second.id, 0, 'upper-a')
    .entries.find((e) => e.exerciseId === 'bb-bench').prescription;
  assert.ok(restart.weight > 100,
    `second block should open above 100kg for the same 5 reps, got ${restart.weight}`);
  // It carries the real logged history across the block boundary rather than
  // falling back to an estimate, so week one of block two continues the
  // progression instead of restarting it.
  assert.equal(restart.tag, 'load-up');
  assert.equal(restart.previous.weight, 100);
  assert.equal(restart.previous.reps, 8);
});

test('a weight typed just before ticking the set is the one that gets logged', () => {
  // The set rows close over their data when drawn, and typing in a field
  // updates the store without a re-render. Anything reading the captured copy
  // sees the value from before the edit - which silently dropped the weight on
  // every first session, where there is no prescribed load to fall back to.
  const meso = store.startMesocycle('ul4');
  store.startSession(meso.id, 0, 'upper-a');
  const stale = store.state.active.entries[0].sets[0];
  assert.equal(stale.weight, null, 'first session has nothing prescribed yet');

  store.logSet('bb-bench', 0, { weight: 62.5 });          // what typing does
  assert.equal(stale.weight, null, 'the captured copy stays behind, by design');

  const live = store.state.active.entries[0].sets[0];      // what the tick must read
  assert.equal(live.weight, 62.5);

  store.logSet('bb-bench', 0, { done: true, weight: live.weight, reps: 5, rir: 2 });
  const session = store.finishSession();
  assert.equal(session.entries[0].sets[0].weight, 62.5);
});
