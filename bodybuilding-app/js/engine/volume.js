/**
 * Volume accounting against the landmarks in data/muscles.js.
 *
 * Sets are counted fractionally: a muscle that is a primary mover on an
 * exercise is credited a full set, one that assists is credited a half. Count
 * every set as a full set for every muscle it touches and you will conclude
 * you are doing 40 sets of triceps a week and cut work you actually needed.
 *
 * Only completed, non-warm-up sets count, and only sets taken within ~4 reps
 * of failure - a set left 6 reps in the tank is a rehearsal, not a stimulus.
 */

import { MUSCLES, MUSCLE_DISPLAY_ORDER } from '../data/muscles.js';
import { getExercise, volumeContribution } from '../data/exercises.js';

export const STIMULUS_RIR_CEILING = 4;

export function isStimulating(set) {
  if (!set.done || set.warmup) return false;
  if (!(Number(set.reps) > 0)) return false;
  const rir = Number(set.rir);
  return !Number.isFinite(rir) || rir <= STIMULUS_RIR_CEILING;
}

/** Fractional hard sets per muscle across a collection of sessions. */
export function setsByMuscle(sessions) {
  const totals = {};
  for (const session of sessions) {
    for (const entry of session.entries ?? []) {
      const exercise = getExercise(entry.exerciseId);
      if (!exercise) continue;
      const hard = (entry.sets ?? []).filter(isStimulating).length;
      if (!hard) continue;
      for (const [muscle, weight] of Object.entries(volumeContribution(exercise))) {
        totals[muscle] = (totals[muscle] ?? 0) + hard * weight;
      }
    }
  }
  return totals;
}

/** Same accounting, but over a *planned* week rather than a logged one. */
export function plannedSetsByMuscle(dayPlans) {
  const totals = {};
  for (const day of dayPlans) {
    for (const s of day.slots ?? []) {
      const exercise = getExercise(s.exerciseId);
      if (!exercise) continue;
      for (const [muscle, weight] of Object.entries(volumeContribution(exercise))) {
        totals[muscle] = (totals[muscle] ?? 0) + (s.sets ?? 0) * weight;
      }
    }
  }
  return totals;
}

/**
 * Where a weekly set count sits relative to the landmarks.
 * The label is what the UI shows - status is never carried by colour alone.
 */
export function landmarkStatus(sets, muscleId) {
  const lm = MUSCLES[muscleId];
  if (!lm) return { zone: 'unknown', label: 'Unknown', advice: '' };
  if (sets <= 0) return { zone: 'none', label: 'Untrained', advice: 'No stimulating sets logged this week.' };
  if (sets < lm.mev) {
    return { zone: 'below-mev', label: 'Below MEV',
      advice: `Under the ${lm.mev} sets that reliably drive growth. Add work or accept maintenance.` };
  }
  if (sets < lm.mav) {
    return { zone: 'productive', label: 'Productive',
      advice: `In the growth range. Room to climb toward ${lm.mav} as the block progresses.` };
  }
  if (sets <= lm.mrv) {
    return { zone: 'near-mrv', label: 'Near ceiling',
      advice: `Deep in the adaptive range. Watch soreness and joint feel - ${lm.mrv} is the recoverable limit.` };
  }
  return { zone: 'over-mrv', label: 'Over MRV',
    advice: `Past ${lm.mrv} recoverable sets. This is where fatigue accumulates instead of muscle.` };
}

/** Rows ready for the volume chart, ordered for display. */
export function volumeReport(totals) {
  return MUSCLE_DISPLAY_ORDER.map((id) => {
    const sets = Math.round((totals[id] ?? 0) * 10) / 10;
    return { id, name: MUSCLES[id].name, sets, ...MUSCLES[id], status: landmarkStatus(sets, id) };
  });
}

/**
 * Muscles that need attention now, worst first.
 *
 * `weekComplete` matters more than it looks. Being under minimum effective
 * volume is only meaningful once the week has actually happened - flagging it
 * on day one, when almost every muscle is trivially under its weekly target,
 * tells someone they are failing at a week they have not had yet. Being over
 * the recoverable ceiling is actionable at any point, because the sets are
 * already done.
 */
export function volumeFlags(totals, { weekComplete = true } = {}) {
  return volumeReport(totals)
    .filter((r) => r.status.zone === 'over-mrv' || (weekComplete && r.status.zone === 'below-mev'))
    .sort((a, b) => (a.status.zone === 'over-mrv' ? -1 : 1) - (b.status.zone === 'over-mrv' ? -1 : 1));
}
