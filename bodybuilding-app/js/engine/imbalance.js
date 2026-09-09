/**
 * Weak-point detection.
 *
 * Once someone is past the stage where everything grows, the average stops
 * being the interesting number and the weak links start being the only
 * interesting number. This reads the log for three kinds of imbalance:
 *
 *   1. STRENGTH RATIOS between lifts. A bench that has run away from the row
 *      it is supposed to roughly match is a back problem wearing a chest
 *      problem's clothes, and it eventually becomes a shoulder problem.
 *
 *   2. PROGRESS RATE by muscle. A muscle whose estimated max has gone
 *      nowhere for a block while everything else moved is lagging, regardless
 *      of how many sets it is getting.
 *
 *   3. SIDE-TO-SIDE, from what you report after unilateral work. Nobody
 *      measures this and everybody has it.
 *
 * Everything here is descriptive: it reports what the log says, ranked by how
 * far off it is. Acting on it is a separate decision - see mesocycle.js, which
 * steers extra weekly sets toward whatever this surfaces.
 */

import { getExercise } from '../data/exercises.js';
import { MUSCLES, muscleName } from '../data/muscles.js';
import { e1rm } from './onerm.js';
import { bestSet } from './progression.js';

/**
 * Expected strength relationships between lifts, as a fraction of the
 * reference lift. These are rough population norms, not targets - being off
 * one is a prompt to look, not a diagnosis. Ranges are deliberately wide.
 */
export const STRENGTH_RATIOS = [
  {
    id: 'row-vs-bench',
    lift: 'bb-row', reference: 'bb-bench', expected: 0.85, tolerance: 0.2,
    lagging: ['upperBack', 'lats'],
    low: 'Your row is well behind your bench. Pressing volume has outrun pulling volume, ' +
         'which shows up first as stalled bench and later as unhappy shoulders.',
    high: 'Your row is well ahead of your bench, which is unusual and usually means the row ' +
          'is getting help from the hips. Worth filming a set.',
  },
  {
    id: 'ohp-vs-bench',
    lift: 'ohp', reference: 'bb-bench', expected: 0.62, tolerance: 0.15,
    lagging: ['frontDelts', 'triceps'],
    low: 'Your overhead press is low relative to your bench - typically weak triceps and ' +
         'front delts, or a torso that gives way before the arms do.',
    high: 'Your overhead press is high relative to your bench. Your chest is the thing to push.',
  },
  {
    id: 'squat-vs-deadlift',
    lift: 'back-squat', reference: 'deadlift', expected: 0.82, tolerance: 0.18,
    lagging: ['quads'],
    low: 'Your squat trails your deadlift by more than usual, which normally means quads ' +
         'rather than the posterior chain are the limiting factor.',
    high: 'Your deadlift trails your squat. Usually hamstrings, glutes or grip.',
  },
  {
    id: 'pull-vs-press-vertical',
    lift: 'pullup', reference: 'ohp', expected: 1.35, tolerance: 0.35,
    lagging: ['lats', 'biceps'],
    low: 'Vertical pulling is behind vertical pressing. Lats and upper back are the gap.',
    high: 'Vertical pressing is well behind your pulling - front delts and triceps.',
  },
];

/** Best estimated 1RM ever logged for a movement. */
export function bestE1rm(sessions, exerciseId) {
  let best = 0;
  let when = null;
  for (const session of sessions) {
    for (const entry of session.entries ?? []) {
      if (entry.exerciseId !== exerciseId) continue;
      const set = bestSet(entry.sets);
      if (!set) continue;
      const value = e1rm(set.weight, set.reps, set.rir ?? 0);
      if (value > best) { best = value; when = session.date; }
    }
  }
  return best ? { value: best, date: when } : null;
}

/** Strength ratios that are meaningfully out of their expected band. */
export function ratioFindings(sessions) {
  const out = [];
  for (const rule of STRENGTH_RATIOS) {
    const lift = bestE1rm(sessions, rule.lift);
    const reference = bestE1rm(sessions, rule.reference);
    // A bodyweight movement logged at 0 added load carries no ratio signal.
    if (!lift || !reference || reference.value <= 0 || lift.value <= 0) continue;

    const actual = lift.value / reference.value;
    const drift = actual - rule.expected;
    if (Math.abs(drift) <= rule.tolerance) continue;

    out.push({
      kind: 'ratio',
      id: rule.id,
      severity: Math.abs(drift) / rule.tolerance,
      lagging: drift < 0 ? rule.lagging : [],
      title: drift < 0
        ? `${getExercise(rule.lift)?.name} is lagging ${getExercise(rule.reference)?.name}`
        : `${getExercise(rule.reference)?.name} is lagging ${getExercise(rule.lift)?.name}`,
      detail: drift < 0 ? rule.low : rule.high,
      evidence: `${Math.round(lift.value)} vs ${Math.round(reference.value)} — ` +
        `a ratio of ${actual.toFixed(2)} where ${rule.expected.toFixed(2)} is typical.`,
    });
  }
  return out;
}

/**
 * Muscles whose estimated max has not moved while others have.
 *
 * Compares each muscle's best e1RM in the most recent window against the
 * window before it, using the exercises where that muscle is a primary mover.
 */
export function progressFindings(sessions, { windowDays = 35 } = {}) {
  if (sessions.length < 6) return [];
  const now = Math.max(...sessions.map((s) => s.date));
  const recent = sessions.filter((s) => s.date > now - windowDays * 86400000);
  const earlier = sessions.filter((s) => s.date <= now - windowDays * 86400000);
  if (!earlier.length || !recent.length) return [];

  const byMuscle = (set) => {
    const totals = {};
    for (const session of set) {
      for (const entry of session.entries ?? []) {
        const exercise = getExercise(entry.exerciseId);
        const best = bestSet(entry.sets);
        if (!exercise || !best) continue;
        const value = e1rm(best.weight, best.reps, best.rir ?? 0);
        for (const muscle of exercise.primary) {
          totals[muscle] = Math.max(totals[muscle] ?? 0, value);
        }
      }
    }
    return totals;
  };

  const before = byMuscle(earlier);
  const after = byMuscle(recent);
  const changes = [];
  for (const muscle of Object.keys(after)) {
    if (!before[muscle]) continue;
    changes.push({ muscle, pct: ((after[muscle] - before[muscle]) / before[muscle]) * 100 });
  }
  if (changes.length < 3) return [];

  const median = [...changes].sort((a, b) => a.pct - b.pct)[Math.floor(changes.length / 2)].pct;
  return changes
    .filter((c) => c.pct < median - 3 && c.pct < 2)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 3)
    .map((c) => ({
      kind: 'progress',
      id: `progress-${c.muscle}`,
      severity: Math.min(3, (median - c.pct) / 5),
      lagging: [c.muscle],
      title: `${muscleName(c.muscle)} has stopped moving`,
      detail: `Strength on your ${muscleName(c.muscle).toLowerCase()} work has gone ` +
        `${c.pct >= 0 ? 'up only' : 'backwards'} ${Math.abs(c.pct).toFixed(1)}% while the rest of ` +
        `your lifts averaged ${median.toFixed(1)}%. More volume here is usually the answer.`,
      evidence: `${c.pct >= 0 ? '+' : ''}${c.pct.toFixed(1)}% against a ${median.toFixed(1)}% median.`,
    }));
}

/**
 * Side-to-side differences, from what you reported after unilateral sets.
 * Only fires once there is enough agreement to not be one bad day.
 */
export function sideFindings(sessions, { minReports = 3 } = {}) {
  const tally = {};
  for (const session of sessions) {
    for (const [exerciseId, side] of Object.entries(session.sideReports ?? {})) {
      if (side !== 'left' && side !== 'right') continue;
      const bucket = (tally[exerciseId] ??= { left: 0, right: 0 });
      bucket[side] += 1;
    }
  }
  const out = [];
  for (const [exerciseId, counts] of Object.entries(tally)) {
    const total = counts.left + counts.right;
    if (total < minReports) continue;
    const weaker = counts.left > counts.right ? 'left' : 'right';
    const share = Math.max(counts.left, counts.right) / total;
    if (share < 0.7) continue;
    const exercise = getExercise(exerciseId);
    out.push({
      kind: 'side',
      id: `side-${exerciseId}`,
      severity: (share - 0.7) / 0.3 * 2,
      lagging: exercise?.primary ?? [],
      title: `Your ${weaker} side is weaker on ${exercise?.name ?? exerciseId}`,
      detail: `You have reported the ${weaker} side as the harder one in ` +
        `${Math.round(share * 100)}% of sets. Lead with that side and match the ` +
        `stronger one to it, rather than the other way round.`,
      evidence: `${Math.max(counts.left, counts.right)} of ${total} sets.`,
    });
  }
  return out;
}

/** Everything, ranked worst first. */
export function analyse(sessions) {
  const findings = [
    ...ratioFindings(sessions),
    ...progressFindings(sessions),
    ...sideFindings(sessions),
  ].sort((a, b) => b.severity - a.severity);

  // Muscles worth steering extra volume to, most urgent first, de-duplicated.
  const lagging = [];
  for (const finding of findings) {
    for (const muscle of finding.lagging) {
      if (MUSCLES[muscle] && !lagging.includes(muscle)) lagging.push(muscle);
    }
  }
  return { findings, lagging };
}
