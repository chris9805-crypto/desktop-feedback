/**
 * Gamification.
 *
 * The failure mode here is not a crash, it is an incentive that quietly argues
 * with the training. An app that caps volume at what you can recover from and
 * insists on deload weeks must not also hand out points for doing more sets, or
 * break your streak for taking a rest day the program told you to take.
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
  streakFor, levelFor, levelTitle, sessionXp, followedPlan, progressFor,
  newlyEarned, computeTotals, XP, GAP_LIMIT_DAYS,
} = await import('../js/engine/progress.js');
const { ACHIEVEMENTS } = await import('../js/data/achievements.js');
const { getProgram } = await import('../js/data/programs.js');

beforeEach(() => { memory.clear(); store.reset(); });

const DAY = 86400000;
const at = (daysAgo) => Date.now() - daysAgo * DAY;
const sess = (date, extra = {}) => ({
  id: `s${date}${Math.random()}`, date, mesoId: 'm', week: 0, programId: 'ul4',
  entries: [{ exerciseId: 'bb-bench', sets: [{ weight: 100, reps: 5, rir: 2, done: true }] }],
  ...extra,
});

/* -------------------------------------------------------------- streaks */

test('a rest day does not break the streak', () => {
  // This is the whole point. The program says train four days a week; punishing
  // the other three would punish following it.
  const sessions = [at(9), at(7), at(5), at(3), at(1)].map((d) => sess(d));
  const streak = streakFor(sessions, { now: Date.now() });
  assert.equal(streak.current, 5, 'two-day gaps are a normal training week');
  assert.equal(streak.best, 5);
});

test('a week off does break it', () => {
  const sessions = [at(30), at(28), at(26), at(3), at(1)].map((d) => sess(d));
  const streak = streakFor(sessions, { now: Date.now() });
  assert.equal(streak.current, 2, 'the long gap resets it');
  assert.equal(streak.best, 3, 'but the old run is still your best');
});

test('the streak lapses if you stop turning up', () => {
  const sessions = [at(40), at(38), at(36)].map((d) => sess(d));
  const streak = streakFor(sessions, { now: Date.now() });
  assert.equal(streak.current, 0);
  assert.equal(streak.best, 3);
  assert.ok(streak.daysSince >= 35);
});

test('the streak warns before it lapses rather than after', () => {
  const nearly = streakFor([sess(at(GAP_LIMIT_DAYS - 1))], { now: Date.now() });
  assert.equal(nearly.current, 1);
  assert.equal(nearly.atRisk, true, 'a nudge is useful; a post-mortem is not');

  const fine = streakFor([sess(at(1))], { now: Date.now() });
  assert.equal(fine.atRisk, false);
});

test('no sessions is not a broken streak, just no streak', () => {
  const streak = streakFor([], { now: Date.now() });
  assert.deepEqual(streak, { current: 0, best: 0, atRisk: false, daysSince: null });
});

/* ------------------------------------------------------------------ XP */

test('XP rewards turning up far more than doing extra sets', () => {
  // Otherwise the scoring argues with the MRV cap the rest of the app enforces.
  const modest = sessionXp({ entries: [{ sets: Array.from({ length: 12 }, () => ({ done: true })) }] });
  const excessive = sessionXp({ entries: [{ sets: Array.from({ length: 40 }, () => ({ done: true })) }] });
  const extraSets = 28;
  assert.ok(excessive.total - modest.total < XP.session * 1.9,
    'nearly tripling the sets should not be worth two extra sessions');
  assert.equal(excessive.total - modest.total, extraSets * XP.perWorkingSet);
});

test('the easy week is worth more than a hard one', () => {
  // It is the most-skipped week in training and the one that makes the rest count.
  const hard = sessionXp({ entries: [] }, { deload: false });
  const easy = sessionXp({ entries: [] }, { deload: true });
  assert.ok(easy.total > hard.total, 'skipping the deload should cost you, not save you');
});

test('logging honestly is worth points', () => {
  const silent = sessionXp({ entries: [{ sets: [{ done: true }, { done: true }] }] });
  const honest = sessionXp({
    entries: [{ sets: [{ done: true, rir: 2 }, { done: true, rir: 1 }] }],
    feedback: { chest: { soreness: 1 } },
  });
  assert.ok(honest.total > silent.total);
});

test('warm-up sets are not scored', () => {
  const withWarmups = sessionXp({
    entries: [{ sets: [{ done: true, warmup: true }, { done: true, warmup: true }, { done: true }] }],
  });
  const without = sessionXp({ entries: [{ sets: [{ done: true }] }] });
  assert.equal(withWarmups.total, without.total);
});

test('every XP award says where it came from', () => {
  const xp = sessionXp({
    entries: [{ sets: [{ done: true, rir: 2 }] }], feedback: { chest: {} },
  }, { isPr: true, onPlan: true });
  assert.ok(xp.lines.length >= 4);
  assert.equal(xp.total, xp.lines.reduce((n, l) => n + l.amount, 0));
  for (const line of xp.lines) assert.ok(line.label && line.amount > 0);
});

test('following the plan means roughly the prescribed sets, not more', () => {
  const planned = (done) => ({
    entries: [{ prescription: { sets: 4 }, sets: Array.from({ length: done }, () => ({})) }],
  });
  assert.equal(followedPlan(planned(4)), true);
  assert.equal(followedPlan(planned(3)), true, 'stopping a set early is judgement, not failure');
  assert.equal(followedPlan(planned(8)), false, 'doubling the work is not following the plan');
});

/* --------------------------------------------------------------- levels */

test('levels rise but never stall completely', () => {
  let previous = 0;
  for (const xp of [0, 500, 2000, 10000, 50000, 200000]) {
    const level = levelFor(xp);
    assert.ok(level.level >= previous, 'levels must not go backwards');
    assert.ok(level.pct >= 0 && level.pct <= 100);
    assert.ok(level.next > xp || level.level === 60);
    previous = level.level;
  }
  assert.ok(levelFor(200000).level > levelFor(10000).level);
  assert.equal(levelFor(-5).level, 1, 'nonsense input still gives a usable level');
});

test('every level has a name', () => {
  for (let level = 1; level <= 60; level++) {
    assert.ok(levelTitle(level).length > 3, `level ${level} has no title`);
  }
});

/* --------------------------------------------------- achievements */

test('no achievement rewards training more than you can recover from', () => {
  // A badge for "most sets in a week" would have the app arguing with itself.
  const banned = /most sets|max volume|heaviest week|train every day|daily/i;
  for (const a of ACHIEVEMENTS) {
    assert.ok(!banned.test(`${a.name} ${a.blurb}`), `${a.id} rewards the wrong thing`);
    assert.ok(a.xp > 0 && a.blurb && a.detail);
    assert.ok(['bronze', 'silver', 'gold'].includes(a.tier));
  }
});

test('the deload badge is worth more than any consistency badge', () => {
  const deload = ACHIEVEMENTS.find((a) => a.id === 'took-the-deload');
  const streak = ACHIEVEMENTS.find((a) => a.id === 'streak-5');
  assert.ok(deload.xp > streak.xp, 'the most-skipped week should carry the most weight');
});

test('achievements unlock from real logged work', () => {
  const meso = store.startMesocycle('ul4');
  const before = store.progress();
  assert.equal(before.unlocked.length, 0);

  store.startSession(meso.id, 0, 'upper-a');
  store.logSet('bb-bench', 0, { done: true, weight: 100, reps: 5, rir: 2 });
  store.finishSession();

  const after = store.progress();
  assert.ok(after.unlocked.includes('first-session'));
  assert.ok(after.xp > before.xp);
  assert.deepEqual(newlyEarned(before, after).sort(), ['first-pr', 'first-session']);
});

test('progress reports every achievement with how far along it is', () => {
  const progress = store.progress();
  assert.equal(progress.achievements.length, ACHIEVEMENTS.length);
  for (const a of progress.achievements) {
    assert.equal(typeof a.earned, 'boolean');
    assert.ok(a.progress.need > 0, `${a.id} has no target`);
    assert.ok(a.progress.have >= 0);
  }
});

test('a finished block is counted, and only when it is finished', () => {
  const program = getProgram('fb3');
  const meso = store.startMesocycle('fb3');
  const weeks = program.accumulationWeeks + 1;
  for (let w = 0; w < weeks; w++) {
    for (const day of program.days) {
      store.startSession(meso.id, w, day.id);
      const active = store.state.active;
      for (const entry of active.entries) {
        for (let i = 0; i < entry.sets.length; i++) {
          store.logSet(entry.exerciseId, i, { done: true, weight: 50, reps: 8, rir: 2 });
        }
      }
      store.finishSession();
    }
    if (w < weeks - 1) {
      assert.equal(computeTotals(store.state).blocksCompleted, 0, `week ${w + 1} is not a block`);
    }
  }
  const totals = computeTotals(store.state);
  assert.equal(totals.blocksCompleted, 1);
  assert.ok(totals.deloadsCompleted >= 1, 'the easy week counts');
  assert.ok(store.progress().unlocked.includes('took-the-deload'));
  assert.ok(store.progress().unlocked.includes('full-block'));
});

test('progress survives an empty log without throwing', () => {
  const progress = progressFor({ sessions: [], mesocycles: [] });
  assert.equal(progress.xp, 0);
  assert.equal(progress.level.level, 1);
  assert.equal(progress.streak.current, 0);
  assert.equal(progress.unlocked.length, 0);
});
