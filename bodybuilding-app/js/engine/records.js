/**
 * The record book.
 *
 * "You got stronger" is the reason people keep a log, and until now this app
 * only noticed one kind of stronger: a higher estimated max. That misses most
 * of what actually happens in a gym. Getting 8 reps with a weight you last got
 * 6 with is a record. Putting a plate on the bar for a single is a record. Both
 * are the moment worth showing, and both were invisible.
 *
 * Three kinds are tracked per lift:
 *
 *   heaviest  the most weight moved for at least one rep
 *   reps      the most reps done at a given weight *or heavier*
 *   e1rm      the best estimated max, which folds load, reps and effort together
 *
 * The rep records are held as a frontier rather than a list: a set is only kept
 * if nothing already in the book beat it on both load and reps. That is exactly
 * the set of records a lifter would recognise, and it stays small no matter how
 * long the log gets.
 *
 * ONE DELIBERATE OMISSION: the first time you do a lift, nothing is a record.
 * Every number would qualify, which makes the word worthless by the end of the
 * first session. A record needs something to beat.
 */

import { e1rm } from './onerm.js';
import { getExercise } from '../data/exercises.js';

/** Enough above the old mark to be a real difference rather than rounding. */
const MARGIN = 1.005;

/**
 * Working sets only. Warm-ups are not records, and a set with no numbers on it
 * cannot be compared to anything.
 */
export function isWorkingSet(set) {
  return Boolean(set)
    && set.warmup !== true
    && Number.isFinite(set.weight) && set.weight >= 0
    && Number.isFinite(set.reps) && set.reps > 0;
}

function emptyRecord() {
  return { frontier: [], e1rm: null, volume: null, sets: 0 };
}

/**
 * Add a set to one lift's record, returning a new record. Points that the new
 * set beats on both load and reps drop out - they are no longer anybody's best
 * anything.
 */
export function applySet(record, set, date = null) {
  if (!isWorkingSet(set)) return record ?? emptyRecord();
  const base = record ?? emptyRecord();
  const point = { weight: set.weight, reps: set.reps, date };

  const dominated = base.frontier.some((p) => p.weight >= point.weight && p.reps >= point.reps);
  const frontier = dominated
    ? base.frontier
    : [...base.frontier.filter((p) => !(point.weight >= p.weight && point.reps >= p.reps)), point];

  const value = e1rm(set.weight, set.reps, set.rir ?? 0);
  const best = base.e1rm && base.e1rm.value >= value
    ? base.e1rm
    : { value, weight: set.weight, reps: set.reps, rir: set.rir ?? null, date };

  return { ...base, frontier, e1rm: value > 0 ? best : base.e1rm, sets: base.sets + 1 };
}

/** The most reps ever done at this weight or anything heavier. */
export function bestRepsAt(record, weight) {
  const eligible = (record?.frontier ?? []).filter((p) => p.weight >= weight);
  if (!eligible.length) return null;
  return eligible.reduce((best, p) => (p.reps > best.reps ? p : best));
}

/** The heaviest weight ever moved for a rep. */
export function heaviest(record) {
  const points = (record?.frontier ?? []).filter((p) => p.weight > 0);
  if (!points.length) return null;
  return points.reduce((best, p) => (p.weight > best.weight ? p : best));
}

/**
 * What this set just broke, if anything. Ordered strongest claim first, so a
 * caller showing one line shows the one worth reading.
 */
export function checkSet(record, set, { unit = 'kg' } = {}) {
  if (!isWorkingSet(set) || !record || record.sets === 0) return [];

  const hits = [];
  const top = heaviest(record);
  const repsMark = bestRepsAt(record, set.weight);
  const priorE1rm = record.e1rm?.value ?? 0;
  const value = e1rm(set.weight, set.reps, set.rir ?? 0);

  if (set.weight > 0 && top && set.weight > top.weight) {
    hits.push({
      type: 'heaviest',
      label: 'Heaviest ever',
      detail: `${fmt(set.weight, unit)} on the bar — most you have lifted on this`,
      previous: top.weight,
    });
  }

  if (repsMark && set.reps > repsMark.reps) {
    hits.push({
      type: 'reps',
      label: 'Rep record',
      detail: set.weight > 0
        ? `${set.reps} at ${fmt(set.weight, unit)} — best was ${repsMark.reps}`
        : `${set.reps} reps — best was ${repsMark.reps}`,
      previous: repsMark.reps,
    });
  }

  if (value > 0 && priorE1rm > 0 && value > priorE1rm * MARGIN) {
    hits.push({
      type: 'e1rm',
      label: 'Strongest set yet',
      detail: `estimated max ${fmt(Math.round(value), unit)}, up from ${fmt(Math.round(priorE1rm), unit)}`,
      previous: priorE1rm,
    });
  }

  return hits;
}

function fmt(value, unit) {
  const rounded = Math.abs(value - Math.round(value)) < 0.01 ? Math.round(value) : Math.round(value * 100) / 100;
  return `${rounded}${unit}`;
}

/** Every lift's record, built from finished sessions oldest first. */
export function recordBook(sessions = []) {
  const book = new Map();
  for (const session of [...sessions].sort((a, b) => a.date - b.date)) {
    for (const entry of session.entries ?? []) {
      let record = book.get(entry.exerciseId) ?? emptyRecord();
      let sessionVolume = 0;
      for (const set of entry.sets ?? []) {
        record = applySet(record, set, session.date);
        if (isWorkingSet(set)) sessionVolume += set.weight * set.reps;
      }
      if (sessionVolume > (record.volume?.value ?? 0)) {
        record = { ...record, volume: { value: sessionVolume, date: session.date } };
      }
      book.set(entry.exerciseId, record);
    }
  }
  return book;
}

/**
 * What a whole session broke, for the screen shown after it. One line per lift
 * carrying its strongest claim - a list of four records on one exercise reads
 * as padding, not achievement.
 */
export function sessionRecords(session, book, { unit = 'kg' } = {}) {
  const rows = [];
  for (const entry of session.entries ?? []) {
    let record = book.get(entry.exerciseId) ?? emptyRecord();
    if (record.sets === 0) continue;           // first time on this lift

    let best = null;
    let volume = 0;
    for (const set of entry.sets ?? []) {
      const hit = checkSet(record, set, { unit })[0];
      if (hit && (!best || rank(hit.type) < rank(best.type))) best = hit;
      record = applySet(record, set, session.date);
      if (isWorkingSet(set)) volume += set.weight * set.reps;
    }

    // A volume record only gets a row when nothing louder happened on the lift.
    if (!best && volume > 0 && volume > (book.get(entry.exerciseId)?.volume?.value ?? 0)) {
      best = { type: 'volume', label: 'Most work yet', detail: `${Math.round(volume)}${unit} on this lift` };
    }
    if (best) {
      rows.push({
        exerciseId: entry.exerciseId,
        name: getExercise(entry.exerciseId)?.name ?? entry.exerciseId,
        ...best,
      });
    }
  }
  return rows.sort((a, b) => rank(a.type) - rank(b.type));
}

const ORDER = { heaviest: 0, reps: 1, e1rm: 2, volume: 3 };
function rank(type) {
  return ORDER[type] ?? 9;
}
