/**
 * Building a program of your own.
 *
 * The six templates here are shapes that work, but they are six shapes. People
 * arrive already running something - a split their coach wrote, the routine
 * their gym partner uses, a program off the internet they are four weeks into -
 * and an app that cannot express it is an app they cannot use.
 *
 * A custom program is the *same object* as a built-in one, which is the whole
 * design: it goes through the identical mesocycle engine, so it gets the volume
 * progression, the MRV clamp, the autoregulated load and the deload without a
 * single branch anywhere saying "unless it is a custom one". You are choosing
 * the shape. The app still decides what happens inside it.
 *
 * Everything here is pure: each function takes a program and returns a new one,
 * so the editor can hold drafts, discard them, and never half-write a program
 * into storage.
 */

import { getExercise } from '../data/exercises.js';
import { uid } from '../util/id.js';

export const MAX_DAYS = 7;
export const MAX_SLOTS_PER_DAY = 12;
export const MIN_ACCUMULATION_WEEKS = 3;
export const MAX_ACCUMULATION_WEEKS = 6;

export const ROLES = [
  { id: 'anchor', label: 'Main lift', detail: 'The one the day is built around. Gains sets fastest.' },
  { id: 'secondary', label: 'Secondary', detail: 'Still heavy, still matters.' },
  { id: 'accessory', label: 'Accessory', detail: 'Volume for one muscle.' },
];

/** Custom programs are marked so the library can tell them apart. */
export const CUSTOM_PREFIX = 'own_';

export function isCustomId(id) {
  return typeof id === 'string' && id.startsWith(CUSTOM_PREFIX);
}

/**
 * Effort across the accumulation weeks: start with reps in reserve, end close
 * to failure, never *at* it. Derived rather than editable, because a ramp that
 * starts at 0 is how people bury themselves in week one.
 */
export function rirRamp(weeks) {
  const n = Math.max(1, weeks);
  return Array.from({ length: n }, (_, i) => {
    const spread = 3 - Math.round((i / Math.max(1, n - 1)) * 2);   // 3 -> 1
    return Math.max(1, spread);
  });
}

function emptyDay(index) {
  return {
    id: uid('day'),
    name: `Day ${String.fromCharCode(65 + index)}`,
    focus: '',
    slots: [],
  };
}

export function blankProgram({ name = 'My program', days = 3 } = {}) {
  return normalise({
    id: `${CUSTOM_PREFIX}${uid('p')}`,
    name,
    custom: true,
    createdAt: Date.now(),
    accumulationWeeks: 4,
    days: Array.from({ length: Math.min(days, MAX_DAYS) }, (_, i) => emptyDay(i)),
  });
}

/**
 * A copy of an existing program to edit.
 *
 * New ids throughout: sharing a day id with the template would make a block
 * started from the fork look like the same day to anything keyed on it.
 */
export function forkProgram(program, name) {
  return normalise({
    ...program,
    id: `${CUSTOM_PREFIX}${uid('p')}`,
    name: name || `${program.name} (mine)`,
    custom: true,
    forkedFrom: program.id,
    createdAt: Date.now(),
    days: (program.days ?? []).map((day) => ({
      ...day,
      id: uid('day'),
      slots: (day.slots ?? []).map((slot) => ({ ...slot })),
    })),
  });
}

/**
 * Recompute everything derived from the shape, so the editor never has to keep
 * two facts in step. Anything the rest of the app reads off a program - the
 * day count, the subtitle, the effort ramp - is computed here.
 */
export function normalise(program) {
  const days = (program.days ?? []).slice(0, MAX_DAYS).map((day, i) => ({
    ...day,
    id: day.id ?? uid('day'),
    name: (day.name ?? '').trim() || `Day ${String.fromCharCode(65 + i)}`,
    slots: (day.slots ?? []).slice(0, MAX_SLOTS_PER_DAY),
  }));
  const weeks = clamp(program.accumulationWeeks ?? 4, MIN_ACCUMULATION_WEEKS, MAX_ACCUMULATION_WEEKS);

  return {
    ...program,
    name: (program.name ?? '').trim() || 'My program',
    custom: true,
    days,
    daysPerWeek: days.length,
    accumulationWeeks: weeks,
    rirByWeek: rirRamp(weeks),
    volumeProfile: program.volumeProfile ?? 'custom',
    level: program.level ?? 'Yours',
    focus: program.focus ?? 'Your own shape',
    subtitle: `${days.length} day${days.length === 1 ? '' : 's'} · yours`,
    summary: program.summary
      ?? `${days.length} days a week, ${weeks} weeks of building and then a deload. `
        + 'The shape is yours; the sets, loads and effort are still worked out from what you log.',
    bestFor: program.bestFor ?? ['You already know the split you want to run'],
  };
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, Math.round(Number(n) || lo)));
}

/* ------------------------------------------------------------------ days */

export function addDay(program) {
  if (program.days.length >= MAX_DAYS) return program;
  return normalise({ ...program, days: [...program.days, emptyDay(program.days.length)] });
}

export function removeDay(program, dayId) {
  return normalise({ ...program, days: program.days.filter((d) => d.id !== dayId) });
}

export function updateDay(program, dayId, patch) {
  return normalise({
    ...program,
    days: program.days.map((d) => (d.id === dayId ? { ...d, ...patch } : d)),
  });
}

export function moveDay(program, dayId, delta) {
  const index = program.days.findIndex((d) => d.id === dayId);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= program.days.length) return program;
  const days = [...program.days];
  const [moved] = days.splice(index, 1);
  days.splice(target, 0, moved);
  return normalise({ ...program, days });
}

/* ----------------------------------------------------------------- slots */

/**
 * A new slot, with the exercise's own rep window and a role guessed from what
 * kind of lift it is. Defaults that are usually right beat an empty form.
 */
export function newSlot(exerciseId, { role } = {}) {
  const exercise = getExercise(exerciseId);
  const guessed = role ?? (exercise?.type === 'compound' ? 'secondary' : 'accessory');
  return {
    exerciseId,
    sets: guessed === 'anchor' ? 4 : 3,
    reps: null,
    restSec: null,
    role: guessed,
    superset: null,
    note: null,
    growSets: true,
  };
}

export function addSlot(program, dayId, exerciseId) {
  const day = program.days.find((d) => d.id === dayId);
  if (!day || day.slots.length >= MAX_SLOTS_PER_DAY) return program;
  // The same lift twice in a day would collide: the session keys entries by
  // exercise, so the second one would write over the first.
  if (day.slots.some((s) => s.exerciseId === exerciseId)) return program;
  return updateDay(program, dayId, { slots: [...day.slots, newSlot(exerciseId)] });
}

export function removeSlot(program, dayId, exerciseId) {
  const day = program.days.find((d) => d.id === dayId);
  if (!day) return program;
  return updateDay(program, dayId, { slots: day.slots.filter((s) => s.exerciseId !== exerciseId) });
}

export function updateSlot(program, dayId, exerciseId, patch) {
  const day = program.days.find((d) => d.id === dayId);
  if (!day) return program;
  return updateDay(program, dayId, {
    slots: day.slots.map((s) => (s.exerciseId === exerciseId ? { ...s, ...patch } : s)),
  });
}

export function moveSlot(program, dayId, exerciseId, delta) {
  const day = program.days.find((d) => d.id === dayId);
  if (!day) return program;
  const index = day.slots.findIndex((s) => s.exerciseId === exerciseId);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= day.slots.length) return program;
  const slots = [...day.slots];
  const [moved] = slots.splice(index, 1);
  slots.splice(target, 0, moved);
  return updateDay(program, dayId, { slots });
}

/* ------------------------------------------------------------ validation */

/**
 * What is wrong, and whether it stops you.
 *
 * Errors are things the engine cannot run. Warnings are things that will run
 * and probably should not - said once, without blocking, because it is your
 * program and the app is not the boss of it.
 */
export function validate(program) {
  const problems = [];
  const error = (message) => problems.push({ level: 'error', message });
  const warn = (message) => problems.push({ level: 'warning', message });

  if (!program?.name?.trim()) error('Give it a name.');
  if (!program?.days?.length) error('Add at least one training day.');

  for (const day of program?.days ?? []) {
    if (!day.slots.length) {
      error(`${day.name} has no exercises in it.`);
      continue;
    }
    const seen = new Set();
    for (const slot of day.slots) {
      if (seen.has(slot.exerciseId)) {
        error(`${day.name} has ${getExercise(slot.exerciseId)?.name ?? slot.exerciseId} twice.`);
      }
      seen.add(slot.exerciseId);
      if (!getExercise(slot.exerciseId)) error(`${day.name} refers to a lift that no longer exists.`);
      if (!(slot.sets >= 1)) error(`${day.name}: every exercise needs at least one set.`);
    }
    if (day.slots.length > 9) {
      warn(`${day.name} has ${day.slots.length} exercises — that is a long session.`);
    }
    if (day.slots.reduce((n, s) => n + s.sets, 0) > 30) {
      warn(`${day.name} starts at ${day.slots.reduce((n, s) => n + s.sets, 0)} sets, and the block adds more.`);
    }
  }

  if ((program?.days?.length ?? 0) > 6) {
    warn('Seven days a week leaves no room to recover. Most people do better on four or five.');
  }

  return problems;
}

export function isRunnable(program) {
  return !validate(program).some((p) => p.level === 'error');
}

/** Weekly starting sets per exercise slot, for the "what does this cost" line. */
export function weeklySets(program) {
  return (program?.days ?? []).reduce(
    (n, day) => n + day.slots.reduce((k, s) => k + (s.sets ?? 0), 0), 0);
}
