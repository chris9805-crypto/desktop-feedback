/**
 * Lifts people add themselves.
 *
 * The muscle tags are the whole point - the same machine is not the same
 * stimulus for two different people - so these mostly guard the counting: a
 * custom lift has to be charged to muscles exactly the way a shipped one is,
 * or every volume number in the app quietly drifts.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  blankExercise, forkExercise, normalise, validate, isSaveable,
  defaultsFor, creditLine, isCustomExerciseId, EQUIPMENT,
} from '../js/engine/exercise-builder.js';
import {
  EXERCISES, allExercises, getExercise, registerExercises, volumeContribution, swapsFor,
} from '../js/data/exercises.js';
import { plannedSetsByMuscle } from '../js/engine/volume.js';
import { DRAWN_MUSCLES } from '../js/ui/muscle-map.js';
import { MUSCLE_DISPLAY_ORDER } from '../js/data/muscles.js';

const mine = (patch = {}) => normalise({
  ...blankExercise({ name: 'Hammer row', equipment: 'machine' }),
  primary: ['lats'], secondary: ['biceps'], ...patch,
});

test('a lift needs a name and somewhere you feel it', () => {
  assert.ok(!isSaveable(blankExercise()));
  assert.ok(validate(blankExercise({ name: 'Thing' })).some((p) => /at least one muscle/.test(p.message)));
  assert.ok(validate(normalise({ name: '', primary: ['lats'] })).some((p) => /name/.test(p.message)));
  assert.ok(isSaveable(mine()));
});

test('custom lifts are identifiable, and the shipped ones are not mistaken for them', () => {
  assert.ok(isCustomExerciseId(mine().id));
  assert.ok(!isCustomExerciseId('bb-bench'));
  assert.ok(!isCustomExerciseId(null));
});

test('a muscle cannot be counted twice for the same set', () => {
  // Primary wins. Tagged as both, a set would charge 1.5 towards one muscle and
  // silently inflate every volume figure the app shows.
  const ex = mine({ primary: ['lats'], secondary: ['lats', 'biceps'] });
  assert.deepEqual(ex.primary, ['lats']);
  assert.deepEqual(ex.secondary, ['biceps']);
  assert.deepEqual(volumeContribution(ex), { lats: 1, biceps: 0.5 });
});

test('duplicates and nonsense muscles are dropped', () => {
  const ex = mine({ primary: ['lats', 'lats', 'gizzard'], secondary: ['biceps', 'biceps'] });
  assert.deepEqual(ex.primary, ['lats']);
  assert.deepEqual(ex.secondary, ['biceps']);
});

test('every muscle a lift can be tagged with is one the map can draw', () => {
  // Otherwise somebody tags a muscle and the body diagram stays blank.
  const undrawable = MUSCLE_DISPLAY_ORDER.filter((m) => !DRAWN_MUSCLES.has(m));
  assert.deepEqual(undrawable, []);
});

test('defaults follow the kit, so only three questions need answering', () => {
  assert.equal(defaultsFor('machine').stability, 'high');
  assert.equal(defaultsFor('cable').stability, 'high');
  assert.equal(defaultsFor('dumbbell').stability, 'med');
  assert.equal(defaultsFor('barbell', 'compound').stability, 'low');
  // A barbell curl is not what the "do not grind this" rating is for.
  assert.equal(defaultsFor('barbell', 'isolation').stability, 'med');
  for (const kit of EQUIPMENT) assert.ok(defaultsFor(kit.id).inc > 0);
});

test('rubbish numbers fall back instead of poisoning the engine', () => {
  assert.deepEqual(normalise({ primary: ['lats'], reps: [12, 3] }).reps, [10, 15]);
  assert.deepEqual(normalise({ primary: ['lats'], reps: 'wat' }).reps, [10, 15]);
  assert.deepEqual(normalise({ primary: ['lats'], type: 'compound', reps: [0, 5] }).reps, [6, 10]);
  assert.equal(normalise({ primary: ['lats'], inc: -4 }).inc, 2.5);
  assert.equal(normalise({ primary: ['lats'], inc: 0 }).inc, 2.5);
  assert.equal(normalise({ primary: ['lats'], equipment: 'telekinesis' }).equipment, 'machine');
});

test('warnings inform without blocking', () => {
  const busy = mine({ primary: ['lats', 'biceps', 'upperBack', 'traps'] });
  assert.ok(validate(busy).some((p) => p.level === 'warning'));
  assert.ok(isSaveable(busy));

  const clash = validate(mine({ name: 'Hammer row' }), { existing: [mine({ name: 'Hammer row' })] });
  assert.ok(clash.some((p) => p.level === 'warning' && /already have/.test(p.message)));
});

test('copying a shipped lift keeps the shape and drops its identity', () => {
  const copy = forkExercise(getExercise('cable-row'));
  assert.notEqual(copy.id, 'cable-row');
  assert.ok(isCustomExerciseId(copy.id));
  assert.equal(copy.forkedFrom, 'cable-row');
  assert.deepEqual(copy.primary, getExercise('cable-row').primary);
  // Substitution lists point at the shipped library and mean nothing here.
  assert.deepEqual(copy.subs, []);
});

test('copying does not touch the original', () => {
  const before = JSON.stringify(getExercise('cable-row'));
  const copy = forkExercise(getExercise('cable-row'));
  copy.primary.push('chest');
  assert.equal(JSON.stringify(getExercise('cable-row')), before);
});

test('the credit line says what a set is worth in plain words', () => {
  assert.equal(creditLine(mine()), 'Lats 1 · Biceps ½');
});

/* --- the registry: a custom lift has to behave like any other ----------- */

test('a registered lift is found by everything that asks for one', () => {
  const ex = mine();
  registerExercises([ex]);
  try {
    assert.equal(getExercise(ex.id).name, 'Hammer row');
    assert.equal(allExercises().length, EXERCISES.length + 1);
    // And it does not shadow or disturb the shipped library.
    assert.equal(getExercise('bb-bench').name, 'Barbell bench press');
  } finally {
    registerExercises([]);
  }
  assert.equal(getExercise(ex.id), undefined);
  assert.equal(allExercises().length, EXERCISES.length);
});

test('a custom lift counts towards volume exactly like a shipped one', () => {
  const ex = mine({ primary: ['lats'], secondary: ['biceps'] });
  registerExercises([ex]);
  try {
    const totals = plannedSetsByMuscle([{ slots: [{ exerciseId: ex.id, sets: 4 }] }]);
    assert.equal(totals.lats, 4);
    assert.equal(totals.biceps, 2);
  } finally {
    registerExercises([]);
  }
});

test('swaps fall back to the same muscle when a lift has no list of its own', () => {
  const ex = mine({ primary: ['lats'] });
  registerExercises([ex]);
  try {
    const swaps = swapsFor(ex.id);
    assert.ok(swaps.length > 0, 'a custom lift should still offer swaps');
    assert.ok(swaps.every((id) => getExercise(id).primary.includes('lats')));
    assert.ok(!swaps.includes(ex.id), 'a lift is not its own substitute');
  } finally {
    registerExercises([]);
  }
});

test('shipped lifts keep their hand-picked swaps', () => {
  assert.deepEqual(swapsFor('bb-bench'), getExercise('bb-bench').subs);
});
