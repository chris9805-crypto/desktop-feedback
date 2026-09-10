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
import { progressFor } from './engine/progress.js';
import { getPhase, DEFAULT_PHASE } from './data/phases.js';
import { overallRetention } from './engine/retention.js';
import { trend as bodyweightTrend, rateAdvice, changeOver } from './engine/bodyweight.js';
import { newProfile, buildCard, decodeCard, safeName } from './engine/crew.js';

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
      // What you are eating for. Changes what counts as a good week, and is
      // recorded per block so a diet does not retroactively rewrite one.
      phase: null,
      plainLanguage: null,
      // Crew is opt-in: nothing is shared until you make a code yourself.
      profile: null,
      crew: [],
      equipment: 'full',
      onboarded: false,
    },
    mesocycles: [],
    activeMesoId: null,
    sessions: [],
    // Optional. Stays empty until you log one; nothing in the app requires it.
    weighIns: [],
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
        weighIns: (s.weighIns ?? []).map((w) => ({ ...w, weight: round(w.weight * factor, 2) })),
        active: s.active ? { ...s.active, entries: convertEntries(s.active.entries) } : null,
      };
    });
  }

  /* ------------------------------------------------------------ progress */

  /**
   * Streak, XP, level and achievements. Cached on the identity of the sessions
   * array, which every write replaces - this walks the whole log, and the
   * dashboard asks for it several times a render.
   */
  progress() {
    if (this._progressSessions !== this.state.sessions) {
      this._progressSessions = this.state.sessions;
      this._progress = progressFor(this.state);
    }
    return this._progress;
  }

  /** Sessions and sets logged in the last seven days, for the crew card. */
  weekTotals() {
    const since = Date.now() - 7 * 86400000;
    const recent = this.state.sessions.filter((s) => s.date >= since);
    return {
      sessions: recent.length,
      sets: recent.reduce((n, s) =>
        n + (s.entries ?? []).reduce((k, e) => k + e.sets.filter((x) => !x.warmup).length, 0), 0),
    };
  }

  /* ---------------------------------------------------------------- crew */

  profile() {
    return this.state.settings.profile;
  }

  setProfileName(name) {
    return this.update((s) => ({
      ...s,
      settings: {
        ...s.settings,
        profile: s.settings.profile
          ? { ...s.settings.profile, name: safeName(name) }
          : newProfile(name),
      },
    }));
  }

  /** Your own shareable summary. Nothing leaves the device until you send it. */
  myCard() {
    const profile = this.profile() ?? newProfile('You');
    return buildCard(profile, this.progress(), this.weekTotals());
  }

  /**
   * Add or refresh someone from a code they sent you. Matching on the id in
   * the code means a newer card from the same person replaces their old one
   * rather than listing them twice.
   */
  addCrewCode(code) {
    const card = decodeCard(code);
    if (card.id === this.profile()?.id) throw new Error('That is your own code.');
    this.update((s) => ({
      ...s,
      settings: {
        ...s.settings,
        crew: [...(s.settings.crew ?? []).filter((c) => c.id !== card.id), card],
      },
    }));
    return card;
  }

  removeCrew(id) {
    return this.update((s) => ({
      ...s,
      settings: { ...s.settings, crew: (s.settings.crew ?? []).filter((c) => c.id !== id) },
    }));
  }

  /** What you are eating for, on the running block. */
  phase() {
    return getPhase(this.activeMeso()?.phase ?? this.state.settings.phase ?? DEFAULT_PHASE);
  }

  setPhase(phaseId) {
    const phase = getPhase(phaseId);
    return this.update((s) => ({
      ...s,
      settings: { ...s.settings, phase: phase.id },
      // Unlike mode, the phase of a running block IS changed: starting a diet
      // mid-block is normal, and leaving the app pushing for progress you can
      // no longer make is the exact problem this setting exists to fix.
      mesocycles: s.mesocycles.map((m) => (m.id === s.activeMesoId ? { ...m, phase: phase.id } : m)),
    }));
  }

  /* --------------------------------------------------------- bodyweight */

  /**
   * Log a weigh-in. One per day: a second reading on the same day replaces the
   * first rather than stacking, because two numbers from one morning is not
   * more information, it is the same information twice.
   */
  addWeighIn(weight, when = Date.now()) {
    const value = Number(weight);
    if (!Number.isFinite(value) || value <= 0) throw new Error('That is not a weight.');
    const day = new Date(when).toDateString();
    return this.update((s) => ({
      ...s,
      weighIns: [
        ...(s.weighIns ?? []).filter((w) => new Date(w.date).toDateString() !== day),
        { id: uid('wi'), date: when, weight: Math.round(value * 100) / 100 },
      ].sort((a, b) => a.date - b.date),
    }));
  }

  removeWeighIn(id) {
    return this.update((s) => ({ ...s, weighIns: (s.weighIns ?? []).filter((w) => w.id !== id) }));
  }

  hasWeighIns() {
    return (this.state.weighIns ?? []).length > 0;
  }

  /** The trend, the rate judgement, and the recent change. Cached. */
  bodyweight() {
    if (this._bwSource !== this.state.weighIns) {
      this._bwSource = this.state.weighIns;
      const result = bodyweightTrend(this.state.weighIns ?? []);
      this._bw = {
        ...result,
        advice: rateAdvice(result, this.phase().id),
        change30: changeOver(this.state.weighIns ?? [], 30),
      };
    }
    return this._bw;
  }

  /** How much of your peak strength you are holding. Cached like the rest. */
  retention() {
    const key = `${this.state.sessions.length}:${(this.state.weighIns ?? []).length}`;
    if (this._retentionKey !== key || this._retentionSessions !== this.state.sessions) {
      this._retentionKey = key;
      this._retentionSessions = this.state.sessions;
      this._retention = overallRetention(this.state.sessions, {
        // Strength per kilo is the number that makes a cut look like the win it
        // is: holding the bar while the scale drops IS getting stronger.
        weighIns: this.state.weighIns ?? [],
      });
    }
    return this._retention;
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
    if (!this.mode().showImbalances) return { findings: [], lagging: [], dismissed: [] };
    // Cached on the identity of the sessions array. Every store write replaces
    // it, so reference equality is exact - unlike a length-and-last-id key,
    // which two different histories can share.
    if (this._weakPointSessions !== this.state.sessions) {
      this._weakPointSessions = this.state.sessions;
      const result = analyse(this.state.sessions);
      // The review card asks whether you agree with what the log found, and
      // says the app will stop nagging if you do not. Honour that: a muscle you
      // have dismissed is not steered volume and is not raised again.
      const dismissed = this.dismissedWeakPoints();
      this._weakPoints = {
        ...result,
        dismissed,
        findings: result.findings.filter((f) => !f.lagging.every((m) => dismissed.includes(m))),
        lagging: result.lagging.filter((m) => !dismissed.includes(m)),
      };
    }
    return this._weakPoints;
  }

  /** Muscles you have explicitly told the app are not a weak point. */
  dismissedWeakPoints() {
    const verdicts = new Map();
    for (const session of [...this.state.sessions].sort((a, b) => a.date - b.date)) {
      const answer = session.session?.weakPoint;
      if (answer?.muscle && answer.verdict) verdicts.set(answer.muscle, answer.verdict);
    }
    return [...verdicts].filter(([, verdict]) => verdict === 'disagree').map(([muscle]) => muscle);
  }

  /* ---------------------------------------------------------- mesocycles */

  startMesocycle(programId, name, equipment) {
    const program = getProgram(programId);
    if (!program) return null;
    const meso = newMesocycle(program, {
      name,
      equipment: equipment ?? this.state.settings.equipment ?? 'full',
      mode: this.state.settings.mode ?? DEFAULT_MODE,
      phase: this.state.settings.phase ?? DEFAULT_PHASE,
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
    if (!relevant.length) {
      return { lastFormPoor: false, consecutiveTopOfRange: 0, consecutiveMisses: 0 };
    }

    const top = repRange?.[1] ?? Infinity;
    const bottom = repRange?.[0] ?? 0;
    let streak = 0;
    for (const entry of relevant) {
      const best = (entry.sets ?? []).filter((x) => x.done && !x.warmup);
      if (!best.length || !best.some((x) => Number(x.reps) >= top)) break;
      streak += 1;
    }

    // Sessions in a row where the first working set fell short of the window.
    // A phase that expects off days uses this to require a second miss before
    // dropping the load, which is what stops the downward ratchet.
    let misses = 0;
    for (const entry of relevant) {
      const first = (entry.sets ?? []).find((x) => x.done && !x.warmup && Number(x.reps) > 0);
      if (!first || Number(first.reps) >= bottom) break;
      misses += 1;
    }

    return {
      lastFormPoor: (relevant[0].form ?? 0) >= 2,
      consecutiveTopOfRange: streak,
      consecutiveMisses: misses,
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
    const phase = meso.phase ?? this.state.settings.phase ?? DEFAULT_PHASE;
    // A remembered order is a preference, not a constraint: anything it does not
    // mention keeps its place, so adding an exercise later does not lose it.
    const saved = this.savedOrderFor(mesoId, dayId);
    const slots = saved
      ? [...day.slots].sort((a, b) => {
        const ai = saved.indexOf(a.substitutedFrom ?? a.exerciseId);
        const bi = saved.indexOf(b.substitutedFrom ?? b.exerciseId);
        return (ai < 0 ? Number.MAX_SAFE_INTEGER : ai) - (bi < 0 ? Number.MAX_SAFE_INTEGER : bi);
      })
      : day.slots;

    return {
      mesoId, weekIndex, dayId,
      plan, day, mode, phase,
      reordered: Boolean(saved),
      entries: slots.map((slot) => {
        const exercise = getExercise(slot.exerciseId);
        const previous = this.lastEntryFor(slot.exerciseId, { mesoId, dayId });
        return {
          exerciseId: slot.exerciseId,
          slot,
          prescription: prescribe({
            exercise, slot, program: plan.program, weekIndex, previous, mode, phase,
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
      phase: built.phase,
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

      // Finishing a set carries its numbers down to the rest of the exercise.
      // Straight sets are the overwhelmingly common case - nobody re-decides
      // the weight between set two and set three - and making someone key the
      // same two numbers four times is the fastest way to lose them. Anything
      // they have already touched themselves is left alone, so putting five
      // more kilos on the last set still works.
      if (patch.done) {
        const { weight, reps } = entry.sets[index];
        for (let i = index + 1; i < entry.sets.length; i++) {
          const later = entry.sets[i];
          if (later.done || later.edited) continue;
          entry.sets[i] = { ...later, weight, reps };
        }
      }
      return active;
    });
  }

  /**
   * A value the lifter set themselves, rather than one the app proposed.
   * Marked so carry-forward never overwrites a deliberate change.
   */
  editSet(exerciseId, index, patch) {
    return this.logSet(exerciseId, index, { ...patch, edited: true });
  }

  addSet(exerciseId) {
    return this.updateActive((active) => {
      const entry = active.entries.find((e) => e.exerciseId === exerciseId);
      if (!entry) return active;
      // Inherit from the last set actually performed, not merely the last row -
      // an untouched trailing row has nothing useful on it. Reps come along
      // too: an extra set is almost always another set of the same thing.
      const source = [...entry.sets].reverse().find((x) => x.done) ?? entry.sets[entry.sets.length - 1];
      entry.sets.push({
        weight: source?.weight ?? null,
        reps: source?.reps ?? null,
        rir: null, done: false, warmup: false,
      });
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

  /**
   * Move an exercise within the session you are doing right now.
   *
   * The squat rack being occupied is not a programming decision, it is Tuesday.
   * Order within a session barely affects the result as long as the heavy work
   * still lands while you are fresh, so this is deliberately free to change -
   * and the app does not argue about it.
   */
  moveEntry(exerciseId, delta) {
    return this.updateActive((active) => {
      const from = active.entries.findIndex((e) => e.exerciseId === exerciseId);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= active.entries.length) return active;
      const [entry] = active.entries.splice(from, 1);
      active.entries.splice(to, 0, entry);
      return active;
    });
  }

  /** Send an exercise to the end of the queue - "the rack is busy, come back". */
  deferEntry(exerciseId) {
    return this.updateActive((active) => {
      const from = active.entries.findIndex((e) => e.exerciseId === exerciseId);
      if (from < 0) return active;
      const [entry] = active.entries.splice(from, 1);
      // After the last exercise that still has work left, not after finished
      // ones - otherwise "later" means "after the stuff you already did".
      let insertAt = active.entries.length;
      while (insertAt > 0 && active.entries[insertAt - 1].sets.every((x) => x.done)) insertAt -= 1;
      active.entries.splice(Math.max(insertAt, 0), 0, entry);
      return active;
    });
  }

  /**
   * Keep the current order for this day in future weeks.
   *
   * Stored on the block rather than the program, so the template stays the
   * template and one person's gym layout does not rewrite it for everyone.
   */
  rememberOrder() {
    const active = this.state.active;
    if (!active) return null;
    const order = active.entries.map((e) => e.swappedFrom ?? e.exerciseId);
    return this.update((s) => ({
      ...s,
      mesocycles: s.mesocycles.map((m) => (m.id === active.mesoId
        ? { ...m, dayOrder: { ...(m.dayOrder ?? {}), [active.dayId]: order } }
        : m)),
    }));
  }

  savedOrderFor(mesoId, dayId) {
    return this.state.mesocycles.find((m) => m.id === mesoId)?.dayOrder?.[dayId] ?? null;
  }

  forgetOrder(mesoId, dayId) {
    return this.update((s) => ({
      ...s,
      mesocycles: s.mesocycles.map((m) => {
        if (m.id !== mesoId) return m;
        const dayOrder = { ...(m.dayOrder ?? {}) };
        delete dayOrder[dayId];
        return { ...m, dayOrder };
      }),
    }));
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
      phase: active.phase,
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
