/**
 * Drop sets.
 *
 * Strip the weight the moment you fail and keep going. It is one of the few
 * intensity techniques that is genuinely useful rather than just tiring, and
 * the app could not express it at all: people were logging the drops as extra
 * sets, which is wrong in a way that quietly ruins the numbers.
 *
 * THE ACCOUNTING, WHICH IS THE WHOLE POINT:
 *
 *   Volume    a drop set is ONE hard set, not three. The drops are extra
 *             fatigue on an already-stimulated muscle, not fresh stimulus, and
 *             counting them separately would push somebody over their weekly
 *             ceiling while the app told them they were fine. This is the
 *             conservative reading and it is the one that protects recovery.
 *   Tonnage   every rep counts. It is a measure of work done, and the drops
 *             were work.
 *   Records   drops never set one. They are lighter by definition and taken
 *             past failure - crediting a rep record to the tail of a drop set
 *             would make records meaningless.
 *   Effort    not asked. A drop set ends when you cannot do another rep; there
 *             is no "how many more could you have done".
 */

/** A sensible next weight: about a third off, rounded to something loadable. */
export const DEFAULT_DROP_FRACTION = 0.7;

export function suggestDropWeight(weight, increment = 2.5) {
  if (!(Number(weight) > 0)) return null;
  const target = weight * DEFAULT_DROP_FRACTION;
  const step = Number(increment) > 0 ? Number(increment) : 2.5;
  const rounded = Math.round(target / step) * step;
  // Never suggest the same weight back, and never suggest nothing.
  return Math.max(step, Math.min(rounded, weight - step));
}

export function drops(set) {
  return Array.isArray(set?.drops) ? set.drops : [];
}

export function hasDrops(set) {
  return drops(set).length > 0;
}

/** Reps done after the weight came off, across every drop on the set. */
export function dropReps(set) {
  return drops(set).reduce((n, d) => n + (Number(d.reps) || 0), 0);
}

/** Work done in the drops alone, which tonnage adds to the set's own. */
export function dropTonnage(set) {
  return drops(set).reduce((n, d) => n + (Number(d.weight) || 0) * (Number(d.reps) || 0), 0);
}

/**
 * A drop is only real with a weight and at least one rep behind it.
 *
 * The null checks are not belt and braces: Number(null) is 0, so an empty
 * weight field would otherwise sail through as a valid bodyweight drop. Zero
 * itself stays valid, because dropping to bodyweight is a real thing to do.
 */
export function isValidDrop(drop) {
  if (!drop) return false;
  const weight = numberOrNull(drop.weight);
  const reps = numberOrNull(drop.reps);
  return weight != null && weight >= 0 && reps != null && reps > 0;
}

function numberOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export const MAX_DROPS = 4;

/** One line for the log: `2 drops · 70kg × 6, 50kg × 5`. */
export function describeDrops(set, unit = 'kg') {
  const list = drops(set);
  if (!list.length) return '';
  const parts = list.map((d) => `${trim(d.weight)}${unit} × ${d.reps}`);
  return `${list.length} drop${list.length === 1 ? '' : 's'} · ${parts.join(', ')}`;
}

function trim(n) {
  const value = Number(n);
  return Math.abs(value - Math.round(value)) < 0.01 ? Math.round(value) : Math.round(value * 100) / 100;
}
