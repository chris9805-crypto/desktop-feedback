/**
 * Application state and persistence.
 *
 * Everything lives in one plain object, saved to localStorage on every change.
 * There is no account and no server: your training log is yours, on your
 * machine, and the Settings screen can hand you the whole thing as JSON.
 *
 * All weights are stored in the unit currently selected in Settings. Changing
 * that unit converts the entire history at once, so the log is never a mix.
 */

import { getProgram } from './data/programs.js';
import { getExercise } from './data/exercises.js';
import { newMesocycle, weekPlan, nextSession, slotKey } from './engine/mesocycle.js';
import { prescribe, bestSet } from './engine/progression.js';
import { e1rm } from './engine/onerm.js';
import { uid } from './util/id.js';
import { getMode, DEFAULT_MODE } from './data/modes.js';
import { analyse } from './engine/imbalance.js';

const STORAGE_KEY = 'ironblock.state.v1';
const SCHEMA_VERSION = 1;

export const KG_PER_LB = 0.45359237;

function defaultState() {
  return {
    version: SCHEMA_VERSION,
    settings: {
      unit: 'kg',
      autoStartRest: true,
      restBeep: true,
      theme: 'system',
      bodyweight: null,
      // `mode` is the training mode - it changes the programming, not just the
      // wording. `plainLanguage` is the wording, defaulted from the mode but
      // separately settable, so an advanced lifter can keep the explanations
      // and a beginner can turn them off.
      mode: null,
      plainLanguage: null,
      equipment: 'full',
      onboarded: false,
    },
    mesocycles: [],
    activeMesoId: null,
    sessions: [],
    active: null,
  };
}

/** localStorage can throw outright (private mode, blocked site data). */
function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return migrate(parsed);
  } catch {
    return null;
  }
}

function migrate(state) {
  const base = defaultState();
  const merged = {
    ...base,
    ...state,
    settings: { ...base.settings, ...(state.settings ?? {}) },
    version: SCHEMA_VERSION,
  };

  // `experience` (new / some / experienced) predates training modes and only
  // ever changed the wording. Carry those users onto the equivalent mode
  // rather than dropping them back to the default.
  const legacy = { new: 'beginner', some: 'intermediate', experienced: 'advanced' };
  if (!merged.settings.mode && merged.settings.experience) {
    merged.settings.mode = legacy[merged.settings.experience] ?? DEFAULT_MODE;
    merged.settings.plainLanguage = merged.settings.experience === 'new';
  }
  delete merged.settings.experience;
  return merged;
}

class Store {
  constructor() {
    this.state = readStored() ?? defaultState();
    this.listeners = new Set();
    this.persistFailed = false;
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    for (const fn of this.listeners) fn(this.state);
  }

  update(mutator) {
    const next = mutator(this.state);
    if (next) this.state = next;
    this.persist();
    this.emit();
    return this.state;
  }

  persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.persistFailed = false;
    } catch {
      this.persistFailed = true;
    }
  }

  /* ------------------------------------------------------------- settings */

  setSetting(key, value) {
    if (key === 'unit') return this.setUnit(value);
    return this.update((s) => ({ ...s, settings: { ...s.settings, [key]: value } }));
  }

  /** Switching units rewrites every stored weight so the log stays coherent. */
  setUnit(unit) {
    return this.update((s) => {
      if (s.settings.unit === unit) return s;
      const factor = unit === 'lb' ? 1 / KG_PER_LB : KG_PER_LB;
      const convertSets = (sets = []) => sets.map((set) => ({
        ...set,
        weight: set.weight == null ? set.weight : round(set.weight * factor, 2),
      }));
      const convertEntries = (entries = []) => entries.map((e) => ({ ...e, sets: convertSets(e.sets) }));
      return {
        ...s,
        settings: {
          ...s.settings,
          unit,
          bodyweight: s.settings.bodyweight == null ? null : round(s.settings.bodyweight * factor, 1),
        },
        sessions: s.sessions.map((sess) => ({ ...sess, entries: convertEntries(sess.entries) })),
        active: s.active ? { ...s.active, entries: convertEntries(s.active.entries) } : null,
      };
    });
  }

  /** The active training mode, falling back to the sensible middle. */
  mode() {
    return getMode(this.state.settings.mode ?? DEFAULT_MODE);
  }

  /** Whether to use plain English. Defaults from the mode; separately settable. */
  plainLanguage() {
    const explicit = this.state.settings.plainLanguage;
    return explicit == null ? this.mode().plainLanguage : explicit;
  }

  setMode(modeId) {
    const mode = getMode(modeId);
    return this.update((s) => ({
      ...s,
      settings: {
        ...s.settings,
        mode: mode.id,
        // Only follow the mode's default wording if the user has not chosen.
        plainLanguage: s.settings.plainLanguage == null ? null : s.settings.plainLanguage,
      },
    }));
  }

  /**
   * Weak points from the whole log, cached per session count so the analysis
   * does not re-run on every render of every screen.
   */
  weakPoints() {
    if (!this.mode().showImbalances) return { findings: [], lagging: [] };
    const key = `${this.state.sessions.length}:${this.state.sessions.at(-1)?.id ?? ''}`;
    if (this._weakPointKey !== key) {
      this._weakPointKey = key;
      this._weakPoints = analyse(this.state.sessions);
    }
    return this._weakPoints;
  }

  /* ---------------------------------------------------------- mesocycles */

  startMesocycle(programId, name, equipment) {
    const program = getProgram(programId);
    if (!program) return null;
    const meso = newMesocycle(program, {
      name,
      equipment: equipment ?? this.state.settings.equipment ?? 'full',
      mode: this.state.settings.mode ?? DEFAULT_MODE,
    });
    this.update((s) => ({
      ...s,
      mesocycles: [...s.mesocycles.map((m) => (m.status === 'active' ? { ...m, status: 'archived' } : m)), meso],
      activeMesoId: meso.id,
    }));
    return meso;
  }

  activeMeso() {
    return this.state.mesocycles.find((m) => m.id === this.state.activeMesoId) ?? null;
  }

  mesoSessions(mesoId = this.state.activeMesoId) {
    return this.state.sessions.filter((s) => s.mesoId === mesoId);
  }

  deleteMesocycle(mesoId) {
    return this.update((s) => ({
      ...s,
      mesocycles: s.mesocycles.filter((m) => m.id !== mesoId),
      sessions: s.sessions.filter((x) => x.mesoId !== mesoId),
      activeMesoId: s.activeMesoId === mesoId ? null : s.activeMesoId,
      active: s.active?.mesoId === mesoId ? null : s.active,
    }));
  }

  /* ------------------------------------------------------------- training */

  /**
   * Most recent logged entry for an exercise. Prefers the same slot in the
   * same block - that is a like-for-like comparison - and falls back to the
   * most recent time you did the movement at all.
   */
  lastEntryFor(exerciseId, { mesoId, dayId } = {}) {
    const sessions = [...this.state.sessions].sort((a, b) => b.date - a.date);
    const match = (s, strict) =>
      (!strict || (s.mesoId === mesoId && s.dayId === dayId)) &&
      s.entries?.some((e) => e.exerciseId === exerciseId && e.sets?.some((x) => x.done && !x.warmup));
    const found = sessions.find((s) => match(s, true)) ?? sessions.find((s) => match(s, false));
    if (!found) return null;
    return { ...found.entries.find((e) => e.exerciseId === exerciseId), date: found.date, week: found.week };
  }

  /**
   * The two things a mode may gate progression on, read back out of the log.
   *
   *   lastFormPoor            technique was reported as breaking down last time
   *   consecutiveTopOfRange   how many sessions in a row filled the rep window
   *
   * Beginner mode needs the second to require two clean sessions before load
   * moves; beginner and intermediate both use the first to refuse to add
   * weight to a movement someone is already fighting.
   */
  formHistoryFor(exerciseId, repRange) {
    const relevant = this.state.sessions
      .filter((s) => s.entries?.some((e) => e.exerciseId === exerciseId))
      .sort((a, b) => b.date - a.date)
      .map((s) => s.entries.find((e) => e.exerciseId === exerciseId));
    if (!relevant.length) return { lastFormPoor: false, consecutiveTopOfRange: 0 };

    const top = repRange?.[1] ?? Infinity;
    let streak = 0;
    for (const entry of relevant) {
      const best = (entry.sets ?? []).filter((x) => x.done && !x.warmup);
      if (!best.length || !best.some((x) => Number(x.reps) >= top)) break;
      streak += 1;
    }
    return {
      lastFormPoor: (relevant[0].form ?? 0) >= 2,
      consecutiveTopOfRange: streak,
    };
  }

  /** Best estimated 1RM ever recorded for a movement, for seeding a new block. */
  seedE1rmFor(exerciseId) {
    let best = 0;
    for (const session of this.state.sessions) {
      for (const entry of session.entries ?? []) {
        if (entry.exerciseId !== exerciseId) continue;
        const set = bestSet(entry.sets);
        if (set) best = Math.max(best, e1rm(set.weight, set.reps, set.rir ?? 0));
      }
    }
    return best || null;
  }

  /** Build the full prescription for one day without starting it. */
  buildSession(mesoId, weekIndex, dayId) {
    const meso = this.state.mesocycles.find((m) => m.id === mesoId);
    if (!meso) return null;
    const plan = weekPlan(meso, this.mesoSessions(mesoId), weekIndex, {
      lagging: this.weakPoints().lagging,
    });
    const day = plan?.days.find((d) => d.id === dayId);
    if (!day) return null;
    const unit = this.state.settings.unit;
    // The block carries the mode it was started in, so switching modes
    // mid-block does not silently rewrite the training you are part-way through.
    const mode = meso.mode ?? this.state.settings.mode ?? DEFAULT_MODE;
    return {
      mesoId, weekIndex, dayId,
      plan, day, mode,
      entries: day.slots.map((slot) => {
        const exercise = getExercise(slot.exerciseId);
        const previous = this.lastEntryFor(slot.exerciseId, { mesoId, dayId });
        return {
          exerciseId: slot.exerciseId,
          slot,
          prescription: prescribe({
            exercise, slot, program: plan.program, weekIndex, previous, mode,
            formHistory: this.formHistoryFor(slot.exerciseId, slot.reps ?? exercise.reps),
            seedE1rm: previous ? null : this.seedE1rmFor(slot.exerciseId),
            unit,
          }),
          previous,
        };
      }),
    };
  }

  startSession(mesoId, weekIndex, dayId) {
    const built = this.buildSession(mesoId, weekIndex, dayId);
    if (!built) return null;
    const active = {
      mesoId, week: weekIndex, dayId,
      mode: built.mode,
      programId: this.state.mesocycles.find((m) => m.id === mesoId)?.programId,
      startedAt: Date.now(),
      entries: built.entries.map((e) => ({
        exerciseId: e.exerciseId,
        prescription: e.prescription,
        note: '',
        form: null,        // 0 clean · 1 shaky · 2 broke down
        connection: null,  // 0 nothing · 1 some · 2 felt it working
        side: null,        // 'left' | 'right' | 'even' on unilateral work
        sets: Array.from({ length: e.prescription.sets }, () => ({
          weight: e.prescription.weight ?? null,
          reps: null,
          rir: null,
          done: false,
          warmup: false,
        })),
      })),
      feedback: {},
      session: {},
    };
    this.update((s) => ({ ...s, active }));
    return active;
  }

  updateActive(mutator) {
    return this.update((s) => (s.active ? { ...s, active: mutator(structuredClone(s.active)) } : s));
  }

  logSet(exerciseId, index, patch) {
    return this.updateActive((active) => {
      const entry = active.entries.find((e) => e.exerciseId === exerciseId);
      if (!entry || !entry.sets[index]) return active;
      entry.sets[index] = { ...entry.sets[index], ...patch };
      return active;
    });
  }

  addSet(exerciseId) {
    return this.updateActive((active) => {
      const entry = active.entries.find((e) => e.exerciseId === exerciseId);
      if (!entry) return active;
      const last = entry.sets[entry.sets.length - 1];
      entry.sets.push({ weight: last?.weight ?? null, reps: null, rir: null, done: false, warmup: false });
      return active;
    });
  }

  removeSet(exerciseId, index) {
    return this.updateActive((active) => {
      const entry = active.entries.find((e) => e.exerciseId === exerciseId);
      if (!entry || entry.sets.length <= 1) return active;
      entry.sets.splice(index, 1);
      return active;
    });
  }

  /** Swap a movement for one that trains the same thing. */
  swapExercise(fromId, toId) {
    return this.updateActive((active) => {
      const entry = active.entries.find((e) => e.exerciseId === fromId);
      const exercise = getExercise(toId);
      if (!entry || !exercise) return active;
      const meso = this.state.mesocycles.find((m) => m.id === active.mesoId);
      const plan = weekPlan(meso, this.mesoSessions(active.mesoId), active.week);
      const slot = { ...entry.prescription, exerciseId: toId, sets: entry.sets.length, reps: exercise.reps };
      entry.swappedFrom = entry.swappedFrom ?? fromId;
      entry.exerciseId = toId;
      entry.prescription = prescribe({
        exercise, slot, program: plan.program, weekIndex: active.week,
        previous: this.lastEntryFor(toId, { mesoId: active.mesoId, dayId: active.dayId }),
        seedE1rm: this.seedE1rmFor(toId),
        unit: this.state.settings.unit,
      });
      entry.sets = entry.sets.map((s) => ({ ...s, weight: entry.prescription.weight ?? s.weight }));
      return active;
    });
  }

  /** Per-exercise ratings gathered during the session (form, connection, side). */
  setEntryField(exerciseId, field, value) {
    return this.updateActive((active) => {
      const entry = active.entries.find((e) => e.exerciseId === exerciseId);
      if (entry) entry[field] = value;
      return active;
    });
  }

  /** Session-level cards: effort, stamina, how strong it felt. */
  setSessionCard(key, value) {
    return this.updateActive((active) => {
      active.session = { ...(active.session ?? {}), [key]: value };
      return active;
    });
  }

  setNote(exerciseId, note) {
    return this.updateActive((active) => {
      const entry = active.entries.find((e) => e.exerciseId === exerciseId);
      if (entry) entry.note = note;
      return active;
    });
  }

  setFeedback(muscleId, patch) {
    return this.updateActive((active) => {
      active.feedback[muscleId] = { ...(active.feedback[muscleId] ?? {}), ...patch };
      return active;
    });
  }

  finishSession() {
    const active = this.state.active;
    if (!active) return null;
    const session = {
      id: uid('sess'),
      mesoId: active.mesoId,
      programId: active.programId,
      dayId: active.dayId,
      week: active.week,
      date: Date.now(),
      durationSec: Math.round((Date.now() - active.startedAt) / 1000),
      mode: active.mode,
      entries: active.entries.map((e) => ({
        exerciseId: e.exerciseId,
        swappedFrom: e.swappedFrom ?? null,
        note: e.note,
        form: e.form,
        connection: e.connection,
        sets: e.sets.filter((s) => s.done),
        prescription: e.prescription,
      })).filter((e) => e.sets.length),
      feedback: active.feedback,
      session: active.session ?? {},   // effort, stamina, strength cards
      sideReports: Object.fromEntries(
        active.entries.filter((e) => e.side === 'left' || e.side === 'right')
          .map((e) => [e.exerciseId, e.side]),
      ),
    };
    this.update((s) => {
      const mesocycles = s.mesocycles.map((m) => {
        if (m.id !== active.mesoId) return m;
        const completed = { ...m.completed, [`${active.week}:${active.dayId}`]: session.id };
        // Roll the week forward once every day in it is done.
        const program = getProgram(m.programId);
        const weekDone = program?.days.every((d) => completed[`${active.week}:${d.id}`]);
        return {
          ...m,
          completed,
          currentWeek: weekDone ? Math.min(active.week + 1, (program.accumulationWeeks ?? 4) + 1) : m.currentWeek,
        };
      });
      return { ...s, sessions: [...s.sessions, session], mesocycles, active: null };
    });
    return session;
  }

  discardSession() {
    return this.update((s) => ({ ...s, active: null }));
  }

  deleteSession(sessionId) {
    return this.update((s) => ({
      ...s,
      sessions: s.sessions.filter((x) => x.id !== sessionId),
      mesocycles: s.mesocycles.map((m) => ({
        ...m,
        completed: Object.fromEntries(Object.entries(m.completed ?? {}).filter(([, id]) => id !== sessionId)),
      })),
    }));
  }

  nextUp() {
    const meso = this.activeMeso();
    if (!meso) return null;
    return nextSession(meso, this.mesoSessions(meso.id));
  }

  /* ------------------------------------------------------------ transfer */

  exportJson() {
    return JSON.stringify({ ...this.state, exportedAt: new Date().toISOString() }, null, 2);
  }

  importJson(text) {
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.sessions)) throw new Error('Not an IronBlock export.');
    this.update(() => migrate(parsed));
    return true;
  }

  reset() {
    this.update(() => defaultState());
  }
}

function round(n, dp) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

export const store = new Store();
export { STORAGE_KEY, slotKey };
