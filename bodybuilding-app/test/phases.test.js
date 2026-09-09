/**
 * Training phases, and the ratchet they exist to stop.
 *
 * The bug this feature is really about: missing a rep target drops the load,
 * and the drop lowers the next target. Miss occasionally while genuinely
 * maintaining - which is what a deficit looks like - and the loads spiral
 * downward on their own. The diet gets blamed for bookkeeping.
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
const { PHASES, PHASE_ORDER, getPhase, holdingIsSuccess, DEFAULT_PHASE } = await import('../js/data/phases.js');
const { prescribe, targetRirFor } = await import('../js/engine/progression.js');
const { newMesocycle, weekPlan } = await import('../js/engine/mesocycle.js');
const { plannedSetsByMuscle } = await import('../js/engine/volume.js');
const { MUSCLES } = await import('../js/data/muscles.js');
const { getProgram } = await import('../js/data/programs.js');
const { getExercise } = await import('../js/data/exercises.js');
const explain = await import('../js/ui/explain.js');

beforeEach(() => { memory.clear(); store.reset(); });

const program = getProgram('ul4');
const bench = getExercise('bb-bench');
const legExt = getExercise('leg-extension');
const set = (weight, reps, rir) => ({ weight, reps, rir, done: true, warmup: false });
const slot = (exercise, sets = 4, reps = null) => ({ exerciseId: exercise.id, sets, reps, restSec: null });
const run = (o) => prescribe({ program, unit: 'kg', ...o });

/* ------------------------------------------------------------- metadata */

test('every phase is fully specified', () => {
  assert.deepEqual(PHASE_ORDER, ['gain', 'maintain', 'cut']);
  for (const id of PHASE_ORDER) {
    const phase = PHASES[id];
    assert.ok(phase.name && phase.tagline && phase.summary && phase.detail);
    assert.ok(['push', 'hold'].includes(phase.goal));
    assert.ok(phase.backOffFactor > 0.9 && phase.backOffFactor <= 1);
    assert.ok(phase.missesBeforeBackOff >= 1);
    assert.ok(phase.mrvFactor > 0 && phase.mrvFactor <= 1);
    assert.ok(phase.successLine.length > 10);
  }
  assert.equal(getPhase('nonsense').id, DEFAULT_PHASE, 'an unknown phase falls back');
  assert.equal(holdingIsSuccess('cut'), true);
  assert.equal(holdingIsSuccess('gain'), false);
});

/* -------------------------------------------------- the ratchet, pinned */

test('one missed session never drops the load on a cut', () => {
  const p = run({
    exercise: bench, slot: { ...slot(bench), reps: [5, 8] }, weekIndex: 1, phase: 'cut',
    previous: { sets: [set(100, 3, 1)] },              // missed the 5-rep floor
    formHistory: { consecutiveMisses: 1, lastFormPoor: false, consecutiveTopOfRange: 0 },
  });
  assert.equal(p.tag, 'hold-load');
  assert.equal(p.weight, 100, 'an off day in a deficit is not a verdict on the weight');
});

test('two misses in a row do back it off, gently', () => {
  const p = run({
    exercise: bench, slot: { ...slot(bench), reps: [5, 8] }, weekIndex: 1, phase: 'cut',
    previous: { sets: [set(100, 3, 1)] },
    formHistory: { consecutiveMisses: 2, lastFormPoor: false, consecutiveTopOfRange: 0 },
  });
  assert.equal(p.tag, 'back-off');
  assert.ok(p.weight < 100);
  assert.ok(p.weight >= 95, `a cut should not cut 6% off - got ${p.weight}`);
});

test('gaining still backs off on the first miss, and harder', () => {
  const gaining = run({
    exercise: bench, slot: { ...slot(bench), reps: [5, 8] }, weekIndex: 1, phase: 'gain',
    previous: { sets: [set(100, 3, 1)] },
    formHistory: { consecutiveMisses: 1, lastFormPoor: false, consecutiveTopOfRange: 0 },
  });
  assert.equal(gaining.tag, 'back-off');
  assert.ok(gaining.weight <= 95);
});

test('the load does not spiral over a block of maintained-but-imperfect sessions', () => {
  // The actual failure mode. Someone holding their numbers, missing the odd
  // week, should finish a block near where they started - not 10% down.
  const simulate = (phase) => {
    let weight = 100;
    let misses = 0;
    for (let week = 0; week < 8; week++) {
      // Every third week is an off day; the rest are on target.
      const missed = week % 3 === 2;
      misses = missed ? misses + 1 : 0;
      const p = run({
        exercise: bench, slot: { ...slot(bench), reps: [5, 8] }, weekIndex: week % 4, phase,
        previous: { sets: [set(weight, missed ? 4 : 6, 1)] },
        formHistory: { consecutiveMisses: misses, lastFormPoor: false, consecutiveTopOfRange: 0 },
      });
      weight = p.weight ?? weight;
    }
    return weight;
  };

  const cutting = simulate('cut');
  assert.ok(cutting >= 100,
    `holding through a cut should not cost you load - ended at ${cutting}kg`);
});

/* --------------------------------------------------- holding as success */

test('matching last week is a success on a cut, not a stall', () => {
  const p = run({
    exercise: bench, slot: { ...slot(bench), reps: [5, 8] }, weekIndex: 1, phase: 'cut',
    previous: { sets: [set(100, 6, 2)] },
  });
  assert.equal(p.tag, 'held');
  assert.equal(p.weight, 100);
  assert.equal(p.targetReps, 6, 'asked to match, not to beat');
  assert.match(p.rationale, /holding your numbers is the win/i);
});

test('the same session while gaining asks for one more rep', () => {
  const p = run({
    exercise: bench, slot: { ...slot(bench), reps: [5, 8] }, weekIndex: 1, phase: 'gain',
    previous: { sets: [set(100, 6, 2)] },
  });
  assert.equal(p.tag, 'rep-up');
  assert.equal(p.targetReps, 7);
});

test('genuinely beating the window still earns load, even on a cut', () => {
  // Progress in a deficit is a bonus, not something to suppress.
  const p = run({
    exercise: bench, slot: { ...slot(bench), reps: [5, 8] }, weekIndex: 1, phase: 'cut',
    previous: { sets: [set(100, 8, 2)] },
    formHistory: { consecutiveMisses: 0, lastFormPoor: false, consecutiveTopOfRange: 3 },
  });
  assert.equal(p.tag, 'load-up');
  assert.ok(p.weight > 100);
});

/* ------------------------------------------------------------- effort */

test('a cut keeps you further from failure', () => {
  for (let week = 0; week < program.accumulationWeeks; week++) {
    const cutting = targetRirFor(program, week, legExt, 'intermediate', 'cut');
    const gaining = targetRirFor(program, week, legExt, 'intermediate', 'gain');
    assert.ok(cutting > gaining || gaining >= 3,
      `week ${week + 1}: cutting ${cutting} should stay further from failure than ${gaining}`);
  }
  assert.ok(targetRirFor(program, 3, legExt, 'intermediate', 'cut') >= 1,
    'never to outright failure in a deficit');
});

/* ------------------------------------------------------------- volume */

test('volume stops climbing on a cut', () => {
  const chest = (phase) => {
    const meso = newMesocycle(program, { phase });
    return [0, 1, 2, 3].map((w) => plannedSetsByMuscle(weekPlan(meso, [], w).days).chest);
  };
  const gaining = chest('gain');
  const cutting = chest('cut');
  assert.ok(gaining.at(-1) > gaining[0], 'gaining should still climb');
  assert.equal(cutting.at(-1), cutting[0], 'cutting should hold steady');
});

test('good feedback does not add volume on a cut', () => {
  // Feeling fresh in a deficit is not a mandate for more work.
  const meso = newMesocycle(program, { phase: 'cut' });
  const fresh = [0, 1, 2].map((week) => ({
    mesoId: meso.id, week, session: {},
    feedback: { chest: { soreness: 0, pump: 0, joint: 0 } },
  }));
  const base = plannedSetsByMuscle(weekPlan(meso, [], 0).days).chest;
  const later = plannedSetsByMuscle(weekPlan(meso, fresh, 3).days).chest;
  assert.ok(later <= base, `volume climbed from ${base} to ${later} on a cut`);
});

test('bad feedback still takes volume away on a cut', () => {
  const meso = newMesocycle(program, { phase: 'cut' });
  const wrecked = [{
    mesoId: meso.id, week: 0, session: {},
    feedback: { chest: { soreness: 3, pump: 3, joint: 0 } },
  }];
  const base = plannedSetsByMuscle(weekPlan(meso, [], 0).days).chest;
  const after = plannedSetsByMuscle(weekPlan(meso, wrecked, 1).days).chest;
  assert.ok(after < base, 'the recovery signal must still work in both directions');
});

test('the recoverable ceiling drops in a deficit', () => {
  const meso = newMesocycle(getProgram('ppl6'), { phase: 'cut' });
  for (let week = 0; week < 4; week++) {
    const volume = plannedSetsByMuscle(weekPlan(meso, [], week).days);
    for (const [muscle, sets] of Object.entries(volume)) {
      assert.ok(sets <= MUSCLES[muscle].mrv,
        `${muscle} at ${sets} sets exceeds even the well-fed ceiling`);
    }
  }
});

/* ------------------------------------------------------------ wording */

test('the phase-specific decisions have plain-English wording', () => {
  for (const tag of ['held', 'hold-load']) {
    const p = {
      tag, sets: 3, targetReps: 6, targetRir: 2, repRange: [5, 8], weight: 100,
      previous: { weight: 100, reps: 6, rir: 2 }, rationale: 'technical',
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

/* -------------------------------------------------------------- store */

test('changing phase applies to the block you are running', () => {
  // Unlike mode: starting a diet mid-block is normal, and leaving the app
  // pushing for progress you cannot make is the problem this fixes.
  const meso = store.startMesocycle('ul4');
  assert.equal(store.phase().id, 'gain');
  store.setPhase('cut');
  assert.equal(store.phase().id, 'cut');
  assert.equal(store.activeMeso().phase, 'cut');
  assert.equal(store.buildSession(meso.id, 0, 'upper-a').phase, 'cut');
});

test('a session records the phase it was trained in', () => {
  const meso = store.startMesocycle('ul4');
  store.setPhase('cut');
  store.startSession(meso.id, 0, 'upper-a');
  store.logSet('bb-bench', 0, { done: true, weight: 100, reps: 5, rir: 2 });
  assert.equal(store.finishSession().phase, 'cut');
});

test('consecutive misses are counted from the log', () => {
  const meso = store.startMesocycle('ul4');
  const range = [5, 8];
  assert.equal(store.formHistoryFor('bb-bench', range).consecutiveMisses, 0);

  for (const reps of [3, 3]) {
    store.startSession(meso.id, 0, 'upper-a');
    store.logSet('bb-bench', 0, { done: true, weight: 100, reps, rir: 1 });
    store.finishSession();
  }
  assert.equal(store.formHistoryFor('bb-bench', range).consecutiveMisses, 2);

  store.startSession(meso.id, 1, 'upper-a');
  store.logSet('bb-bench', 0, { done: true, weight: 100, reps: 6, rir: 1 });
  store.finishSession();
  assert.equal(store.formHistoryFor('bb-bench', range).consecutiveMisses, 0, 'a good session resets it');
});
