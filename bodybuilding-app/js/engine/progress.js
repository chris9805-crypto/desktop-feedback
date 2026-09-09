/**
 * Streaks, XP and levels.
 *
 * Gamification in a training app is easy to get actively wrong. A daily streak
 * would push people to train seven days a week; XP per set would reward
 * training past what you can recover from. Both would make the app argue with
 * its own progression engine, which spends its time capping volume at MRV and
 * insisting on deload weeks.
 *
 * So the incentives are pointed at the behaviours that actually produce
 * results:
 *
 *   - Turning up to a session you planned.
 *   - Doing what the plan said, rather than more than it said.
 *   - Reporting effort and recovery honestly.
 *   - Taking the easy week.
 *
 * And crucially, REST DOES NOT BREAK A STREAK. The streak counts consecutive
 * planned sessions completed, not consecutive days. A rest day is part of the
 * program; punishing it would be punishing people for following the plan.
 */

import { tonnage, e1rm } from './onerm.js';
import { bestSet } from './progression.js';
import { getProgram } from '../data/programs.js';
import { totalWeeks } from './mesocycle.js';
import { setsByMuscle, volumeReport } from './volume.js';
import { ACHIEVEMENTS } from '../data/achievements.js';

/* ------------------------------------------------------------------ XP */

export const XP = {
  session: 60,          // turning up is the main thing
  perWorkingSet: 4,     // small - sets are not the point, the session is
  effortLogged: 2,      // the one input the engine cannot derive
  sessionFeedback: 25,  // the end-of-session cards
  onPlan: 30,           // did what the plan asked rather than freelancing
  personalRecord: 40,
  weekComplete: 150,
  deloadSession: 90,    // deliberately worth more than a hard session
  blockComplete: 500,
};

/** How much a single logged session was worth, and why. */
export function sessionXp(session, { isPr = false, deload = false, onPlan = false } = {}) {
  const lines = [];
  const add = (amount, label) => { if (amount > 0) lines.push({ amount, label }); };

  add(deload ? XP.deloadSession : XP.session, deload ? 'Easy week session' : 'Session complete');

  const sets = (session.entries ?? []).reduce((n, e) => n + e.sets.filter((s) => !s.warmup).length, 0);
  add(sets * XP.perWorkingSet, `${sets} working sets`);

  const withEffort = (session.entries ?? [])
    .reduce((n, e) => n + e.sets.filter((s) => s.rir != null && !s.warmup).length, 0);
  add(withEffort * XP.effortLogged, 'Effort reported');

  if (Object.keys(session.feedback ?? {}).length || Object.keys(session.session ?? {}).length) {
    add(XP.sessionFeedback, 'Recovery questions answered');
  }
  if (onPlan) add(XP.onPlan, 'Stuck to the plan');
  if (isPr) add(XP.personalRecord, 'New best');

  return { total: lines.reduce((n, l) => n + l.amount, 0), lines };
}

/**
 * Did the session follow the plan? Deliberately allows doing slightly less -
 * stopping a set early because something felt wrong is good judgement, not a
 * failure - but not doing substantially more, which is how people bury
 * themselves.
 */
export function followedPlan(session) {
  const entries = session.entries ?? [];
  if (!entries.length) return false;
  return entries.every((entry) => {
    const planned = entry.prescription?.sets ?? 0;
    const done = entry.sets.filter((s) => !s.warmup).length;
    return planned === 0 || (done >= planned - 1 && done <= planned + 1);
  });
}

/* -------------------------------------------------------------- levels */

/**
 * Level thresholds. Rises steeply enough that levels keep meaning something,
 * gently enough that someone three months in is not still on level 2.
 */
export function levelFor(xp) {
  const total = Math.max(0, Number(xp) || 0);
  let level = 1;
  let floor = 0;
  let span = 250;
  while (total >= floor + span && level < 60) {
    floor += span;
    level += 1;
    span = Math.round(span * 1.18);
  }
  return {
    level,
    into: total - floor,
    span,
    next: floor + span,
    pct: Math.min(100, Math.round(((total - floor) / span) * 100)),
  };
}

/** A name for the level band, so the number means something at a glance. */
export function levelTitle(level) {
  if (level >= 30) return 'Veteran';
  if (level >= 20) return 'Advanced';
  if (level >= 12) return 'Seasoned';
  if (level >= 6) return 'Committed';
  if (level >= 3) return 'Building';
  return 'Getting started';
}

/* -------------------------------------------------------------- streak */

/**
 * Consecutive planned sessions completed.
 *
 * Counted in sessions rather than days, on purpose. The program says how often
 * to train; a rest day is following it, not breaking it. What breaks a streak
 * is going long enough without training that you have clearly skipped
 * something you planned.
 */
export function streakFor(sessions, { now = Date.now() } = {}) {
  const ordered = [...sessions].sort((a, b) => a.date - b.date);
  if (!ordered.length) return { current: 0, best: 0, atRisk: false, daysSince: null };

  let current = 0;
  let best = 0;
  let previous = null;
  for (const session of ordered) {
    const gapDays = previous == null ? 0 : (session.date - previous) / 86400000;
    // Up to five days between sessions is a normal week with rest in it.
    current = previous == null || gapDays <= GAP_LIMIT_DAYS ? current + 1 : 1;
    best = Math.max(best, current);
    previous = session.date;
  }

  const daysSince = (now - previous) / 86400000;
  if (daysSince > GAP_LIMIT_DAYS) current = 0;

  return {
    current,
    best,
    daysSince: Math.floor(daysSince),
    // A nudge, not a punishment: it says the streak needs a session soon.
    atRisk: current > 0 && daysSince >= GAP_LIMIT_DAYS - 2,
  };
}

export const GAP_LIMIT_DAYS = 5;

/* -------------------------------------------------------------- totals */

/** Everything the achievements are tested against, derived from the log. */
export function computeTotals(state) {
  const sessions = [...(state.sessions ?? [])].sort((a, b) => a.date - b.date);

  let setsWithEffort = 0;
  let sessionsWithFeedback = 0;
  let deloadsCompleted = 0;
  const bestByExercise = new Map();
  let prs = 0;

  for (const session of sessions) {
    const program = getProgram(session.programId);
    const isDeload = program ? session.week >= (program.accumulationWeeks ?? 4) : false;
    if (isDeload) deloadsCompleted += 1;
    if (Object.keys(session.feedback ?? {}).length || Object.keys(session.session ?? {}).length) {
      sessionsWithFeedback += 1;
    }
    for (const entry of session.entries ?? []) {
      for (const s of entry.sets ?? []) if (s.rir != null && !s.warmup) setsWithEffort += 1;
      const best = bestSet(entry.sets);
      if (!best) continue;
      const value = e1rm(best.weight, best.reps, best.rir ?? 0);
      const previous = bestByExercise.get(entry.exerciseId) ?? 0;
      if (value > previous * 1.005) { prs += 1; bestByExercise.set(entry.exerciseId, value); }
    }
  }

  // Weeks where every planned session was logged, and weeks where every muscle
  // trained landed inside its productive range.
  let perfectWeeks = 0;
  let balancedWeeks = 0;
  const byWeek = new Map();
  for (const session of sessions) {
    const key = `${session.mesoId}:${session.week}`;
    if (!byWeek.has(key)) byWeek.set(key, []);
    byWeek.get(key).push(session);
  }
  for (const weekSessions of byWeek.values()) {
    const program = getProgram(weekSessions[0].programId);
    if (program && weekSessions.length >= program.days.length) perfectWeeks += 1;
    const report = volumeReport(setsByMuscle(weekSessions)).filter((r) => r.sets > 0);
    if (report.length >= 4 && report.every((r) => r.status.zone === 'productive' || r.status.zone === 'near-mrv')) {
      balancedWeeks += 1;
    }
  }

  const blocksCompleted = (state.mesocycles ?? []).filter((meso) => {
    const program = getProgram(meso.programId);
    if (!program) return false;
    return Object.keys(meso.completed ?? {}).length >= totalWeeks(program) * program.days.length;
  }).length;

  return {
    sessions: sessions.length,
    setsWithEffort,
    sessionsWithFeedback,
    deloadsCompleted,
    blocksCompleted,
    perfectWeeks,
    balancedWeeks,
    prs,
    tonnage: sessions.reduce((n, s) =>
      n + (s.entries ?? []).reduce((k, e) => k + tonnage(e.sets), 0), 0),
  };
}

/* ------------------------------------------------------- the whole picture */

/** Everything the progress UI needs, from the stored state alone. */
export function progressFor(state, { now = Date.now() } = {}) {
  const sessions = state.sessions ?? [];
  const totals = computeTotals(state);
  const streak = streakFor(sessions, { now });

  let xp = 0;
  const bestByExercise = new Map();
  for (const session of [...sessions].sort((a, b) => a.date - b.date)) {
    const program = getProgram(session.programId);
    const deload = program ? session.week >= (program.accumulationWeeks ?? 4) : false;
    let isPr = false;
    for (const entry of session.entries ?? []) {
      const best = bestSet(entry.sets);
      if (!best) continue;
      const value = e1rm(best.weight, best.reps, best.rir ?? 0);
      if (value > (bestByExercise.get(entry.exerciseId) ?? 0) * 1.005) {
        isPr = true;
        bestByExercise.set(entry.exerciseId, value);
      }
    }
    xp += sessionXp(session, { isPr, deload, onPlan: followedPlan(session) }).total;
  }

  const context = { totals, streak, state };
  const unlocked = ACHIEVEMENTS.filter((a) => a.test(context));
  xp += unlocked.reduce((n, a) => n + a.xp, 0);
  xp += totals.perfectWeeks * XP.weekComplete;
  xp += totals.blocksCompleted * XP.blockComplete;

  return {
    xp,
    level: levelFor(xp),
    streak,
    totals,
    unlocked: unlocked.map((a) => a.id),
    achievements: ACHIEVEMENTS.map((a) => ({
      ...a,
      earned: unlocked.includes(a),
      progress: a.progress(context),
    })),
  };
}

/** Achievements earned by this session that were not earned before it. */
export function newlyEarned(before, after) {
  const had = new Set(before?.unlocked ?? []);
  return (after?.unlocked ?? []).filter((id) => !had.has(id));
}
