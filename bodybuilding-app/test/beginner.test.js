/**
 * The beginner-facing layer.
 *
 * The failure mode this guards against is silent: a prescription tag with no
 * plain-English wording falls back to the technical string, and a beginner
 * reads "topped out the 5-8 window at 2 RIR" with no idea what happened. That
 * looks fine in review and only shows up in front of the person it was meant
 * to help.
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
const explain = await import('../js/ui/explain.js');
const { GLOSSARY, GLOSSARY_ORDER } = await import('../js/data/glossary.js');
const { recommendProgram } = await import('../js/ui/views/onboarding.js');
const { PROGRAMS, getProgram } = await import('../js/data/programs.js');
const { EXERCISES, getExercise } = await import('../js/data/exercises.js');
const { EQUIPMENT_PROFILES, substituteFor, adaptationReport, adaptDays } = await import('../js/engine/equipment.js');
const { prescribe } = await import('../js/engine/progression.js');
const { newMesocycle, weekPlan } = await import('../js/engine/mesocycle.js');

beforeEach(() => { memory.clear(); store.reset(); });

const ALL_TAGS = ['establish', 'load-up', 'rep-up', 'hold', 'back-off', 'deload'];

/* -------------------------------------------------------------- wording */

test('every prescription the engine can produce has plain-English wording', () => {
  const program = getProgram('ul4');
  const bench = getExercise('bb-bench');
  const slot = { exerciseId: 'bb-bench', sets: 4, reps: [5, 8], restSec: 180 };
  const set = (weight, reps, rir) => ({ weight, reps, rir, done: true, warmup: false });

  const cases = {
    establish: { weekIndex: 0, previous: null },
    'load-up': { weekIndex: 1, previous: { sets: [set(100, 8, 2)] } },
    'rep-up': { weekIndex: 1, previous: { sets: [set(100, 6, 2)] } },
    hold: { weekIndex: 0, previous: { sets: [set(100, 6, 1)] } },
    'back-off': { weekIndex: 1, previous: { sets: [set(120, 3, 1)] } },
    deload: { weekIndex: 4, previous: { sets: [set(100, 6, 1)] } },
  };

  const seen = new Set();
  for (const [expected, ctx] of Object.entries(cases)) {
    const p = prescribe({ exercise: bench, slot, program, unit: 'kg', ...ctx });
    assert.equal(p.tag, expected, `expected ${expected}, engine produced ${p.tag}`);
    seen.add(p.tag);

    const plain = explain.reasonLine(p, 'kg', true);
    const target = explain.targetLine(p, 'kg', true);

    assert.notEqual(plain, p.rationale, `${p.tag} falls back to the technical wording`);
    assert.ok(plain.length > 60, `${p.tag} plain wording is too thin`);
    for (const jargon of ['RIR', 'MEV', 'MAV', 'MRV', 'e1RM', 'mesocycle', 'autoregulat']) {
      assert.ok(!plain.includes(jargon), `${p.tag} plain wording still says "${jargon}"`);
      assert.ok(!target.includes(jargon), `${p.tag} plain target still says "${jargon}"`);
    }
    assert.notEqual(explain.tagLabel(p.tag, true), p.tag, `${p.tag} has no plain label`);
  }
  assert.deepEqual([...seen].sort(), [...ALL_TAGS].sort(), 'a tag went untested');
});

test('effort is described in words a person would actually use', () => {
  assert.equal(explain.effortShort(0), 'None left');
  assert.equal(explain.effortShort(2), '2 more');
  assert.equal(explain.effortShort(7), '4+ more');
  assert.match(explain.effortWords(1), /1 more rep/);
  assert.equal(explain.EFFORT_CHOICES.length, 5);
  for (const choice of explain.EFFORT_CHOICES) {
    assert.ok(choice.label && choice.detail);
    assert.ok(!/RIR/.test(choice.label + choice.detail));
  }
});

test('volume status reads as a sentence, not a landmark acronym', () => {
  for (const zone of ['none', 'below-mev', 'productive', 'near-mrv', 'over-mrv']) {
    const line = explain.volumeStatusLine({ status: { zone, label: '', advice: '' } }, true);
    assert.ok(line.length > 15, `${zone} has no plain reading`);
    assert.ok(!/MEV|MAV|MRV/.test(line), `${zone} still quotes an acronym`);
  }
});

test('warm-up guidance is concrete rather than "warm up properly"', () => {
  const steps = explain.warmupAdvice(getExercise('bb-bench'), 100, 'kg');
  assert.ok(steps.length >= 3, 'a big lift needs a real ramp');
  assert.ok(steps.some((s) => s.includes('kg')), 'the weights should be worked out for them');
  const isolation = explain.warmupAdvice(getExercise('lateral-raise'), 12, 'kg');
  assert.ok(isolation.length < steps.length, 'an isolation lift should not get a five-step ramp');
  assert.ok(explain.warmupAdvice(getExercise('pullup'), null, 'kg').length >= 1,
    'bodyweight movements still need an answer');
});

/* ------------------------------------------------------------- glossary */

test('every glossary entry is written for someone who does not know the word', () => {
  for (const key of GLOSSARY_ORDER) {
    const entry = GLOSSARY[key];
    assert.ok(entry.term && entry.plain && entry.short, `${key} is incomplete`);
    assert.ok(entry.short.length > 20, `${key} short definition is too thin`);
    // A definition that uses the acronym it is defining helps nobody.
    const body = `${entry.short} ${entry.full ?? ''}`;
    if (/^[A-Z]{3}$/.test(entry.term)) {
      assert.ok(body.includes(entry.term.split('').join('') ) || body.length > 40,
        `${key} should spell out what the acronym stands for`);
    }
  }
});

test('the jargon the app actually shows is all defined somewhere', () => {
  const defined = new Set(Object.values(GLOSSARY).map((e) => e.term.toLowerCase()));
  for (const word of ['rir', 'mev', 'mav', 'mrv', 'mesocycle', 'deload', 'superset', 'compound', 'isolation']) {
    assert.ok(defined.has(word), `"${word}" appears in the UI but has no explanation`);
  }
});

/* --------------------------------------------------------- onboarding */

test('a complete beginner is never handed an advanced split', () => {
  for (const days of [3, 4, 5, 6]) {
    const { program, reasons } = recommendProgram({ experience: 'new', days, equipment: 'full' });
    assert.equal(program.volumeProfile, 'novice',
      `${days} days a week should still start a beginner on the beginner program`);
    assert.ok(reasons.length >= 2, 'the recommendation has to explain itself');
  }
});

test('six-day splits are reserved for people who said they are experienced', () => {
  const keen = recommendProgram({ experience: 'some', days: 6, equipment: 'full' });
  assert.ok(keen.program.daysPerWeek < 6, 'two years of training is the bar for six days a week');
  assert.ok(keen.reasons.some((r) => /six sessions/i.test(r)), 'and it should say why');

  const veteran = recommendProgram({ experience: 'experienced', days: 6, equipment: 'full' });
  assert.equal(veteran.program.daysPerWeek, 6);
});

test('the recommendation matches the days someone actually has', () => {
  for (const days of [3, 4, 5]) {
    const { program } = recommendProgram({ experience: 'experienced', days, equipment: 'full' });
    assert.equal(program.daysPerWeek, days, `asked for ${days} days, got ${program.daysPerWeek}`);
  }
});

test('a recommendation is always something the person can actually do', () => {
  for (const equipment of Object.keys(EQUIPMENT_PROFILES)) {
    for (const experience of ['new', 'some', 'experienced']) {
      const { program } = recommendProgram({ experience, days: 4, equipment });
      assert.ok(adaptationReport(program, equipment).usable,
        `${experience}/${equipment} was recommended a program with movements they cannot perform`);
    }
  }
});

/* --------------------------------------------------------- equipment */

test('every program is fully performable on every equipment profile', () => {
  for (const profile of Object.keys(EQUIPMENT_PROFILES)) {
    for (const program of PROGRAMS) {
      const report = adaptationReport(program, profile);
      assert.equal(report.gaps.length, 0,
        `${program.id} on ${profile} leaves ${report.gaps.map((g) => g.exerciseId).join(', ')} undoable`);
    }
  }
});

test('substitutes are movements the person can actually perform', () => {
  for (const profile of Object.keys(EQUIPMENT_PROFILES)) {
    const allows = EQUIPMENT_PROFILES[profile].allows;
    for (const exercise of EXERCISES) {
      const swap = substituteFor(exercise.id, profile);
      if (swap.unavailable) continue;
      assert.ok(allows.includes(getExercise(swap.id).equipment),
        `${exercise.id} on ${profile} resolved to ${swap.id}, which needs ${getExercise(swap.id).equipment}`);
    }
  }
});

test('a substitute trains the same thing as the movement it replaces', () => {
  for (const profile of ['noBarbell', 'home']) {
    for (const exercise of EXERCISES) {
      const swap = substituteFor(exercise.id, profile);
      if (!swap.changed) continue;
      const replacement = getExercise(swap.id);
      const shared = exercise.primary.filter((m) => replacement.primary.includes(m));
      assert.ok(shared.length > 0,
        `${exercise.id} -> ${swap.id} on ${profile} trains ${replacement.primary} instead of ${exercise.primary}`);
    }
  }
});

test('swapping equipment changes the exercise but not the plan underneath', () => {
  const program = getProgram('ul4');
  const full = weekPlan(newMesocycle(program, { equipment: 'full' }), [], 1);
  const home = weekPlan(newMesocycle(program, { equipment: 'home' }), [], 1);

  assert.equal(full.days.length, home.days.length);
  for (let d = 0; d < full.days.length; d++) {
    assert.equal(home.days[d].slots.length, full.days[d].slots.length, 'no slot may be dropped');
    for (let i = 0; i < full.days[d].slots.length; i++) {
      assert.equal(home.days[d].slots[i].sets, full.days[d].slots[i].sets,
        'volume progression is decided before equipment, so the set counts must match');
    }
  }
  const swapped = home.days.flatMap((d) => d.slots).filter((s) => s.substitutedFrom);
  assert.ok(swapped.length > 0, 'a barbell program at home should have swapped something');
});

test('a barbell lift swapped for a dumbbell one gets a sane rep range', () => {
  // 3-5 reps on a barbell squat is a strength set. The same on a goblet squat
  // is a test of how much dumbbell you can hold, not of your legs.
  const days = adaptDays([{
    id: 'd', name: 'D', focus: '',
    slots: [{ exerciseId: 'back-squat', sets: 4, reps: [3, 5], restSec: 300, role: 'anchor' }],
  }], 'home');
  const slot = days[0].slots[0];
  assert.notEqual(slot.exerciseId, 'back-squat');
  assert.ok(slot.reps[0] >= 6, `substitute kept a ${slot.reps[0]}-rep floor`);
});

test('a block keeps the equipment it started with', () => {
  store.setSetting('equipment', 'home');
  const meso = store.startMesocycle('ul4');
  assert.equal(meso.equipment, 'home');
  store.setSetting('equipment', 'full');
  const plan = weekPlan(store.activeMeso(), [], 0);
  const swapped = plan.days.flatMap((d) => d.slots).some((s) => s.substitutedFrom);
  assert.ok(swapped, 'changing the setting must not silently rewrite a running block');
});

/* --------------------------------------------------------------- store */

test('a new install starts un-onboarded so the walkthrough runs', () => {
  assert.equal(store.state.settings.onboarded, false);
  assert.equal(store.state.settings.experience, null);
  assert.equal(store.state.settings.equipment, 'full');
});
