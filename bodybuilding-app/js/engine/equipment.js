/**
 * Adapting a program to the equipment someone actually has.
 *
 * Most training apps assume a full commercial gym and leave everyone else to
 * improvise, which for a beginner means quietly doing the wrong exercise or
 * quietly not going. Every exercise in the library already lists substitutes
 * that train the same thing; this walks that graph to find the nearest
 * movement the person can actually perform.
 *
 * If no substitute exists the original is kept and flagged, because silently
 * dropping a muscle from someone's program is worse than telling them there is
 * a gap.
 */

import { getExercise } from '../data/exercises.js';

export const EQUIPMENT_PROFILES = {
  full: {
    id: 'full',
    name: 'A full gym',
    detail: 'Barbells, racks, machines, cables, dumbbells.',
    allows: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'],
  },
  noBarbell: {
    id: 'noBarbell',
    name: 'Machines, cables and dumbbells',
    detail: 'A gym without a squat rack, or you would rather not use barbells yet.',
    allows: ['dumbbell', 'machine', 'cable', 'bodyweight'],
  },
  home: {
    id: 'home',
    name: 'Dumbbells at home',
    detail: 'A pair of adjustable dumbbells, a bench, and somewhere to hang.',
    allows: ['dumbbell', 'bodyweight'],
  },
};

export const DEFAULT_PROFILE = 'full';

function allowedFor(profileId) {
  return (EQUIPMENT_PROFILES[profileId] ?? EQUIPMENT_PROFILES[DEFAULT_PROFILE]).allows;
}

/**
 * Nearest usable movement, searched breadth-first through the substitution
 * graph so the closest match wins rather than the first one found.
 */
export function substituteFor(exerciseId, profileId) {
  const allows = allowedFor(profileId);
  const start = getExercise(exerciseId);
  if (!start) return { id: exerciseId, changed: false, unavailable: false };
  if (allows.includes(start.equipment)) return { id: exerciseId, changed: false, unavailable: false };

  const seen = new Set([exerciseId]);
  let frontier = [...start.subs];
  while (frontier.length) {
    const next = [];
    for (const id of frontier) {
      if (seen.has(id)) continue;
      seen.add(id);
      const candidate = getExercise(id);
      if (!candidate) continue;
      if (allows.includes(candidate.equipment)) return { id, changed: true, unavailable: false };
      next.push(...candidate.subs);
    }
    frontier = next;
  }
  return { id: exerciseId, changed: false, unavailable: true };
}

/** Rewrite a week's resolved days for one equipment profile. */
export function adaptDays(days, profileId) {
  if (!profileId || profileId === DEFAULT_PROFILE) return days;
  return days.map((day) => ({
    ...day,
    slots: day.slots.map((slot) => {
      const swap = substituteFor(slot.exerciseId, profileId);
      if (!swap.changed && !swap.unavailable) return slot;
      return {
        ...slot,
        exerciseId: swap.id,
        // Rep windows belong to the movement, not the slot, unless the program
        // deliberately set one - a machine press does not want a barbell's 3-5.
        reps: swap.changed && slot.reps && getExercise(slot.exerciseId)?.type === 'compound'
          ? widenForSubstitute(slot.reps)
          : slot.reps,
        substitutedFrom: swap.changed ? slot.exerciseId : null,
        unavailable: swap.unavailable,
      };
    }),
  }));
}

/**
 * A machine or dumbbell version of a heavy barbell lift belongs in a slightly
 * higher rep range - you cannot load it as heavily, and grinding low reps on a
 * dumbbell press is mostly a test of shoulder stability.
 */
function widenForSubstitute([min, max]) {
  return min >= 6 ? [min, max] : [Math.max(min + 3, 6), Math.max(max + 4, 10)];
}

/** What a program looks like under a profile - used to warn before you commit. */
export function adaptationReport(program, profileId) {
  const swaps = [];
  const gaps = [];
  for (const day of program.days) {
    for (const slot of day.slots) {
      const swap = substituteFor(slot.exerciseId, profileId);
      if (swap.unavailable) gaps.push({ dayId: day.id, exerciseId: slot.exerciseId });
      else if (swap.changed) swaps.push({ dayId: day.id, from: slot.exerciseId, to: swap.id });
    }
  }
  return { swaps, gaps, usable: gaps.length === 0 };
}
