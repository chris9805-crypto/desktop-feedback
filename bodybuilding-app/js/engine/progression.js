/**
 * The progression engine.
 *
 * Every week it answers one question per exercise: given exactly what you did
 * last time and how hard it felt, what should be on the bar today?
 *
 * Two mechanisms drive it.
 *
 * 1. DOUBLE PROGRESSION on load and reps. You work inside a rep window. Reps
 *    climb week to week until you reach the top of the window at the planned
 *    effort; only then does load go up and reps reset to the bottom. This is
 *    what stops the two classic failure modes - adding weight faster than you
 *    can hold form, and doing the same three sets of ten for a year.
 *
 * 2. RIR AUTOREGULATION on top of it. Reps in Reserve is the honest report of
 *    how many more you had. If you left far more in the tank than the plan
 *    called for, the load was wrong and we correct it in one jump rather than
 *    creeping up for three weeks. If you went harder than planned, we hold and
 *    let the plan's own rising effort catch up to where you already are.
 *
 * Planned effort tightens across the block (3 RIR -> 0 RIR is typical), then the
 * deload drops both load and volume so the accumulated fatigue can dissipate
 * and the adaptation shows up.
 */

import {
  e1rm, loadForTarget, roundToIncrement, confidenceFor, repsToFailure,
} from './onerm.js';
import { getMode, biasedRepRange, DEFAULT_MODE } from '../data/modes.js';

/** How close to failure a movement can safely be taken. */
const RIR_FLOOR = { low: 1, med: 0, high: 0 };

/**
 * The set the engine reasons from: the first real work set, before fatigue.
 *
 * A set with no load recorded is skipped. Zero is a legitimate load - that is
 * a bodyweight pull-up or dip, and the engine will happily start adding weight
 * to it - but null means nobody wrote the number down, and prescribing from
 * that produces confident nonsense.
 */
export function referenceSet(sets = []) {
  return sets.find((s) => s.done && !s.warmup && Number(s.reps) > 0
    && s.weight != null && Number.isFinite(Number(s.weight))) ?? null;
}

/** Best set of an entry by estimated 1RM - used for tracking, not prescribing. */
export function bestSet(sets = []) {
  let best = null;
  let bestScore = 0;
  for (const s of sets) {
    if (!s.done || s.warmup || !(Number(s.reps) > 0)) continue;
    if (s.weight == null || !Number.isFinite(Number(s.weight))) continue;
    const score = e1rm(s.weight, s.reps, s.rir ?? 0);
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return best;
}

/** Smallest load jump that makes sense for this exercise in this unit. */
export function incrementFor(exercise, unit = 'kg') {
  const kg = exercise?.inc ?? 2.5;
  if (unit !== 'lb') return kg;
  const lb = kg * 2.20462;
  return Math.max(2.5, Math.round(lb / 2.5) * 2.5);
}

/**
 * A jump big enough to matter at this load. A flat 2.5kg is a 5% jump on a
 * lateral raise and a 1% jump on a heavy squat; scaling by load keeps the
 * relative step honest, while never going below what the plates allow.
 */
export function loadStep(exercise, weight, unit = 'kg') {
  const base = incrementFor(exercise, unit);
  const w = Number(weight) || 0;
  const pct = w * (exercise?.type === 'compound' ? 0.025 : 0.03);
  const step = Math.min(Math.max(base, pct), base * 3);
  return roundToIncrement(step, base) || base;
}

/**
 * Planned effort for a week, respecting both the movement's safe floor and the
 * lifter's own. A beginner is never sent within two reps of failure however
 * stable the machine is; an advanced lifter on a machine can go all the way.
 */
export function targetRirFor(program, weekIndex, exercise, modeId = DEFAULT_MODE) {
  const accumulation = program?.accumulationWeeks ?? 4;
  const mode = getMode(modeId);
  if (weekIndex >= accumulation) return 4; // deload
  const planned = program?.rirByWeek?.[weekIndex] ?? 2;
  const movementFloor = RIR_FLOOR[exercise?.stability ?? 'med'] ?? 0;
  return Math.max(planned, movementFloor, mode.rirFloor ?? 0);
}

export function isDeloadWeek(program, weekIndex) {
  return weekIndex >= (program?.accumulationWeeks ?? 4);
}

/**
 * Prescribe one exercise for one session.
 *
 * @param {object} ctx
 * @param {object} ctx.exercise   exercise definition
 * @param {object} ctx.slot       resolved slot (sets already set for this week)
 * @param {object} ctx.program    program template
 * @param {number} ctx.weekIndex  0-based; >= accumulationWeeks means deload
 * @param {object|null} ctx.previous  last logged entry for this exercise, or null
 * @param {number|null} ctx.seedE1rm  known e1RM from an earlier block, if any
 * @param {string} ctx.unit       'kg' | 'lb'
 * @returns {object} prescription
 */
export function prescribe(ctx) {
  const {
    exercise, slot, program, weekIndex, previous = null, seedE1rm = null,
    unit = 'kg', mode: modeId = DEFAULT_MODE, history = [], formHistory = null,
  } = ctx;
  const mode = getMode(modeId);
  const repRange = biasedRepRange(slot?.reps ?? exercise?.reps ?? [8, 12], mode);
  const [minReps, maxReps] = repRange;
  const deload = isDeloadWeek(program, weekIndex);
  const targetRir = targetRirFor(program, weekIndex, exercise, modeId);
  const sets = deload ? Math.max(1, Math.ceil((slot?.sets ?? 3) / 2)) : (slot?.sets ?? 3);

  const base = {
    exerciseId: exercise.id, sets, repRange, targetRir, deload, mode: mode.id,
    tempo: mode.showTempo ? mode.tempo : null,
    restSec: slot?.restSec ?? defaultRest(exercise, repRange),
  };

  const ref = previous ? referenceSet(previous.sets) : null;

  // No usable history: seed from a known e1RM if we have one, otherwise ask.
  if (!ref) {
    if (seedE1rm > 0) {
      const inc = incrementFor(exercise, unit);
      const weight = roundToIncrement(loadForTarget(seedE1rm, minReps, targetRir), inc);
      return {
        ...base, weight, targetReps: minReps, tag: 'establish', confidence: 'medium',
        previous: null, e1rmBefore: seedE1rm,
        rationale: `Seeded from your ${Math.round(seedE1rm)}${unit} estimated max on this lift. ` +
          `Treat week one as calibration - log the honest RIR and the numbers self-correct.`,
      };
    }
    return {
      ...base, weight: null, targetReps: minReps, tag: 'establish', confidence: 'low',
      previous: null, e1rmBefore: 0,
      rationale: `First exposure. Warm up, then pick a load you could take for about ` +
        `${minReps} reps with ${targetRir} left in reserve. Log what you actually did - ` +
        `every later session is calculated from it.`,
    };
  }

  const prevWeight = Number(ref.weight) || 0;
  const prevReps = Number(ref.reps) || 0;
  const prevRir = Number.isFinite(Number(ref.rir)) ? Number(ref.rir) : targetRir;
  const e1rmBefore = e1rm(prevWeight, prevReps, prevRir);
  const inc = incrementFor(exercise, unit);
  const step = loadStep(exercise, prevWeight, unit);
  const prev = { weight: prevWeight, reps: prevReps, rir: prevRir };
  const common = { ...base, previous: prev, e1rmBefore, confidence: confidenceFor(prevReps, prevRir) };

  if (deload) {
    return {
      ...common,
      weight: roundToIncrement(prevWeight * 0.88, inc),
      targetReps: minReps,
      tag: 'deload',
      rationale: `Deload: about 12% off the bar and half the sets, stopping at ${targetRir} RIR. ` +
        `The work is done - this week is where it turns into muscle. Do not chase the numbers.`,
    };
  }

  // Load is too heavy: you could not reach the bottom of the window at planned effort.
  if (prevReps < minReps && prevRir <= targetRir) {
    return {
      ...common,
      weight: Math.max(inc, roundToIncrement(prevWeight * 0.94, inc)),
      targetReps: minReps,
      tag: 'back-off',
      rationale: `${prevReps} reps last week fell short of the ${minReps}-rep floor at ` +
        `${prevRir} RIR. Backing the load off ~6% to get you inside the window - the ` +
        `range is where the growth is, not the number on the bar.`,
    };
  }

  // Technique is the gate on progression, where the mode says so - and it gates
  // reps as well as load. Asking for one more rep on a movement someone is
  // already fighting is still asking for more. This sits after the back-off
  // check above, because reducing the load is always allowed.
  if (mode.holdOnPoorForm && formHistory?.lastFormPoor) {
    return {
      ...common,
      weight: prevWeight,
      targetReps: Math.min(Math.max(prevReps, minReps), maxReps),
      tag: 'hold-form',
      rationale: `You reported that technique broke down last time. Nothing goes up ` +
        `until you can own this weight - adding to a movement you are already fighting ` +
        `is how the next few months get lost to a niggle. Same weight, same reps, ` +
        `make it look easy.`,
    };
  }

  // Topped out the rep window. There is nowhere left for reps to go, so the
  // load has to move - the only question is by how much. Note this is checked
  // against reps alone: the planned effort tightens week to week, and a lifter
  // who filled the window last week must not be told to "add a rep" simply
  // because this week's RIR target dropped underneath them.
  if (prevReps >= maxReps) {
    // Beginners add load only after proving the current one twice. It is the
    // cheapest guard against outrunning your own technique.
    const needed = mode.consecutiveSuccessesForLoad ?? 1;
    if (needed > 1 && (formHistory?.consecutiveTopOfRange ?? 1) < needed) {
      return {
        ...common,
        weight: prevWeight,
        targetReps: maxReps,
        tag: 'consolidate',
        rationale: `You hit the top of the range - do it once more at this weight before ` +
          `it goes up. Repeating a session you can already do well is how the movement ` +
          `becomes automatic, and it costs you a week to save a month.`,
      };
    }
    const generous = prevRir >= targetRir + 2;
    const raw = generous ? Math.max(step, roundToIncrement(prevWeight * 0.05, inc)) : step;
    const jump = Math.max(inc, roundToIncrement(raw * (mode.loadStepFactor ?? 1), inc));
    return {
      ...common,
      weight: roundToIncrement(prevWeight + jump, inc),
      targetReps: minReps,
      tag: 'load-up',
      rationale: `${prevReps} reps at ${prevRir} RIR filled the ${minReps}-${maxReps} window` +
        (generous ? ` with plenty left over` : '') +
        `. Load goes up ${fmt(jump)}${unit} and reps reset to ${minReps} - that is double ` +
        `progression doing its job.`,
    };
  }

  // Badly under-loaded: correct in one jump instead of creeping for a month.
  if (prevRir >= targetRir + 2) {
    const wanted = loadForTarget(e1rmBefore, prevReps, targetRir);
    const capped = Math.min(wanted, prevWeight * 1.08);
    const weight = Math.max(roundToIncrement(capped, inc), prevWeight + inc);
    return {
      ...common,
      weight,
      targetReps: prevReps,
      tag: 'load-up',
      rationale: `You left ${prevRir} in reserve against a target of ${targetRir} - that set ` +
        `was not a stimulus. Jumping to ${fmt(weight)}${unit}, the load your own numbers say ` +
        `should put ${prevReps} reps at ${targetRir} RIR.`,
    };
  }

  // Already training harder than the plan asks: consolidate, do not pile on.
  if (prevRir < targetRir) {
    return {
      ...common,
      weight: prevWeight,
      targetReps: Math.min(Math.max(prevReps, minReps), maxReps),
      tag: 'hold',
      rationale: `You were at ${prevRir} RIR when the plan called for ${targetRir} - already ` +
        `ahead of the effort curve. Same load, same reps; let the block's rising effort ` +
        `target catch up rather than adding fatigue you have not earned.`,
    };
  }

  // On plan and inside the window: take one more rep.
  const targetReps = Math.min(prevReps + 1, maxReps);
  return {
    ...common,
    weight: prevWeight,
    targetReps,
    tag: 'rep-up',
    rationale: `On target last week at ${prevReps} reps, ${prevRir} RIR. Same load, ` +
      `${targetReps} reps this time. Reps first, load only once the window is full.`,
  };
}

function fmt(n) {
  return Math.round(n * 100) / 100;
}

/** Rest defaults when a slot does not override them. */
export function defaultRest(exercise, repRange = [8, 12]) {
  if (exercise?.type === 'compound') return repRange[1] <= 6 ? 240 : 180;
  return 90;
}

/**
 * Session feedback -> how many sets this muscle gets next week.
 *
 * The inputs are the three things that actually tell you whether the last dose
 * was too small, right, or too big:
 *   soreness  0 none · 1 mild · 2 sore into the next session · 3 still sore
 *   pump      0 none · 1 slight · 2 good · 3 exceptional
 *   joint     0 fine · 1 niggle · 2 painful · 3 sharp / stop
 *
 * Joint pain overrides everything. It is the one signal that never means
 * "push harder next week".
 */
export function setChangeFromFeedback(fb = {}) {
  const soreness = clamp(fb.soreness, 0, 3);
  const pump = clamp(fb.pump, 0, 3);
  const joint = clamp(fb.joint, 0, 3);

  if (joint >= 3) {
    return { delta: -2, reason: 'Sharp joint pain - volume comes down and the movement should be swapped.' };
  }
  if (joint === 2) {
    return { delta: -1, reason: 'Painful joints - one set off and check technique before adding anything back.' };
  }
  if (soreness >= 3) {
    return { delta: -1, reason: 'Still sore at the next session - you are past what you can recover from.' };
  }
  if (soreness === 2) {
    return { delta: 0, reason: 'Sore into the session - hold volume here, this dose is working.' };
  }
  if (soreness <= 0 && pump <= 1) {
    return { delta: 2, reason: 'No soreness and little pump - the dose was too small to register.' };
  }
  return { delta: 1, reason: 'Recovered well with a real pump - the standard weekly step up.' };
}

/**
 * A session-level modifier on next week's volume, on top of the per-muscle
 * answers.
 *
 * The per-muscle questions catch a muscle that has not recovered. This catches
 * the case where *you* have not recovered: a brutal session you faded badly in,
 * or a run of feeling weaker than last time, means the whole week steps back
 * rather than one muscle. It applies to every muscle trained that week, and is
 * still clamped by MRV and by the floor that never strips a slot out of
 * existence.
 *
 *   effort    0 easy · 1 solid · 2 hard · 3 brutal
 *   stamina   0 did not fade · 1 faded a little · 2 faded a lot
 *   strength  0 weaker than last time · 1 same · 2 stronger
 */
export function sessionVolumeModifier(card = {}) {
  // Absent is not zero. Skipping the cards must never be read as "the session
  // was easy and I never faded" - unanswered means no signal, and no signal
  // means no change.
  const answered = card.effort != null || card.stamina != null || card.strength != null;
  if (!answered) return { delta: 0, reason: '' };

  const effort = card.effort == null ? 1 : clamp(card.effort, 0, 3);
  const stamina = card.stamina == null ? 0 : clamp(card.stamina, 0, 3);
  const strength = card.strength == null ? 1 : clamp(card.strength, 0, 2);

  // The "easy" bonus needs both questions actually answered - inferring a
  // never-faded session from a single tap is how volume creeps up on someone.
  if (card.effort != null && card.stamina != null && effort <= 0 && stamina <= 0) {
    return { delta: 1, reason: 'The session was easy and you never faded - there is room for more work.' };
  }
  if (effort >= 3 && stamina >= 2) {
    return { delta: -1, reason: 'A brutal session you faded badly in - the whole week backs off a set.' };
  }
  if (strength === 0 && (effort >= 2 || stamina >= 1)) {
    return { delta: -1, reason: 'You felt weaker and the session was a grind - fatigue has caught up, so volume steps back.' };
  }
  return { delta: 0, reason: '' };
}

function clamp(v, lo, hi) {
  const n = Number(v);
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

/** Week-over-week change in estimated 1RM, as a signed percentage. */
export function strengthTrend(entries = []) {
  const points = entries
    .map((e) => ({ date: e.date, best: bestSet(e.sets) }))
    .filter((p) => p.best)
    .map((p) => ({ date: p.date, e1rm: e1rm(p.best.weight, p.best.reps, p.best.rir ?? 0) }));
  if (points.length < 2) return { points, changePct: 0, direction: 'flat' };
  const first = points[0].e1rm;
  const last = points[points.length - 1].e1rm;
  const changePct = first > 0 ? ((last - first) / first) * 100 : 0;
  const direction = changePct > 1.5 ? 'up' : changePct < -1.5 ? 'down' : 'flat';
  return { points, changePct, direction };
}

export { repsToFailure };
