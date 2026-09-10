/**
 * Bodyweight.
 *
 * This is the part of a fitness app most capable of doing harm, so the tests
 * are as much about what it must NOT do — invent a number from noise, project a
 * finish date, nag about a target — as about the maths.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
};

const { store, KG_PER_LB } = await import('../js/store.js');
const {
  smooth, trend, rateAdvice, changeOver, MIN_POINTS_FOR_RATE, MIN_DAYS_FOR_RATE,
} = await import('../js/engine/bodyweight.js');
const { overallRetention, relativeStrength } = await import('../js/engine/retention.js');

beforeEach(() => { memory.clear(); store.reset(); });

const DAY = 86400000;
const now = Date.now();
const at = (daysAgo, weight) => ({ date: now - daysAgo * DAY, weight });
/** A steady loss with realistic day-to-day water noise on top. */
const cutting = () => {
  const out = [];
  for (let d = 42; d >= 0; d -= 2) {
    const trueWeight = 88 - (42 - d) * 0.08;
    out.push(at(d, Math.round((trueWeight + (d % 4 === 0 ? 0.6 : -0.5)) * 10) / 10));
  }
  return out;
};

/* --------------------------------------------------------- smoothing */

test('smoothing pulls the day-to-day noise out', () => {
  const noisy = [at(6, 80), at(5, 82), at(4, 79), at(3, 81), at(2, 80), at(1, 81)];
  const series = smooth(noisy);
  const spread = (xs) => Math.max(...xs) - Math.min(...xs);
  assert.ok(spread(series.map((p) => p.value)) < spread(noisy.map((p) => p.weight)),
    'the smoothed line should vary less than the raw readings');
  assert.equal(series.length, noisy.length);
  assert.ok(series.at(-1).samples > 1);
});

test('irregular weigh-ins are fine - nobody weighs on a schedule', () => {
  const sparse = [at(30, 90), at(21, 89), at(3, 87), at(1, 87.4)];
  const series = smooth(sparse);
  assert.equal(series.length, 4);
  assert.ok(series.every((p) => Number.isFinite(p.value)));
});

test('junk readings are ignored rather than plotted', () => {
  const series = smooth([at(3, 80), { date: now, weight: 0 }, { date: now, weight: 'heavy' }]);
  assert.equal(series.length, 1);
});

/* ------------------------------------------------------------- trend */

test('a rate is not quoted until there is enough history to mean anything', () => {
  assert.equal(trend([]).confident, false);
  assert.equal(trend([at(1, 80)]).confident, false);
  assert.equal(trend([at(2, 80), at(1, 79)]).confident, false, 'two points is not a trend');

  const barely = [at(3, 80), at(2, 79.8), at(1, 79.6), at(0, 79.4)];
  assert.equal(trend(barely).confident, false, `${MIN_DAYS_FOR_RATE} days is the floor, not ${MIN_POINTS_FOR_RATE} points`);
});

test('a real cut is measured as a loss, at roughly the right rate', () => {
  const t = trend(cutting());
  assert.equal(t.confident, true);
  assert.equal(t.direction, 'down');
  assert.ok(t.perWeek < 0);
  assert.ok(Math.abs(t.perWeek) > 0.3 && Math.abs(t.perWeek) < 1.2,
    `expected roughly half a kilo a week, got ${t.perWeek.toFixed(2)}`);
});

test('a flat trend is reported as flat, not as a tiny fluctuation', () => {
  const steady = [];
  for (let d = 28; d >= 0; d -= 2) steady.push(at(d, 80 + (d % 4 === 0 ? 0.3 : -0.3)));
  assert.equal(trend(steady).direction, 'flat');
});

test('the trend resists a single outlier', () => {
  // One heavy morning after a big meal should not turn a cut into a gain.
  const withSpike = [...cutting(), at(0, 92)];
  assert.equal(trend(withSpike).direction, 'down');
});

/* ------------------------------------------------------------ advice */

test('the only judgement offered is about rate', () => {
  const advice = rateAdvice(trend(cutting()), 'cut');
  assert.equal(advice.level, 'good');
  const text = `${advice.label} ${advice.line}`;
  for (const forbidden of [/goal/i, /target weight/i, /calorie/i, /by \w+day/i, /behind/i]) {
    assert.ok(!forbidden.test(text), `advice should not mention ${forbidden}`);
  }
});

test('losing too fast is flagged, because that is when muscle goes', () => {
  const fast = [];
  for (let d = 28; d >= 0; d -= 2) fast.push(at(d, 90 - (28 - d) * 0.25));
  const advice = rateAdvice(trend(fast), 'cut');
  assert.equal(advice.level, 'warning');
  assert.match(advice.line, /muscle/i);
});

test('not enough data says so instead of guessing', () => {
  const advice = rateAdvice(trend([at(1, 80)]), 'cut');
  assert.equal(advice.level, 'unknown');
  assert.match(advice.line, /water/i);
});

test('the advice matches what you said you were doing', () => {
  const losing = trend(cutting());
  assert.equal(rateAdvice(losing, 'cut').level, 'good');
  assert.notEqual(rateAdvice(losing, 'gain').level, 'good', 'losing weight while gaining is worth a word');
  for (const phase of ['cut', 'gain', 'maintain']) {
    const a = rateAdvice(losing, phase);
    assert.ok(a.label && a.line.length > 20, `${phase} needs wording`);
  }
});

test('change over a window is reported honestly', () => {
  const change = changeOver(cutting(), 30);
  assert.ok(change.delta < 0);
  assert.ok(change.days >= 25);
  assert.equal(changeOver([at(1, 80)], 30), null, 'one reading is not a change');
});

/* ---------------------------------------------- the point of the whole thing */

test('holding your lifts while the scale drops reads as a gain', () => {
  // This is the reason bodyweight is here at all. Absolute strength flat, but
  // less of you lifting it.
  const s = (w, reps) => ({ weight: w, reps, rir: 1, done: true, warmup: false });
  const sessions = [
    { id: 'a', date: now - 60 * DAY, entries: [{ exerciseId: 'bb-bench', sets: [s(100, 5)] }] },
    { id: 'b', date: now - 5 * DAY, entries: [{ exerciseId: 'bb-bench', sets: [s(100, 5)] }] },
  ];
  const out = overallRetention(sessions, { weighIns: cutting() });
  assert.equal(out.pct, 100, 'absolute strength held');
  assert.ok(out.relative.improved, 'but strength per kilo went up');
  assert.ok(out.relative.changePct > 1);
  assert.ok(out.relative.bodyweightNow < out.relative.bodyweightThen);
});

test('everything works without any bodyweight at all', () => {
  const s = (w, reps) => ({ weight: w, reps, rir: 1, done: true, warmup: false });
  const sessions = [
    { id: 'a', date: now - 60 * DAY, entries: [{ exerciseId: 'bb-bench', sets: [s(100, 5)] }] },
    { id: 'b', date: now - 5 * DAY, entries: [{ exerciseId: 'bb-bench', sets: [s(100, 5)] }] },
  ];
  const out = overallRetention(sessions);
  assert.equal(out.pct, 100, 'the headline still works');
  assert.equal(out.relative, null, 'and the extra simply is not offered');
  assert.equal(relativeStrength(sessions, out.lifts, { weighIns: [at(1, 80)] }), null);
});

/* -------------------------------------------------------------- store */

test('nothing is tracked until you log something', () => {
  assert.equal(store.hasWeighIns(), false);
  assert.deepEqual(store.state.weighIns, []);
  assert.equal(store.bodyweight().current, null);
});

test('a second reading on the same day replaces the first', () => {
  // Two numbers from one morning is the same information twice.
  store.addWeighIn(80);
  store.addWeighIn(80.4);
  assert.equal(store.state.weighIns.length, 1);
  assert.equal(store.state.weighIns[0].weight, 80.4);
});

test('nonsense is refused', () => {
  assert.throws(() => store.addWeighIn(0), /not a weight/i);
  assert.throws(() => store.addWeighIn('heavy'), /not a weight/i);
  assert.throws(() => store.addWeighIn(-5), /not a weight/i);
});

test('a reading can be removed', () => {
  store.addWeighIn(80);
  store.removeWeighIn(store.state.weighIns[0].id);
  assert.equal(store.hasWeighIns(), false);
});

test('changing units converts weigh-ins with everything else', () => {
  // Otherwise the log silently becomes a mix of kilos and pounds.
  store.addWeighIn(80);
  store.setUnit('lb');
  assert.ok(Math.abs(store.state.weighIns[0].weight - 80 / KG_PER_LB) < 0.5);
  store.setUnit('kg');
  assert.ok(Math.abs(store.state.weighIns[0].weight - 80) < 0.5, 'a round trip must not drift');
});

test('weigh-ins survive an export and import', () => {
  store.addWeighIn(80, now - 2 * DAY);
  store.addWeighIn(79.6, now);
  const json = store.exportJson();
  store.reset();
  store.importJson(json);
  assert.equal(store.state.weighIns.length, 2);
});
