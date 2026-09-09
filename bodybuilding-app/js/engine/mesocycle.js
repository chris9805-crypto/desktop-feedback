/**
 * Mesocycle construction: turning a template into the specific week in front
 * of you.
 *
 * Volume is progressed at the *muscle* level rather than per exercise. Each
 * week a muscle earns a set change from the feedback you gave it last week
 * (see setChangeFromFeedback); those sets are then handed out to the slots
 * that actually train it, and the whole thing is clamped so planned weekly
 * volume never crosses that muscle's maximum recoverable volume.
 *
 * The result: volume climbs where you are recovering and stalls or retreats
 * where you are not, without you having to redesign the program mid-block.
 */

import { getProgram } from '../data/programs.js';
import { getExercise } from '../data/exercises.js';
import { MUSCLES } from '../data/muscles.js';
import { setChangeFromFeedback, isDeloadWeek, defaultRest } from './progression.js';
import { plannedSetsByMuscle } from './volume.js';
import { uid } from '../util/id.js';
import { adaptDays, DEFAULT_PROFILE } from './equipment.js';

export const MAX_ADDED_SETS_PER_SLOT = 2;
/**
 * Heavy anchor lifts are capped far lower. Extra weekly volume belongs on
 * accessories: a seventh set of squats costs more recovery and more session
 * time than three more sets of leg extensions, and buys less.
 */
export const MAX_ADDED_SETS_PER_ANCHOR = 1;

export function maxAddedSetsFor(slot) {
  return slot.role === 'anchor' ? MAX_ADDED_SETS_PER_ANCHOR : MAX_ADDED_SETS_PER_SLOT;
}
/** With no feedback logged we still progress, just conservatively. */
export const DEFAULT_WEEKLY_SET_DELTA = 1;

export function slotKey(dayId, exerciseId) {
  return `${dayId}:${exerciseId}`;
}

export function totalWeeks(program) {
  return (program?.accumulationWeeks ?? 4) + 1; // + deload
}

export function newMesocycle(program, { name, startedAt = Date.now(), id, equipment = DEFAULT_PROFILE } = {}) {
  return {
    id: id ?? uid('meso'),
    programId: program.id,
    equipment,
    name: name ?? `${program.name} · ${new Date(startedAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`,
    startedAt,
    currentWeek: 0,
    completed: {},     // `${week}:${dayId}` -> sessionId
    status: 'active',
  };
}

/** Merge the per-muscle feedback recorded across one week of sessions. */
export function feedbackForWeek(sessions, mesoId, week) {
  const merged = {};
  for (const s of sessions) {
    if (s.mesoId !== mesoId || s.week !== week) continue;
    for (const [muscle, fb] of Object.entries(s.feedback ?? {})) {
      const cur = merged[muscle];
      // Worst report wins - the limiting signal is the one that matters.
      merged[muscle] = cur
        ? {
            soreness: Math.max(cur.soreness ?? 0, fb.soreness ?? 0),
            joint: Math.max(cur.joint ?? 0, fb.joint ?? 0),
            pump: Math.min(cur.pump ?? 3, fb.pump ?? 3),
          }
        : { ...fb };
    }
  }
  return merged;
}

/** Slots that train a muscle as a primary mover and are allowed to grow. */
function growableSlots(program, muscleId) {
  const out = [];
  for (const day of program.days) {
    for (const s of day.slots) {
      if (!s.growSets) continue;
      const ex = getExercise(s.exerciseId);
      if (ex?.primary.includes(muscleId)) out.push({ dayId: day.id, slot: s });
    }
  }
  return out;
}

/**
 * Extra sets per slot for a given accumulation week, accumulated from every
 * previous week's feedback and capped at each muscle's MRV.
 *
 * @returns {{extras: Object<string, number>, notes: Object<string, string>}}
 */
export function computeExtras(program, sessions, mesoId, weekIndex) {
  const extras = {};
  const notes = {};
  const accumulation = program.accumulationWeeks ?? 4;
  const lastWeek = Math.min(weekIndex, accumulation - 1);

  for (let w = 1; w <= lastWeek; w++) {
    const feedback = feedbackForWeek(sessions, mesoId, w - 1);
    for (const muscleId of Object.keys(MUSCLES)) {
      const slots = growableSlots(program, muscleId);
      if (!slots.length) continue;

      const fb = feedback[muscleId];
      const change = fb
        ? setChangeFromFeedback(fb)
        : { delta: DEFAULT_WEEKLY_SET_DELTA, reason: 'No feedback logged - default weekly step up.' };
      if (change.delta !== 0) notes[muscleId] = change.reason;

      applyDelta(program, extras, muscleId, slots, change.delta);
    }
    // Clamp only once every muscle has had its say. Sets added for one muscle
    // land as indirect volume on others, so clamping per muscle as we go lets
    // a later addition push an already-clamped muscle back over its ceiling.
    clampAllToMrv(program, extras, notes);
  }
  return { extras, notes };
}

/**
 * Move a muscle's weekly volume by `delta` sets - and stop as soon as it has
 * actually moved that far.
 *
 * This is deliberately target-seeking rather than "add N sets". A set of rows
 * is a set for the lats *and* the upper back *and* half a set for the biceps.
 * Handing each of those muscles its own +1 independently would add three sets
 * to the week where one did the job, and by week four the session has quietly
 * grown by twenty sets. Checking the resulting volume after every single set
 * is what keeps the block honest.
 */
function applyDelta(program, extras, muscleId, slots, delta) {
  if (delta === 0) return;
  const measure = () => plannedSetsByMuscle(resolveWeek(program, extras).days)[muscleId] ?? 0;
  const target = measure() + delta;
  const dir = Math.sign(delta);

  for (let guard = 0; guard < 40; guard++) {
    const current = measure();
    if (dir > 0 ? current >= target : current <= target) return;

    // Spread the change over the slots carrying the least of it so far, so no
    // single exercise absorbs a whole block's worth of added volume.
    const candidates = slots
      .map(({ dayId, slot }) => ({ slot, key: slotKey(dayId, slot.exerciseId), added: extras[slotKey(dayId, slot.exerciseId)] ?? 0 }))
      .filter(({ slot, added }) => {
        const next = added + dir;
        if (next > maxAddedSetsFor(slot)) return false;
        return slot.sets + next >= 1; // never strip a slot out of existence
      })
      .sort((a, b) => (dir > 0 ? a.added - b.added : b.added - a.added));

    if (!candidates.length) return;
    extras[candidates[0].key] = candidates[0].added + dir;
  }
}

/**
 * Walk every muscle down to its MRV, repeating until the whole week is under
 * its ceilings. Removing a set for one muscle also removes indirect volume
 * from others, so a single pass is not enough to reach a fixed point.
 */
function clampAllToMrv(program, extras, notes) {
  let guard = 0;
  while (guard++ < 200) {
    const planned = plannedSetsByMuscle(resolveWeek(program, extras).days);
    let worst = null;
    for (const [muscleId, lm] of Object.entries(MUSCLES)) {
      const over = (planned[muscleId] ?? 0) - lm.mrv;
      if (over > 0 && (!worst || over > worst.over)) worst = { muscleId, over, lm };
    }
    if (!worst) return;
    if (!removeOneSet(program, extras, worst.muscleId)) {
      // Nothing left that we are allowed to trim - the template's own base
      // volume is at the ceiling, which is a program design decision, not a
      // runaway. Record it and stop rather than spinning.
      notes[worst.muscleId] = `Base program volume already sits at the ${worst.lm.mrv}-set ceiling.`;
      return;
    }
    notes[worst.muscleId] = `Held at ${worst.lm.mrv} sets - that is the recoverable ceiling for this muscle.`;
  }
}

/** Take one added set back off whichever slot is carrying the most. */
function removeOneSet(program, extras, muscleId) {
  const candidates = growableSlots(program, muscleId)
    .map(({ dayId, slot }) => {
      const key = slotKey(dayId, slot.exerciseId);
      return { key, added: extras[key] ?? 0 };
    })
    .filter((c) => c.added > 0)
    .sort((a, b) => b.added - a.added);
  if (!candidates.length) return false;
  extras[candidates[0].key] -= 1;
  return true;
}

/** Resolve a template into concrete days for a week, applying extra sets. */
export function resolveWeek(program, extras = {}) {
  return {
    days: program.days.map((day) => ({
      id: day.id,
      name: day.name,
      focus: day.focus,
      slots: day.slots.map((s) => ({
        ...s,
        sets: Math.max(1, s.sets + (extras[slotKey(day.id, s.exerciseId)] ?? 0)),
        addedSets: extras[slotKey(day.id, s.exerciseId)] ?? 0,
      })),
    })),
  };
}

/** The full plan for one week of a live mesocycle. */
export function weekPlan(meso, sessions, weekIndex) {
  const program = getProgram(meso.programId);
  if (!program) return null;
  const deload = isDeloadWeek(program, weekIndex);
  const { extras, notes } = deload
    ? { extras: {}, notes: {} }
    : computeExtras(program, sessions, meso.id, weekIndex);
  const resolved = resolveWeek(program, extras);
  // Equipment substitution happens last, so volume progression and the MRV
  // clamp reason about the program as designed, and only the movement someone
  // physically performs changes.
  const days = adaptDays(resolved.days, meso.equipment ?? DEFAULT_PROFILE);
  return {
    weekIndex,
    deload,
    label: deload ? 'Deload' : `Week ${weekIndex + 1}`,
    targetRir: deload ? 4 : program.rirByWeek?.[weekIndex] ?? 2,
    program,
    notes,
    days: days.map((d) => ({
      ...d,
      done: Boolean(meso.completed?.[`${weekIndex}:${d.id}`]),
      sessionId: meso.completed?.[`${weekIndex}:${d.id}`] ?? null,
    })),
  };
}

/** Next unfinished day, rolling into the following week when one is complete. */
export function nextSession(meso, sessions) {
  const program = getProgram(meso.programId);
  if (!program) return null;
  const weeks = totalWeeks(program);
  for (let w = meso.currentWeek ?? 0; w < weeks; w++) {
    const plan = weekPlan(meso, sessions, w);
    const day = plan.days.find((d) => !d.done);
    if (day) return { weekIndex: w, plan, day };
  }
  return null; // block complete
}

export function mesoProgress(meso, sessions) {
  const program = getProgram(meso.programId);
  if (!program) return { done: 0, total: 0, pct: 0 };
  const total = totalWeeks(program) * program.days.length;
  const done = Object.keys(meso.completed ?? {}).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

/** Muscles worth asking about after a session: those that took real work. */
export function feedbackTargets(day, threshold = 3) {
  const counts = {};
  for (const s of day.slots ?? []) {
    const ex = getExercise(s.exerciseId);
    if (!ex) continue;
    for (const m of ex.primary) counts[m] = (counts[m] ?? 0) + (s.sets ?? 0);
  }
  return Object.entries(counts)
    .filter(([, n]) => n >= threshold)
    .sort((a, b) => b[1] - a[1])
    .map(([m]) => m);
}

/* ------------------------------------------------------------------ timing */

/** Seconds a working set takes to perform, before rest. */
export const WORK_SET_SECONDS = 45;
/** Warm-up, plate changes, walking between machines. */
export const SESSION_OVERHEAD_MINUTES = 8;

/**
 * How long a session actually takes, from its own rest periods.
 *
 * Superset slots count half their rest: the point of pairing two movements is
 * that one muscle recovers while the other works. This is what makes the
 * time cost of a program visible before you commit five weeks to it.
 */
export function estimateSessionMinutes(day) {
  let seconds = 0;
  for (const s of day.slots ?? []) {
    const exercise = getExercise(s.exerciseId);
    if (!exercise) continue;
    const repRange = s.reps ?? exercise.reps;
    const rest = s.restSec ?? defaultRest(exercise, repRange);
    const effectiveRest = s.superset ? rest / 2 : rest;
    seconds += (s.sets ?? 0) * (WORK_SET_SECONDS + effectiveRest);
  }
  return Math.round(seconds / 60) + SESSION_OVERHEAD_MINUTES;
}

/**
 * Time cost of a whole program: per session and per week, at the start of the
 * block and at its peak. Weekly total is the number that actually decides
 * whether a program fits a life.
 */
export function programTimeProfile(program) {
  const meso = newMesocycle(program);
  const first = weekPlan(meso, [], 0).days.map(estimateSessionMinutes);
  const peak = weekPlan(meso, [], (program.accumulationWeeks ?? 4) - 1).days.map(estimateSessionMinutes);
  const sum = (xs) => xs.reduce((a, b) => a + b, 0);
  return {
    sessionMin: Math.min(...first),
    sessionMax: Math.max(...peak),
    weeklyStart: sum(first),
    weeklyPeak: sum(peak),
  };
}
