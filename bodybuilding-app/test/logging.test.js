/**
 * Carrying numbers forward, and reordering a session.
 *
 * Both of these come from actually using the app rather than from reading the
 * code. The first exercise of a first block asked for the same two numbers on
 * every single set, because there was no prescription to fall back on and
 * nothing carried across. And the order of a session is decided by which rack
 * is free, not by the program.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
};

const { store } = await import('../js/store.js');
const { getProgram } = await import('../js/data/programs.js');

beforeEach(() => { memory.clear(); store.reset(); });

const startFresh = () => {
  const meso = store.startMesocycle('ul4');
  store.startSession(meso.id, 0, 'upper-a');
  return meso;
};
const sets = (exerciseId = 'bb-bench') =>
  store.state.active.entries.find((e) => e.exerciseId === exerciseId).sets;

/* --------------------------------------------------------- carry forward */

test('a first-ever lift only asks for the weight once', () => {
  // This is the actual complaint: nothing is prescribed on a new lift, so every
  // set showed a blank box.
  startFresh();
  assert.equal(sets()[0].weight, null, 'nothing known yet');

  store.logSet('bb-bench', 0, { done: true, weight: 60, reps: 8, rir: 2 });

  for (let i = 1; i < sets().length; i++) {
    assert.equal(sets()[i].weight, 60, `set ${i + 1} should already say 60`);
    assert.equal(sets()[i].reps, 8, `set ${i + 1} should already say 8 reps`);
  }
});

test('effort is not carried forward - it is the one thing per set', () => {
  startFresh();
  store.logSet('bb-bench', 0, { done: true, weight: 60, reps: 8, rir: 2 });
  assert.equal(sets()[1].rir, null, 'how hard set two felt has not happened yet');
  assert.equal(sets()[1].done, false);
});

test('a weight you changed yourself is never overwritten', () => {
  // Putting five extra kilos on the last set has to keep working.
  startFresh();
  store.editSet('bb-bench', 3, { weight: 70 });
  store.logSet('bb-bench', 0, { done: true, weight: 60, reps: 8, rir: 2 });

  assert.equal(sets()[1].weight, 60, 'untouched sets follow the first');
  assert.equal(sets()[3].weight, 70, 'a deliberate change survives');
});

test('changing the load mid-exercise carries the new number on, not the old plan', () => {
  const meso = store.startMesocycle('ul4');
  store.startSession(meso.id, 0, 'upper-a');
  store.logSet('bb-bench', 0, { done: true, weight: 100, reps: 5, rir: 2 });
  store.finishSession();

  // Second week: the app prescribes something, and the lifter does otherwise.
  store.startSession(meso.id, 1, 'upper-a');
  const prescribed = store.state.active.entries[0].prescription.weight;
  assert.ok(prescribed > 0);
  store.editSet('bb-bench', 0, { weight: prescribed - 5 });
  store.logSet('bb-bench', 0, { done: true, weight: prescribed - 5, reps: 5, rir: 2 });

  assert.equal(sets()[1].weight, prescribed - 5,
    'the rest of the exercise should follow what actually happened');
});

test('sets already logged are left alone', () => {
  startFresh();
  store.logSet('bb-bench', 0, { done: true, weight: 60, reps: 8, rir: 2 });
  store.logSet('bb-bench', 1, { done: true, weight: 65, reps: 6, rir: 1 });
  // Re-completing set one must not rewrite set two's history.
  store.logSet('bb-bench', 0, { done: true, weight: 62, reps: 8, rir: 2 });
  assert.equal(sets()[1].weight, 65);
  assert.equal(sets()[1].reps, 6);
});

test('an extra set inherits from the last one performed', () => {
  startFresh();
  store.logSet('bb-bench', 0, { done: true, weight: 60, reps: 8, rir: 2 });
  store.addSet('bb-bench');
  const added = sets().at(-1);
  assert.equal(added.weight, 60);
  assert.equal(added.reps, 8);
  assert.equal(added.done, false);
  assert.equal(added.rir, null);
});

/* -------------------------------------------------------------- reorder */

test('an exercise can be moved up and down the session', () => {
  startFresh();
  const order = () => store.state.active.entries.map((e) => e.exerciseId);
  const original = order();

  store.moveEntry(original[2], -1);
  assert.equal(order()[1], original[2]);
  assert.equal(order()[2], original[1]);

  store.moveEntry(original[2], 1);
  assert.deepEqual(order(), original, 'moving back restores it');
});

test('moving past either end does nothing rather than throwing', () => {
  startFresh();
  const order = () => store.state.active.entries.map((e) => e.exerciseId);
  const original = order();
  store.moveEntry(original[0], -1);
  store.moveEntry(original.at(-1), 1);
  assert.deepEqual(order(), original);
});

test('"do later" moves an exercise behind everything still unfinished', () => {
  startFresh();
  const order = () => store.state.active.entries.map((e) => e.exerciseId);
  const first = order()[0];
  store.deferEntry(first);
  assert.equal(order().at(-1), first, 'the busy rack goes to the back of the queue');
});

test('"do later" does not send you back behind work you already finished', () => {
  startFresh();
  const entries = store.state.active.entries;
  // Finish the last exercise early, then defer the first.
  for (let i = 0; i < entries.at(-1).sets.length; i++) {
    store.logSet(entries.at(-1).exerciseId, i, { done: true, weight: 20, reps: 12, rir: 2 });
  }
  const finished = store.state.active.entries.at(-1).exerciseId;
  const first = store.state.active.entries[0].exerciseId;
  store.deferEntry(first);

  const order = store.state.active.entries.map((e) => e.exerciseId);
  assert.ok(order.indexOf(first) < order.indexOf(finished),
    '"later" should mean later in what is left, not after what is done');
});

test('an order can be kept for the rest of the block', () => {
  const meso = startFresh();
  store.moveEntry(store.state.active.entries[3].exerciseId, -3);
  const chosen = store.state.active.entries.map((e) => e.exerciseId);
  store.rememberOrder();
  store.logSet(chosen[0], 0, { done: true, weight: 50, reps: 8, rir: 2 });
  store.finishSession();

  const nextWeek = store.buildSession(meso.id, 1, 'upper-a');
  assert.deepEqual(nextWeek.entries.map((e) => e.exerciseId), chosen);
  assert.equal(nextWeek.reordered, true);
});

test('a saved order is a preference, not a constraint', () => {
  // An exercise the saved order does not mention must still appear.
  const meso = startFresh();
  store.update((s) => ({
    ...s,
    mesocycles: s.mesocycles.map((m) => (m.id === meso.id
      ? { ...m, dayOrder: { 'upper-a': ['lat-pulldown', 'bb-bench'] } }
      : m)),
  }));
  const built = store.buildSession(meso.id, 0, 'upper-a');
  const ids = built.entries.map((e) => e.exerciseId);
  assert.equal(ids[0], 'lat-pulldown');
  assert.equal(ids[1], 'bb-bench');
  assert.equal(ids.length, getProgram('ul4').days.find((d) => d.id === 'upper-a').slots.length,
    'nothing may be dropped just because the saved order predates it');
});

test('a saved order applies only to its own day and block', () => {
  const meso = startFresh();
  store.moveEntry(store.state.active.entries[2].exerciseId, -2);
  const chosen = store.state.active.entries.map((e) => e.exerciseId);
  store.rememberOrder();

  const otherDay = store.buildSession(meso.id, 0, 'upper-b');
  assert.notDeepEqual(otherDay.entries.map((e) => e.exerciseId), chosen);
  assert.equal(otherDay.reordered, false);

  const otherBlock = store.startMesocycle('ul4');
  assert.equal(store.buildSession(otherBlock.id, 0, 'upper-a').reordered, false,
    'a new block starts from the program, not from last block\'s gym layout');
});

test('a saved order can be reset', () => {
  const meso = startFresh();
  store.rememberOrder();
  assert.ok(store.savedOrderFor(meso.id, 'upper-a'));
  store.forgetOrder(meso.id, 'upper-a');
  assert.equal(store.savedOrderFor(meso.id, 'upper-a'), null);
});

test('reordering does not change the training itself', () => {
  const meso = startFresh();
  const before = store.buildSession(meso.id, 0, 'upper-a');
  const plannedSets = Object.fromEntries(before.entries.map((e) => [e.exerciseId, e.prescription.sets]));
  store.moveEntry(store.state.active.entries.at(-1).exerciseId, -4);
  store.rememberOrder();

  const after = store.buildSession(meso.id, 0, 'upper-a');
  assert.equal(after.entries.length, before.entries.length);
  for (const entry of after.entries) {
    assert.equal(entry.prescription.sets, plannedSets[entry.exerciseId],
      `${entry.exerciseId} changed sets just from being moved`);
  }
});

test('an exercise can be deferred part-way through without losing what you did', () => {
  // Somebody taking the bench between your sets is exactly when this is needed.
  startFresh();
  const first = store.state.active.entries[0].exerciseId;
  store.logSet(first, 0, { done: true, weight: 60, reps: 8, rir: 2 });
  store.logSet(first, 1, { done: true, weight: 60, reps: 8, rir: 2 });

  store.deferEntry(first);
  const moved = store.state.active.entries.find((e) => e.exerciseId === first);
  assert.equal(store.state.active.entries.at(-1).exerciseId, first, 'it moves to the back');
  assert.equal(moved.sets.filter((x) => x.done).length, 2, 'the sets you did stay done');
  assert.equal(moved.sets[2].weight, 60, 'and the remaining sets keep their numbers');
});
