/**
 * Estimated 1RM and the inverse: what to load for a target rep/effort pair.
 *
 * We use Epley on *reps to failure* rather than reps performed, because a set
 * of 8 with 3 in reserve is an 11-rep effort. That single adjustment is what
 * lets a log of submaximal work drive load prescription at all.
 *
 * Accuracy degrades as reps climb - past ~12 reps to failure the formula
 * drifts and cardiovascular limits start setting the ceiling instead of
 * strength. `confidenceFor` reports that so the UI never presents a number
 * with more certainty than it has.
 */

const EPLEY_DIVISOR = 30;

/** Reps you would have completed had you taken the set to failure. */
export function repsToFailure(reps, rir = 0) {
  return Math.max(1, (Number(reps) || 0) + (Number(rir) || 0));
}

/** RIR-adjusted estimated 1RM. Returns 0 for unusable input. */
export function e1rm(weight, reps, rir = 0) {
  const w = Number(weight);
  if (!Number.isFinite(w) || w <= 0) return 0;
  const rtf = repsToFailure(reps, rir);
  if (rtf <= 1) return w;
  return w * (1 + rtf / EPLEY_DIVISOR);
}

/**
 * Brzycki, kept as a cross-check. The two formulas agree at 10 reps and
 * diverge either side of it: Brzycki reads lower below 10 and higher above.
 * Where they disagree sharply, the estimate is not worth quoting to the kilo.
 */
export function e1rmBrzycki(weight, reps, rir = 0) {
  const w = Number(weight);
  if (!Number.isFinite(w) || w <= 0) return 0;
  const rtf = repsToFailure(reps, rir);
  if (rtf >= 37) return 0;
  return w * (36 / (37 - rtf));
}

/** The load that should produce `reps` at `rir`, given an estimated 1RM. */
export function loadForTarget(oneRm, reps, rir = 0) {
  const max = Number(oneRm);
  if (!Number.isFinite(max) || max <= 0) return 0;
  const rtf = repsToFailure(reps, rir);
  return max / (1 + rtf / EPLEY_DIVISOR);
}

/** Fraction of 1RM a given rep/RIR effort represents (0-1). */
export function percentOfMax(reps, rir = 0) {
  return 1 / (1 + repsToFailure(reps, rir) / EPLEY_DIVISOR);
}

/**
 * How much to trust an estimate. Long sets and deep-fatigue reporting are
 * both noisy, so anything past 12 reps to failure is flagged.
 */
export function confidenceFor(reps, rir = 0) {
  const rtf = repsToFailure(reps, rir);
  if (rtf <= 6) return 'high';
  if (rtf <= 12) return 'medium';
  return 'low';
}

/** Round a load to something you can actually put on the bar. */
export function roundToIncrement(weight, increment) {
  const inc = Number(increment);
  if (!Number.isFinite(inc) || inc <= 0) return Math.round(Number(weight) * 100) / 100;
  return Math.round(Number(weight) / inc) * inc;
}

/** Total load moved: the crudest but most stable measure of session workload. */
export function tonnage(sets) {
  return sets.reduce((sum, s) => {
    if (!s.done || s.warmup) return sum;
    const w = Number(s.weight) || 0;
    const r = Number(s.reps) || 0;
    return sum + w * r;
  }, 0);
}
