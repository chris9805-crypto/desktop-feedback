/**
 * Strength retention.
 *
 * On a cut, "did I get stronger" is the wrong question and asking it every week
 * makes a successful diet feel like a failed training block. The right question
 * is how much of what you built you are keeping.
 *
 * ONE HONEST LIMIT, STATED PLAINLY: this measures STRENGTH retention, not
 * muscle retention. A training app cannot measure muscle. You can hold strength
 * while losing some tissue (the nervous system gets better at expressing what
 * is left) and you can lose strength while holding tissue (fatigue, sleep, a
 * bad week). Strength retention is the best proxy available from a training
 * log, and it is a decent one, but it is a proxy - so it is labelled as what it
 * is everywhere it appears, and never as "muscle retained".
 *
 * Peak is taken from the whole log rather than the current block, because the
 * thing you are trying to keep is the best you have ever been, not the best you
 * were three weeks ago.
 */

import { e1rm } from './onerm.js';
import { bestSet } from './progression.js';
import { getExercise } from '../data/exercises.js';
import { smooth } from './bodyweight.js';

/** Within this much of peak counts as held rather than lost. */
export const HELD_THRESHOLD = 0.97;
/** How far back counts as "current" - one block, roughly. */
export const RECENT_DAYS = 35;

/**
 * Peak and current estimated max for every lift with enough history to say
 * anything. Lifts done once are excluded: a single data point has no trend.
 */
export function retentionByLift(sessions, { now = Date.now(), recentDays = RECENT_DAYS } = {}) {
  const byLift = new Map();

  for (const session of [...sessions].sort((a, b) => a.date - b.date)) {
    for (const entry of session.entries ?? []) {
      const set = bestSet(entry.sets);
      if (!set) continue;
      const value = e1rm(set.weight, set.reps, set.rir ?? 0);
      if (!(value > 0)) continue;

      const record = byLift.get(entry.exerciseId) ?? { peak: 0, peakAt: null, points: [] };
      if (value > record.peak) { record.peak = value; record.peakAt = session.date; }
      record.points.push({ date: session.date, value });
      byLift.set(entry.exerciseId, record);
    }
  }

  const cutoff = now - recentDays * 86400000;
  const rows = [];
  for (const [exerciseId, record] of byLift) {
    if (record.points.length < 2) continue;
    const recent = record.points.filter((p) => p.date >= cutoff);
    // Best recent effort, not the last one - a single bad session is not where
    // you are, and judging a diet on it would be wrong.
    const current = recent.length
      ? Math.max(...recent.map((p) => p.value))
      : record.points.at(-1).value;

    const ratio = record.peak > 0 ? current / record.peak : 0;
    rows.push({
      exerciseId,
      name: getExercise(exerciseId)?.name ?? exerciseId,
      peak: record.peak,
      peakAt: record.peakAt,
      current,
      ratio,
      pct: Math.round(ratio * 100),
      held: ratio >= HELD_THRESHOLD,
      improved: ratio > 1.001,
      stale: recent.length === 0,
    });
  }

  return rows.sort((a, b) => a.ratio - b.ratio);
}

/**
 * The one number a cut is judged on: how much of your peak strength you are
 * still holding, across the lifts you actually track.
 *
 * Compounds are weighted double. They are the lifts that reflect whole-body
 * strength and the ones people actually care about keeping; a lateral raise
 * drifting is not the same news as a squat drifting.
 */
export function overallRetention(sessions, options = {}) {
  const lifts = retentionByLift(sessions, options).filter((l) => !l.stale);
  if (!lifts.length) {
    return { pct: null, lifts: [], held: 0, total: 0, verdict: 'unknown', relative: null };
  }

  let weighted = 0;
  let weight = 0;
  for (const lift of lifts) {
    const w = getExercise(lift.exerciseId)?.type === 'compound' ? 2 : 1;
    weighted += Math.min(lift.ratio, 1.15) * w;   // a spike should not mask a slide
    weight += w;
  }
  const ratio = weighted / weight;
  const held = lifts.filter((l) => l.held).length;

  return {
    pct: Math.round(ratio * 100),
    ratio,
    lifts,
    held,
    total: lifts.length,
    verdict: verdictFor(ratio),
    relative: relativeStrength(sessions, lifts, options),
  };
}

/**
 * Strength per kilo of bodyweight, then and now.
 *
 * This is the number that makes a cut legible. Absolute strength holding while
 * the scale drops is not "no change" - you are lifting the same bar with less
 * of you doing it, which is a genuine improvement that the headline percentage
 * on its own reads as a flat line. Returns null without bodyweight data, and
 * everything above it works fine that way.
 */
export function relativeStrength(sessions, lifts, { weighIns = [], now = Date.now() } = {}) {
  const series = smooth(weighIns);
  if (series.length < 2 || !lifts.length) return null;

  const weightAt = (when) => {
    // Nearest reading at or before the date, else the earliest we have.
    const before = series.filter((p) => p.date <= when);
    return (before.at(-1) ?? series[0]).value;
  };

  let peakRatio = 0;
  let currentRatio = 0;
  let weight = 0;
  for (const lift of lifts) {
    const w = getExercise(lift.exerciseId)?.type === 'compound' ? 2 : 1;
    const bwAtPeak = weightAt(lift.peakAt ?? series[0].date);
    const bwNow = series.at(-1).value;
    if (!(bwAtPeak > 0) || !(bwNow > 0)) continue;
    peakRatio += (lift.peak / bwAtPeak) * w;
    currentRatio += (lift.current / bwNow) * w;
    weight += w;
  }
  if (!weight) return null;

  const then = peakRatio / weight;
  const current = currentRatio / weight;
  const changePct = then > 0 ? ((current - then) / then) * 100 : 0;

  return {
    then,
    current,
    changePct,
    bodyweightNow: series.at(-1).value,
    bodyweightThen: weightAt(lifts[0].peakAt ?? series[0].date),
    improved: changePct > 0.5,
  };
}

/**
 * Wording for the number. Deliberately generous at the top end and calm at the
 * bottom: a few percent off peak during a deficit is a good outcome, and
 * telling someone otherwise is how they end up eating to chase a number on a
 * bar instead of finishing the diet they started.
 */
export function verdictFor(ratio) {
  if (ratio >= 1.005) return 'gaining';
  if (ratio >= HELD_THRESHOLD) return 'holding';
  if (ratio >= 0.92) return 'slipping';
  return 'losing';
}

export const VERDICT_COPY = {
  gaining: {
    label: 'Gaining',
    line: 'You are getting stronger. In a deficit that is unusual and worth noticing.',
  },
  holding: {
    label: 'Holding',
    line: 'You are keeping what you built. That is exactly what a cut is supposed to look like.',
  },
  slipping: {
    label: 'Slipping a little',
    line: 'A few percent off peak. Normal in a deficit, but worth checking sleep, protein, '
      + 'and whether the volume is still more than you can recover from.',
  },
  losing: {
    label: 'Losing ground',
    line: 'More than a few percent down. Usually the deficit is too steep, protein is too low, '
      + 'or the volume has not come down to match. Strength is the signal to act on.',
  },
  unknown: {
    label: 'Not enough history',
    line: 'A couple of sessions on the same lifts and this fills in.',
  },
};

/**
 * A per-session count of lifts that matched or beat their previous best effort.
 * On a cut this is what replaces "new record" as the thing worth celebrating.
 */
export function heldInSession(session, sessions) {
  const priorByLift = new Map();
  for (const past of sessions) {
    if (past.date >= session.date || past.id === session.id) continue;
    for (const entry of past.entries ?? []) {
      const set = bestSet(entry.sets);
      if (!set) continue;
      const value = e1rm(set.weight, set.reps, set.rir ?? 0);
      priorByLift.set(entry.exerciseId, Math.max(priorByLift.get(entry.exerciseId) ?? 0, value));
    }
  }

  let held = 0;
  for (const entry of session.entries ?? []) {
    const set = bestSet(entry.sets);
    if (!set) continue;
    const prior = priorByLift.get(entry.exerciseId);
    if (!prior) continue;
    if (e1rm(set.weight, set.reps, set.rir ?? 0) >= prior * HELD_THRESHOLD) held += 1;
  }
  return held;
}
