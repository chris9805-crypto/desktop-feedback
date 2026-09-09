/**
 * Training modes.
 *
 * The thing worth guarding here is that a mode changes the *training* and not
 * just the copy. A "beginner mode" that shows friendlier words while still
 * sending someone to failure on a barbell squat in week four is worse than no
 * mode at all, because it claims a safety it does not provide.
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
const { MODES, MODE_ORDER, getMode, biasedRepRange, DEFAULT_MODE } = await import('../js/data/modes.js');
const { prescribe, targetRirFor, loadStep } = await import('../js/engine/progression.js');
const { getProgram, PROGRAMS } = await import('../js/data/programs.js');
const { getExercise, EXERCISES } = await import('../js/data/exercises.js');
const { newMesocycle, weekPlan } = await import('../js/engine/mesocycle.js');
const { plannedSetsByMuscle } = await import('../js/engine/volume.js');
const { MUSCLES } = await import('../js/data/muscles.js');
const explain = await import('../js/ui/explain.js');

beforeEach(() => { memory.clear(); store.reset(); });

const program = getProgram('ul4');           // rirByWeek [3,2,1,0]
const bench = getExercise('bb-bench');       // low stability, floors at 1 RIR
const legExt = getExercise('leg-extension'); // high stability, safe to failure
const set = (weight, reps, rir) => ({ weight, reps, rir, done: true, warmup: false });
const slot = (exercise, sets = 4, reps = null) => ({ exerciseId: exercise.id, sets, reps, restSec: null });
const run = (o) => prescribe({ program, unit: 'kg', ...o });

/* ------------------------------------------------------------- metadata */

test('every mode is fully specified', () => {
  assert.deepEqual(MODE_ORDER, ['beginner', 'intermediate', 'advanced']);
  for (const id of MODE_ORDER) {
    const mode = MODES[id];
    assert.ok(mode.name && mode.tagline && mode.summary, `${id} is missing its description`);
    assert.ok(mode.priorities.length >= 3, `${id} should say what it is optimising for`);
    assert.ok(Array.isArray(mode.setChecks) && Array.isArray(mode.sessionCards));
    assert.ok(mode.sessionCards.length >= 3, `${id} should ask enough after a session to be useful`);
    assert.ok(typeof mode.rirFloor === 'number');
  }
  assert.equal(getMode('nonsense').id, DEFAULT_MODE, 'an unknown mode falls back rather than throwing');
});

/* ----------------------------------------------------- effort ceilings */

test('a beginner is never sent within two reps of failure', () => {
  // Not on any exercise, not in any week, including the last hard week where
  // the program itself calls for 0 RIR.
  for (const exercise of EXERCISES) {
    for (let week = 0; week < program.accumulationWeeks; week++) {
      const rir = targetRirFor(program, week, exercise, 'beginner');
      assert.ok(rir >= 2, `${exercise.id} week ${week + 1} prescribed ${rir} RIR to a beginner`);
    }
  }
});

test('an advanced lifter can go to failure on stable movements but not under a bar', () => {
  assert.equal(targetRirFor(program, 3, legExt, 'advanced'), 0);
  assert.equal(targetRirFor(program, 3, bench, 'advanced'), 1, 'the movement floor still applies');
});

test('the middle mode caps effort by movement, not by mode', () => {
  assert.equal(targetRirFor(program, 3, legExt, 'intermediate'), 0);
  assert.equal(targetRirFor(program, 3, bench, 'intermediate'), 1);
});

/* --------------------------------------------------------- rep windows */

test('beginner rep windows shift up, away from heavy low-rep work', () => {
  assert.deepEqual(biasedRepRange([5, 8], 'beginner'), [7, 10]);
  assert.deepEqual(biasedRepRange([5, 8], 'intermediate'), [5, 8]);
  assert.deepEqual(biasedRepRange([5, 8], 'advanced'), [5, 8]);

  const p = run({ exercise: bench, slot: { ...slot(bench), reps: [5, 8] }, weekIndex: 0, mode: 'beginner' });
  assert.deepEqual(p.repRange, [7, 10]);
  assert.ok(p.targetRir >= 2);
});

test('rep windows never bias into territory nobody trains in', () => {
  for (const exercise of EXERCISES) {
    const [min, max] = biasedRepRange(exercise.reps, 'beginner');
    assert.ok(max <= 25 && min < max, `${exercise.id} biased to ${min}-${max}`);
  }
});

/* ------------------------------------------------------ load progression */

test('beginners add load in half-size steps', () => {
  const at = (mode, from) => run({
    exercise: bench, slot: { ...slot(bench), reps: [5, 8] }, weekIndex: 1, mode,
    previous: { sets: [set(from, 20, 2)] },   // way past the top of any window
    formHistory: { lastFormPoor: false, consecutiveTopOfRange: 5 },
  }).weight - from;

  // At a heavy load the percentage step is large enough for the halving to bite.
  assert.ok(at('beginner', 300) < at('intermediate', 300),
    'a beginner should not be jumping as fast');
  assert.ok(at('beginner', 300) > 0, 'but the weight still goes up');

  // At a light load both land on the smallest plate jump, because you cannot
  // add half a plate. That is the right answer, not a bug in the halving.
  assert.equal(at('beginner', 60), at('intermediate', 60));
  assert.equal(at('beginner', 60), 2.5);
});

test('a beginner proves the weight twice before it goes up', () => {
  const ctx = {
    exercise: bench, slot: { ...slot(bench), reps: [5, 8] }, weekIndex: 1, mode: 'beginner',
    previous: { sets: [set(100, 10, 3)] },   // top of the biased 7-10 window
  };
  const first = run({ ...ctx, formHistory: { lastFormPoor: false, consecutiveTopOfRange: 1 } });
  assert.equal(first.tag, 'consolidate');
  assert.equal(first.weight, 100, 'same weight until it has been done twice');

  const second = run({ ...ctx, formHistory: { lastFormPoor: false, consecutiveTopOfRange: 2 } });
  assert.equal(second.tag, 'load-up');
  assert.ok(second.weight > 100);
});

test('an intermediate does not have to prove it twice', () => {
  const p = run({
    exercise: bench, slot: { ...slot(bench), reps: [5, 8] }, weekIndex: 1, mode: 'intermediate',
    previous: { sets: [set(100, 8, 2)] },
    formHistory: { lastFormPoor: false, consecutiveTopOfRange: 1 },
  });
  assert.equal(p.tag, 'load-up');
});

/* ------------------------------------------------- form gates the load */

test('technique that broke down stops the weight going up', () => {
  // Mid-window, so without the gate this would be a "add a rep" week. Asking
  // for another rep on a movement someone is fighting is still asking for more.
  const ctx = {
    exercise: bench, slot: { ...slot(bench), reps: [5, 8] }, weekIndex: 1,
    previous: { sets: [set(100, 8, 2)] },
    formHistory: { lastFormPoor: true, consecutiveTopOfRange: 3 },
  };
  for (const mode of ['beginner', 'intermediate']) {
    const p = run({ ...ctx, mode });
    assert.equal(p.tag, 'hold-form', `${mode} should refuse to load a movement being fought`);
    assert.equal(p.weight, 100);
  }
  // An advanced lifter reporting rough form is reporting a hard set. They are
  // told, and they decide.
  const advanced = run({ ...ctx, mode: 'advanced' });
  assert.equal(advanced.tag, 'load-up', 'progression continues as normal');
  assert.ok(advanced.weight > 100);
});

test('missing the reps still backs the load off, even with poor form', () => {
  // Reducing load is always allowed - the gate stops you adding, not correcting.
  const p = run({
    exercise: bench, slot: { ...slot(bench), reps: [5, 8] }, weekIndex: 1, mode: 'intermediate',
    previous: { sets: [set(140, 3, 0)] },
    formHistory: { lastFormPoor: true, consecutiveTopOfRange: 0 },
  });
  assert.equal(p.tag, 'back-off');
  assert.ok(p.weight < 140);
});

test('poor form also blocks the big recalibration jump', () => {
  const p = run({
    exercise: legExt, slot: { ...slot(legExt, 3), reps: [12, 15] }, weekIndex: 2, mode: 'intermediate',
    previous: { sets: [set(40, 13, 5)] },   // far too light
    formHistory: { lastFormPoor: true, consecutiveTopOfRange: 0 },
  });
  assert.notEqual(p.tag, 'load-up', 'a big jump onto a movement you cannot control is the worst case');
});

/* ------------------------------------------------------------- wording */

test('the two new decisions have plain-English wording like every other', () => {
  for (const tag of ['hold-form', 'consolidate']) {
    const p = {
      tag, sets: 3, targetReps: 8, targetRir: 2, repRange: [6, 10], weight: 100,
      previous: { weight: 100, reps: 10, rir: 2 }, rationale: 'technical',
    };
    const plain = explain.reasonLine(p, 'kg', true);
    assert.notEqual(plain, p.rationale, `${tag} falls back to the technical wording`);
    assert.ok(plain.length > 60);
    for (const jargon of ['RIR', 'MEV', 'MRV', 'e1RM']) {
      assert.ok(!plain.includes(jargon), `${tag} plain wording says "${jargon}"`);
    }
    assert.notEqual(explain.tagLabel(tag, true), tag);
    assert.notEqual(explain.tagLabel(tag, false), tag);
  }
});

/* ---------------------------------------------------------- persistence */

test('a block keeps the mode it started in', () => {
  store.setMode('beginner');
  const meso = store.startMesocycle('ul4');
  assert.equal(meso.mode, 'beginner');

  store.setMode('advanced');
  const built = store.buildSession(meso.id, 0, 'upper-a');
  assert.equal(built.mode, 'beginner', 'switching mode must not rewrite a block in progress');
  assert.ok(built.entries.every((e) => e.prescription.targetRir >= 2));
});

test('the wording follows the mode until you say otherwise', () => {
  store.setMode('beginner');
  assert.equal(store.plainLanguage(), true);
  store.setMode('advanced');
  assert.equal(store.plainLanguage(), false);

  store.setSetting('plainLanguage', true);
  assert.equal(store.plainLanguage(), true, 'an explicit choice wins over the mode default');
  store.setMode('intermediate');
  assert.equal(store.plainLanguage(), true, 'and it survives a mode change');
});

test('people from before modes existed keep their settings', () => {
  // `experience` (new / some / experienced) predates training modes and only
  // ever changed the wording. Import runs the same migration a stored state
  // goes through on load.
  const legacy = JSON.stringify({
    version: 1,
    settings: { unit: 'lb', experience: 'new', autoStartRest: false },
    mesocycles: [], sessions: [], active: null,
  });
  store.importJson(legacy);
  assert.equal(store.state.settings.mode, 'beginner');
  assert.equal(store.state.settings.plainLanguage, true);
  assert.equal(store.state.settings.unit, 'lb', 'and their other settings are untouched');
  assert.equal(store.state.settings.autoStartRest, false);
  assert.equal(store.state.settings.experience, undefined, 'the old field is retired');
});

test('each legacy experience level lands on the matching mode', () => {
  for (const [experience, mode] of [['new', 'beginner'], ['some', 'intermediate'], ['experienced', 'advanced']]) {
    store.importJson(JSON.stringify({
      version: 1, settings: { experience }, mesocycles: [], sessions: [], active: null,
    }));
    assert.equal(store.state.settings.mode, mode, `${experience} should become ${mode}`);
  }
});

/* ------------------------------------------------- every mode is usable */

test('every program runs under every mode without breaking its own rules', () => {
  for (const mode of MODE_ORDER) {
    for (const p of PROGRAMS) {
      const meso = newMesocycle(p, { mode });
      for (let week = 0; week < p.accumulationWeeks; week++) {
        const plan = weekPlan(meso, [], week);
        const volume = plannedSetsByMuscle(plan.days);
        for (const [muscle, sets] of Object.entries(volume)) {
          assert.ok(sets <= MUSCLES[muscle].mrv,
            `${p.id}/${mode} week ${week + 1}: ${muscle} at ${sets} breaks MRV`);
        }
        for (const day of plan.days) {
          for (const s of day.slots) {
            const prescription = prescribe({
              exercise: getExercise(s.exerciseId), slot: s, program: p, weekIndex: week, mode, unit: 'kg',
            });
            assert.ok(prescription.targetRir >= getMode(mode).rirFloor,
              `${p.id}/${mode}: ${s.exerciseId} went below the mode's effort floor`);
            assert.ok(prescription.sets >= 1 && prescription.targetReps >= 1);
          }
        }
      }
    }
  }
});
