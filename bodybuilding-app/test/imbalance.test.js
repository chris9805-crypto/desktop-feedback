/**
 * Weak-point detection and the automated logging flow.
 *
 * The risk with a feature that tells someone "your back is lagging" is that it
 * says so on noise. These tests check it stays quiet when the data does not
 * support a claim, and that anything it does claim can be traced to numbers in
 * the log.
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
const {
  analyse, ratioFindings, progressFindings, sideFindings, bestE1rm, STRENGTH_RATIOS,
} = await import('../js/engine/imbalance.js');
const { newMesocycle, weekPlan, WEAK_POINT_BONUS_SETS } = await import('../js/engine/mesocycle.js');
const { plannedSetsByMuscle } = await import('../js/engine/volume.js');
const { MUSCLES } = await import('../js/data/muscles.js');
const { getProgram } = await import('../js/data/programs.js');
const { getExercise, EXERCISE_BY_ID } = await import('../js/data/exercises.js');
const { nextPosition, sessionProgress } = await import('../js/ui/views/cards.js');
const { sessionVolumeModifier } = await import('../js/engine/progression.js');

beforeEach(() => { memory.clear(); store.reset(); });

const set = (weight, reps, rir = 1) => ({ weight, reps, rir, done: true, warmup: false });
const session = (lifts, extra = {}) => ({
  id: `s${Math.random()}`, date: Date.now(), mesoId: 'm', week: 0,
  entries: Object.entries(lifts).map(([exerciseId, sets]) => ({ exerciseId, sets })),
  ...extra,
});

/* ------------------------------------------------------- ratio findings */

test('every ratio rule points at real exercises and a real muscle', () => {
  for (const rule of STRENGTH_RATIOS) {
    assert.ok(EXERCISE_BY_ID[rule.lift], `${rule.id} references ${rule.lift}`);
    assert.ok(EXERCISE_BY_ID[rule.reference], `${rule.id} references ${rule.reference}`);
    assert.ok(rule.lagging.every((m) => MUSCLES[m]), `${rule.id} blames a muscle that does not exist`);
    assert.ok(rule.low && rule.high, `${rule.id} needs wording for both directions`);
    assert.ok(rule.tolerance > 0 && rule.tolerance < rule.expected);
  }
});

test('a bench that has run away from the row is flagged', () => {
  const findings = ratioFindings([session({ 'bb-bench': [set(140, 5)], 'bb-row': [set(70, 8)] })]);
  const rowLag = findings.find((f) => f.id === 'row-vs-bench');
  assert.ok(rowLag, 'a 0.6 row-to-bench ratio should not pass silently');
  assert.deepEqual(rowLag.lagging, ['upperBack', 'lats']);
  assert.match(rowLag.evidence, /ratio of/);
});

test('a normal ratio says nothing at all', () => {
  const findings = ratioFindings([session({ 'bb-bench': [set(100, 5)], 'bb-row': [set(85, 5)] })]);
  assert.equal(findings.find((f) => f.id === 'row-vs-bench'), undefined);
});

test('the direction of the imbalance decides which muscle gets blamed', () => {
  // Row far ahead of bench: the finding is about the bench, and pushing more
  // back volume would be exactly the wrong response.
  const findings = ratioFindings([session({ 'bb-bench': [set(60, 5)], 'bb-row': [set(120, 5)] })]);
  const finding = findings.find((f) => f.id === 'row-vs-bench');
  assert.ok(finding);
  assert.deepEqual(finding.lagging, [], 'nothing is added to a muscle that is already ahead');
});

test('one lift with no partner produces no ratio claim', () => {
  assert.deepEqual(ratioFindings([session({ 'bb-bench': [set(140, 5)] })]), []);
});

test('best estimated max is taken across the whole log, not the last session', () => {
  const sessions = [
    session({ 'bb-bench': [set(120, 5)] }),
    session({ 'bb-bench': [set(100, 5)] }),
  ];
  assert.ok(bestE1rm(sessions, 'bb-bench').value > 130);
  assert.equal(bestE1rm(sessions, 'deadlift'), null);
});

/* ----------------------------------------------------- progress findings */

test('a muscle whose strength has stalled while others moved is surfaced', () => {
  const old = Date.now() - 70 * 86400000;
  const sessions = [
    { ...session({ 'bb-bench': [set(100, 5)], 'back-squat': [set(140, 5)], 'bb-row': [set(90, 5)] }), date: old },
    { ...session({ 'bb-bench': [set(100, 5)], 'back-squat': [set(140, 5)], 'bb-row': [set(90, 5)] }), date: old + 86400000 },
    { ...session({ 'bb-bench': [set(100, 5)], 'back-squat': [set(140, 5)], 'bb-row': [set(90, 5)] }), date: old + 2 * 86400000 },
    // Chest flat, everything else up 10%.
    session({ 'bb-bench': [set(100, 5)], 'back-squat': [set(155, 5)], 'bb-row': [set(100, 5)] }),
    session({ 'bb-bench': [set(100, 5)], 'back-squat': [set(155, 5)], 'bb-row': [set(100, 5)] }),
    session({ 'bb-bench': [set(100, 5)], 'back-squat': [set(155, 5)], 'bb-row': [set(100, 5)] }),
  ];
  const findings = progressFindings(sessions);
  assert.ok(findings.some((f) => f.lagging.includes('chest')),
    'chest went nowhere while the rest went up 10%');
});

test('too little history produces no progress claims', () => {
  assert.deepEqual(progressFindings([session({ 'bb-bench': [set(100, 5)] })]), []);
});

/* --------------------------------------------------------- side findings */

test('a consistent weaker side is reported, a one-off is not', () => {
  const one = [session({ 'db-row': [set(30, 10)] }, { sideReports: { 'db-row': 'left' } })];
  assert.deepEqual(sideFindings(one), [], 'one report is not a pattern');

  const many = Array.from({ length: 5 }, () =>
    session({ 'db-row': [set(30, 10)] }, { sideReports: { 'db-row': 'left' } }));
  const findings = sideFindings(many);
  assert.equal(findings.length, 1);
  assert.match(findings[0].title, /left side is weaker/i);
  assert.ok(findings[0].lagging.length > 0);
});

test('an even split is not an imbalance', () => {
  const mixed = [
    ...Array.from({ length: 3 }, () => session({ 'db-row': [set(30, 10)] }, { sideReports: { 'db-row': 'left' } })),
    ...Array.from({ length: 3 }, () => session({ 'db-row': [set(30, 10)] }, { sideReports: { 'db-row': 'right' } })),
  ];
  assert.deepEqual(sideFindings(mixed), []);
});

/* -------------------------------------------------------- steering volume */

test('weak points earn extra weekly volume, still clamped to what you recover from', () => {
  const program = getProgram('ul4');
  const meso = newMesocycle(program, { mode: 'advanced' });

  const base = weekPlan(meso, [], 2);
  const steered = weekPlan(meso, [], 2, { lagging: ['upperBack', 'lats'] });

  const baseVolume = plannedSetsByMuscle(base.days);
  const steeredVolume = plannedSetsByMuscle(steered.days);
  assert.ok(steeredVolume.upperBack > baseVolume.upperBack,
    'a lagging muscle should get more work than it otherwise would');
  assert.ok(WEAK_POINT_BONUS_SETS >= 1);

  for (const [muscle, sets] of Object.entries(steeredVolume)) {
    assert.ok(sets <= MUSCLES[muscle].mrv,
      `specialising pushed ${muscle} to ${sets}, past its ${MUSCLES[muscle].mrv} ceiling`);
  }
});

test('only the top couple of weak points get boosted', () => {
  // Specialising in everything is just training everything, with worse recovery.
  //
  // Measured on intent rather than on the resulting volume: adding chest and
  // lat sets necessarily adds triceps and biceps volume too, because rows and
  // presses train them. That spillover is unavoidable and is not specialising.
  const program = getProgram('ul4');
  const meso = newMesocycle(program, { mode: 'advanced' });
  const everything = ['chest', 'lats', 'upperBack', 'quads', 'biceps', 'triceps', 'sideDelts'];
  const plan = weekPlan(meso, [], 3, { lagging: everything });

  const specialised = Object.entries(plan.notes)
    .filter(([, reason]) => reason.includes('weak point'))
    .map(([muscle]) => muscle);
  assert.ok(specialised.length <= 2,
    `${specialised.length} muscles were specialised at once: ${specialised.join(', ')}`);
  assert.deepEqual(specialised.sort(), ['chest', 'lats'], 'and it is the top two on the list');
});

test('the other modes never see weak-point steering', () => {
  const program = getProgram('ul4');
  for (const mode of ['beginner', 'intermediate']) {
    const meso = newMesocycle(program, { mode });
    const plan = weekPlan(meso, [], 2, { lagging: ['upperBack', 'lats'] });
    assert.deepEqual(plan.weakPoints, [],
      `${mode} should not be quietly specialising - it is not what that mode is for`);
    const steered = plannedSetsByMuscle(plan.days);
    const base = plannedSetsByMuscle(weekPlan(meso, [], 2).days);
    assert.deepEqual(steered, base);
  }
});

test('weak points are only computed for the mode that uses them', () => {
  store.setMode('intermediate');
  assert.deepEqual(store.weakPoints().findings, []);
  store.setMode('advanced');
  assert.ok(Array.isArray(store.weakPoints().findings));
});

test('every finding carries the evidence behind it', () => {
  const sessions = [
    session({ 'bb-bench': [set(140, 5)], 'bb-row': [set(70, 8)], ohp: [set(50, 5)] }),
    ...Array.from({ length: 4 }, () =>
      session({ 'db-row': [set(30, 10)] }, { sideReports: { 'db-row': 'right' } })),
  ];
  const { findings, lagging } = analyse(sessions);
  assert.ok(findings.length > 0);
  for (const finding of findings) {
    assert.ok(finding.title && finding.detail && finding.evidence,
      `${finding.id} claims something without showing why`);
    assert.ok(finding.severity > 0);
  }
  // Ranked worst first, and no muscle listed twice.
  for (let i = 1; i < findings.length; i++) {
    assert.ok(findings[i - 1].severity >= findings[i].severity, 'findings should be ranked');
  }
  assert.equal(new Set(lagging).size, lagging.length);
});

/* ------------------------------------------------- the automated flow */

test('the card flow walks the session in order and never repeats a set', () => {
  const meso = store.startMesocycle('ul4');
  const active = store.startSession(meso.id, 0, 'upper-a');

  const seen = new Set();
  let guard = 0;
  let position = nextPosition(store.state.active);
  while (position && guard++ < 200) {
    const key = `${position.entryIndex}:${position.setIndex}`;
    assert.ok(!seen.has(key), `${key} came up twice`);
    seen.add(key);
    const entry = store.state.active.entries[position.entryIndex];
    store.logSet(entry.exerciseId, position.setIndex, {
      done: true, weight: 50, reps: entry.prescription.targetReps,
    });
    position = nextPosition(store.state.active);
  }
  const progress = sessionProgress(store.state.active);
  assert.equal(progress.done, progress.total);
  assert.equal(progress.pct, 100);
  assert.equal(seen.size, progress.total);
});

test('the card proposes real numbers rather than making you find them', () => {
  // Second block, so there is history to predict from.
  const first = store.startMesocycle('ul4');
  store.startSession(first.id, 0, 'upper-a');
  store.logSet('bb-bench', 0, { done: true, weight: 100, reps: 8, rir: 2 });
  store.finishSession();

  const built = store.buildSession(first.id, 1, 'upper-a');
  const bench = built.entries.find((e) => e.exerciseId === 'bb-bench').prescription;
  assert.ok(bench.weight > 0, 'the weight is predicted, not asked for');
  assert.ok(bench.targetReps > 0);
  assert.ok(bench.rationale.length > 40, 'and it can say where the number came from');
});

test('effort is left blank rather than invented', () => {
  // A set confirmed with one tap must not silently claim an effort rating the
  // lifter never gave - that would feed the engine its own assumptions back.
  const meso = store.startMesocycle('ul4');
  store.startSession(meso.id, 0, 'upper-a');
  store.logSet('bb-bench', 0, { done: true, weight: 100, reps: 5, rir: null });
  assert.equal(store.state.active.entries[0].sets[0].rir, null);
  assert.equal(store.state.active.entries[0].sets[0].done, true);
});

test('per-exercise and session-level answers are saved with the session', () => {
  const meso = store.startMesocycle('ul4');
  store.startSession(meso.id, 0, 'upper-a');
  store.logSet('bb-bench', 0, { done: true, weight: 100, reps: 5, rir: 2 });
  store.setEntryField('bb-bench', 'form', 2);
  store.setEntryField('bb-bench', 'connection', 1);
  store.setSessionCard('effort', 3);
  store.setSessionCard('stamina', 2);
  const saved = store.finishSession();

  const entry = saved.entries.find((e) => e.exerciseId === 'bb-bench');
  assert.equal(entry.form, 2);
  assert.equal(entry.connection, 1);
  assert.equal(saved.session.effort, 3);
  assert.equal(saved.session.stamina, 2);
  assert.equal(saved.mode, 'intermediate');
});

test('a reported weaker side is recorded against the exercise', () => {
  const meso = store.startMesocycle('ul4');
  store.startSession(meso.id, 0, 'lower-b');
  const entry = store.state.active.entries.find((e) => getExercise(e.exerciseId).unilateral);
  assert.ok(entry, 'that day should contain a one-sided movement');
  store.logSet(entry.exerciseId, 0, { done: true, weight: 20, reps: 10, rir: 2 });
  store.setEntryField(entry.exerciseId, 'side', 'left');
  const saved = store.finishSession();
  assert.equal(saved.sideReports[entry.exerciseId], 'left');
});

test('an "even" side report is not stored as an imbalance', () => {
  const meso = store.startMesocycle('ul4');
  store.startSession(meso.id, 0, 'lower-b');
  const entry = store.state.active.entries.find((e) => getExercise(e.exerciseId).unilateral);
  store.logSet(entry.exerciseId, 0, { done: true, weight: 20, reps: 10, rir: 2 });
  store.setEntryField(entry.exerciseId, 'side', 'even');
  const saved = store.finishSession();
  assert.deepEqual(saved.sideReports, {});
});

test('the session cards move next week in the right direction', () => {
  assert.equal(sessionVolumeModifier({ effort: 3, stamina: 2 }).delta, -1, 'brutal and faded');
  assert.equal(sessionVolumeModifier({ effort: 0, stamina: 0 }).delta, 1, 'easy and never faded');
  assert.equal(sessionVolumeModifier({ effort: 2, stamina: 1 }).delta, 0, 'a normal hard session');
  assert.equal(sessionVolumeModifier({}).delta, 0, 'skipping the cards changes nothing');
  assert.ok(sessionVolumeModifier({ effort: 3, stamina: 2 }).reason.length > 20);
});

test('feeling weaker on a grinding session backs the volume off', () => {
  // The point of the strength card: a run of "same weights felt heavier" is how
  // you find out fatigue caught up before the deload was due.
  assert.equal(sessionVolumeModifier({ effort: 2, stamina: 1, strength: 0 }).delta, -1);
  assert.equal(sessionVolumeModifier({ effort: 1, stamina: 0, strength: 0 }).delta, 0,
    'feeling weaker after an easy session is not a fatigue signal on its own');
  assert.equal(sessionVolumeModifier({ effort: 1, stamina: 0, strength: 2 }).delta, 0,
    'feeling strong does not by itself earn more work');
});

test('the session answers actually reach next week\'s plan', () => {
  // This is the whole point of asking. A card that collects an answer nothing
  // reads is worse than no card, because it claims a consequence it does not have.
  const program = getProgram('ul4');
  const meso = newMesocycle(program);
  const week = (cards) => program.days.map((d) => ({
    mesoId: meso.id, week: 0, dayId: d.id, date: Date.now(), session: cards, entries: [],
  }));

  const chest = (sessions) => plannedSetsByMuscle(weekPlan(meso, sessions, 1).days).chest;
  const neutral = chest(week({ effort: 1, stamina: 0 }));
  const wrecked = chest(week({ effort: 3, stamina: 2 }));
  const fresh = chest(week({ effort: 0, stamina: 0 }));

  assert.ok(wrecked < neutral, 'a brutal, faded week should not be followed by more work');
  assert.ok(fresh > wrecked);
});

test('a weak point you disagree with stops being raised', () => {
  store.setMode('advanced');
  const lagging = () => store.weakPoints().lagging;

  store.update((st) => ({
    ...st,
    sessions: [{
      id: 's1', date: Date.now(), mesoId: 'm', week: 0, session: {},
      entries: [
        { exerciseId: 'bb-bench', sets: [set(140, 5)] },
        { exerciseId: 'bb-row', sets: [set(70, 8)] },
      ],
    }],
  }));
  assert.ok(lagging().includes('upperBack'), 'the ratio should surface it first');

  store.update((st) => ({
    ...st,
    sessions: [...st.sessions, {
      id: 's2', date: Date.now() + 1, mesoId: 'm', week: 0, entries: [],
      session: { weakPoint: { muscle: 'upperBack', verdict: 'disagree' } },
    }],
  }));
  assert.ok(!lagging().includes('upperBack'), 'saying no should stop the nagging');
  assert.ok(store.weakPoints().dismissed.includes('upperBack'));
});

test('agreeing with a weak point leaves it in place', () => {
  store.setMode('advanced');
  store.update((st) => ({
    ...st,
    sessions: [
      {
        id: 's1', date: Date.now(), mesoId: 'm', week: 0, session: {},
        entries: [
          { exerciseId: 'bb-bench', sets: [set(140, 5)] },
          { exerciseId: 'bb-row', sets: [set(70, 8)] },
        ],
      },
      {
        id: 's2', date: Date.now() + 1, mesoId: 'm', week: 0, entries: [],
        session: { weakPoint: { muscle: 'upperBack', verdict: 'agree' } },
      },
    ],
  }));
  assert.ok(store.weakPoints().lagging.includes('upperBack'));
});
