/**
 * Adding a lift the app has never heard of.
 *
 * Two reasons this matters more than it looks. The obvious one is that no
 * fixed library covers every gym: somebody's pendulum squat, somebody's
 * plate-loaded row, the one good machine in a hotel basement. The better one
 * is that the same movement is not the same stimulus for everybody - people
 * genuinely feel a Hammer Strength row in their lats and a cable row in their
 * upper back, or the reverse, and the only person who can say which is the one
 * doing the set.
 *
 * So the muscle tags are the point of this, not paperwork. They are what the
 * volume counter charges the set to, what the body map fills in, and what the
 * weak-point analysis reasons about. Everything else on the form has a sane
 * default derived from the equipment, because a wall of inputs is how you get
 * people typing nonsense into fields they do not understand.
 */

import { MUSCLES } from '../data/muscles.js';
import { allExercises } from '../data/exercises.js';
import { uid } from '../util/id.js';

export const CUSTOM_PREFIX = 'own_';

export function isCustomExerciseId(id) {
  return typeof id === 'string' && id.startsWith(CUSTOM_PREFIX);
}

export const EQUIPMENT = [
  { id: 'machine', label: 'Machine', detail: 'Plate-loaded or selectorised' },
  { id: 'cable', label: 'Cable', detail: 'Pulley of any kind' },
  { id: 'dumbbell', label: 'Dumbbell', detail: 'One in each hand, or one at a time' },
  { id: 'barbell', label: 'Barbell', detail: 'Straight bar, EZ bar, trap bar' },
  { id: 'bodyweight', label: 'Bodyweight', detail: 'Loaded with a belt or a vest, or not at all' },
];

/**
 * Defaults that are usually right for the kit, so the only things anybody has
 * to answer are the name, the equipment and what they feel it in.
 *
 * `stability` decides how close to failure the engine will let you work: a
 * machine can be ground out safely, a heavy barbell cannot. `inc` is the
 * smallest jump that gym actually has.
 */
export const EQUIPMENT_DEFAULTS = {
  machine:    { stability: 'high', inc: 2.5, rest: 120 },
  cable:      { stability: 'high', inc: 2.5, rest: 90 },
  dumbbell:   { stability: 'med', inc: 2, rest: 120 },
  barbell:    { stability: 'low', inc: 2.5, rest: 180 },
  bodyweight: { stability: 'med', inc: 2.5, rest: 120 },
};

export function defaultsFor(equipment, type = 'isolation') {
  const base = EQUIPMENT_DEFAULTS[equipment] ?? EQUIPMENT_DEFAULTS.machine;
  // A barbell isolation lift (curls, wrist work) is not the thing the 'low'
  // rating is about - that is for loaded-spine compounds.
  const stability = equipment === 'barbell' && type !== 'compound' ? 'med' : base.stability;
  return { ...base, stability };
}

export function blankExercise({ name = '', equipment = 'machine' } = {}) {
  return normalise({
    id: `${CUSTOM_PREFIX}${uid('ex')}`,
    name,
    equipment,
    type: 'isolation',
    primary: [],
    secondary: [],
    custom: true,
    createdAt: Date.now(),
  });
}

/** A copy to edit, keeping nothing that identifies the original. */
export function forkExercise(exercise, name) {
  return normalise({
    ...exercise,
    id: `${CUSTOM_PREFIX}${uid('ex')}`,
    name: name || `${exercise.name} (mine)`,
    custom: true,
    forkedFrom: exercise.id,
    createdAt: Date.now(),
    primary: [...(exercise.primary ?? [])],
    secondary: [...(exercise.secondary ?? [])],
    cues: [...(exercise.cues ?? [])],
    subs: [],   // substitutions are about the shipped library, not this
  });
}

/**
 * Fill in and clean up. The one rule worth knowing: a muscle cannot be both
 * primary and secondary, and primary wins - being credited 1.5 sets for one
 * muscle would quietly inflate every volume number the app shows.
 */
export function normalise(exercise) {
  const equipment = EQUIPMENT.some((e) => e.id === exercise.equipment) ? exercise.equipment : 'machine';
  const primary = unique(exercise.primary).filter(isMuscle);
  const secondary = unique(exercise.secondary).filter((m) => isMuscle(m) && !primary.includes(m));
  const type = exercise.type === 'compound' ? 'compound' : 'isolation';
  const fallback = defaultsFor(equipment, type);

  return {
    ...exercise,
    id: exercise.id ?? `${CUSTOM_PREFIX}${uid('ex')}`,
    name: (exercise.name ?? '').trim(),
    custom: true,
    equipment,
    type,
    primary,
    secondary,
    reps: validReps(exercise.reps) ?? (type === 'compound' ? [6, 10] : [10, 15]),
    inc: positive(exercise.inc) ?? fallback.inc,
    stability: ['high', 'med', 'low'].includes(exercise.stability) ? exercise.stability : fallback.stability,
    unilateral: Boolean(exercise.unilateral),
    cues: (exercise.cues ?? []).filter((c) => String(c).trim()).slice(0, 5),
    subs: exercise.subs ?? [],
  };
}

function unique(list) {
  return [...new Set(Array.isArray(list) ? list : [])];
}

function isMuscle(id) {
  return Boolean(MUSCLES[id]);
}

function validReps(reps) {
  if (!Array.isArray(reps) || reps.length !== 2) return null;
  const [lo, hi] = reps.map((n) => Math.round(Number(n)));
  if (!(lo >= 1) || !(hi >= lo) || hi > 50) return null;
  return [lo, hi];
}

function positive(n) {
  const value = Number(n);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Errors stop a save. Warnings are things that will work and might not be what
 * somebody meant - said once, not enforced, because the person who did the set
 * knows more about where they felt it than this app does.
 */
export function validate(exercise, { existing = [] } = {}) {
  const problems = [];
  const error = (message) => problems.push({ level: 'error', message });
  const warn = (message) => problems.push({ level: 'warning', message });

  const name = (exercise?.name ?? '').trim();
  if (!name) error('Give it a name — whatever you call it in the gym.');
  if (name.length > 60) error('That name is too long to fit on a card.');

  if (!exercise?.primary?.length) {
    error('Pick at least one muscle you feel it in. That is what the set gets counted towards.');
  }
  if ((exercise?.primary?.length ?? 0) > 3) {
    warn('More than three main muscles usually means this is really two exercises.');
  }
  if (exercise?.type === 'isolation' && (exercise?.primary?.length ?? 0) > 1) {
    warn('Several main muscles is unusual for an isolation lift — worth marking it compound.');
  }

  const clash = existing.find((e) =>
    e.id !== exercise?.id && e.name.trim().toLowerCase() === name.toLowerCase());
  if (clash) warn(`You already have a lift called "${clash.name}". Two the same is hard to tell apart later.`);

  return problems;
}

export function isSaveable(exercise, options) {
  return !validate(exercise, options).some((p) => p.level === 'error');
}

/** How much volume one set of this charges, for the preview line. */
export function creditLine(exercise) {
  const parts = [];
  for (const m of exercise.primary ?? []) parts.push(`${MUSCLES[m]?.name ?? m} 1`);
  for (const m of exercise.secondary ?? []) parts.push(`${MUSCLES[m]?.name ?? m} ½`);
  return parts.join(' · ');
}

/** Names already taken, for the duplicate warning. */
export function existingNames() {
  return allExercises();
}
