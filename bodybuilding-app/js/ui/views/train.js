/**
 * The training screen - the one that is open while you are actually lifting.
 *
 * Design rules for this view:
 *  - The prescription is always visible next to the inputs. You should never
 *    have to remember what you were told to do.
 *  - Last week's numbers sit beside this week's target, because "beat this"
 *    is the whole job.
 *  - Every prescription shows its reasoning. A number you do not understand is
 *    a number you will ignore in week three.
 *  - Logging a set is one tap once the prescribed values are already in place.
 */

import { h, clear, fmtWeight, fmtClock, fmtDuration } from '../dom.js';
import { confirmSheet, chooseSheet } from '../sheet.js';
import { term, showTerm } from '../term.js';
import {
  usePlainLanguage, targetLine, reasonLine, tagLabel, warmupAdvice,
  EFFORT_CHOICES, effortShort,
} from '../explain.js';
import { nextPosition, sessionProgress, setCard, effortCard, exerciseCheckCard } from './cards.js';
import { buildCards } from './review.js';
import { getMode } from '../../data/modes.js';
import { sessionXp, followedPlan, newlyEarned } from '../../engine/progress.js';
import { ACHIEVEMENT_BY_ID } from '../../data/achievements.js';
import { store } from '../../store.js';
import { getExercise, EXERCISES } from '../../data/exercises.js';
import { getProgram } from '../../data/programs.js';
import { muscleName } from '../../data/muscles.js';
import { weekPlan, feedbackTargets, estimateSessionMinutes } from '../../engine/mesocycle.js';
import { e1rm, tonnage } from '../../engine/onerm.js';
import { bestSet } from '../../engine/progression.js';

/* ------------------------------------------------------------- rest timer */

const rest = {
  endsAt: null, duration: 0, label: '', tick: null,
  start(seconds, label) {
    this.endsAt = Date.now() + seconds * 1000;
    this.duration = seconds;
    this.label = label;
    render();
  },
  stop() { this.endsAt = null; render(); },
  remaining() { return this.endsAt ? (this.endsAt - Date.now()) / 1000 : 0; },
  active() { return this.endsAt != null; },
};

setInterval(() => {
  if (rest.active()) {
    const bar = document.querySelector('.rest-bar');
    if (bar) updateRestBar(bar);
  }
}, 250);

function updateRestBar(bar) {
  const remaining = rest.remaining();
  const over = remaining <= 0;
  bar.classList.toggle('is-over', over);
  const time = bar.querySelector('.time');
  const fill = bar.querySelector('.fill');
  if (time) time.textContent = over ? `+${fmtClock(-remaining)}` : fmtClock(remaining);
  if (fill) fill.style.width = `${Math.max(0, Math.min(100, (remaining / rest.duration) * 100))}%`;
}

function restBar() {
  const bar = h('div', { class: 'rest-bar' },
    h('div', { class: 'time num' }, fmtClock(rest.remaining())),
    h('div', { class: 'stack', style: 'flex:1;gap:4px' },
      h('div', { class: 'small secondary' }, rest.label),
      h('div', { class: 'track' }, h('div', { class: 'fill' })),
    ),
    h('button', { class: 'btn-sm', onClick: () => { rest.endsAt += 30000; } }, '+30s'),
    h('button', { class: 'btn-sm', onClick: () => rest.stop() }, 'Skip'),
  );
  updateRestBar(bar);
  return bar;
}

/* ------------------------------------------------------------------ view */

let root = null;

export function render(container) {
  if (container) root = container;
  if (!root) return;
  clear(root);
  const active = store.state.active;
  root.append(active ? activeSession(active) : sessionPicker());
  // The rest bar is fixed to the bottom of the viewport, so the page needs to
  // know to leave room for it - otherwise it sits on top of the button you are
  // trying to press, which is exactly when it is showing.
  document.body.classList.toggle('is-resting', rest.active());
  if (rest.active()) root.append(restBar());
}

/* --------------------------------------------------------- pick a session */

function sessionPicker() {
  const meso = store.activeMeso();
  if (!meso) {
    return h('div', { class: 'empty' },
      h('h3', {}, 'No block running'),
      h('p', {}, 'Pick a program and start a mesocycle - the app takes it from there.'),
      h('a', { class: 'btn btn-primary', href: '#/programs' }, 'Browse programs'),
    );
  }

  const program = getProgram(meso.programId);
  const sessions = store.mesoSessions(meso.id);
  const next = store.nextUp();
  const wrap = h('div', { class: 'stack' });

  if (!next) {
    wrap.append(h('div', { class: 'card' },
      h('h2', {}, 'Block complete'),
      h('p', { class: 'secondary' },
        `Every session of ${program.name} is logged, deload included. Take stock in History, ` +
        'then start the next block - it will pick up from the strength you just built.'),
      h('a', { class: 'btn btn-primary', href: '#/programs' }, 'Start the next block'),
    ));
    return wrap;
  }

  const viewWeek = next.weekIndex;
  const plan = weekPlan(meso, sessions, viewWeek);

  wrap.append(h('div', { class: 'card' },
    h('div', { class: 'card-head' },
      h('div', {},
        h('h2', {}, `${plan.label} · ${plan.days.filter((d) => d.done).length}/${plan.days.length} done`),
        h('div', { class: 'small muted' }, `${program.name} — target ${plan.targetRir} RIR this week`),
      ),
      plan.deload && h('span', { class: 'badge badge-accent' }, 'Deload'),
    ),
    plan.deload && h('p', { class: 'secondary small' },
      'Load and sets are cut deliberately this week. The training is already done; ' +
      'this is where the fatigue clears and the adaptation shows up. Do not add sets back.'),
    h('div', { class: 'grid grid-2', style: 'margin-top:12px' },
      ...plan.days.map((day) => dayCard(meso, viewWeek, day, day.id === next.day.id)),
    ),
  ));
  return wrap;
}

function dayCard(meso, weekIndex, day, isNext) {
  const minutes = estimateSessionMinutes(day);
  const sets = day.slots.reduce((n, s) => n + s.sets, 0);
  return h('div', { class: `day-card${day.done ? ' is-done' : ''}` },
    h('div', { class: 'spread' },
      h('div', {},
        h('h3', {}, day.name),
        h('div', { class: 'small muted' }, day.focus),
      ),
      day.done ? h('span', { class: 'badge badge-good' }, h('span', { class: 'dot' }), 'Logged') :
        isNext ? h('span', { class: 'badge badge-accent' }, 'Next up') : null,
    ),
    h('div', { class: 'small muted', style: 'margin-top:8px' }, `${sets} sets · about ${minutes} min`),
    h('ol', {}, ...day.slots.map((s) => h('li', {},
      `${getExercise(s.exerciseId)?.name ?? s.exerciseId} — ${s.sets}×`,
      s.addedSets > 0 ? h('span', { class: 'muted' }, ` (+${s.addedSets})`) : null,
    ))),
    !day.done && h('button', {
      class: `btn ${isNext ? 'btn-primary' : ''}`, style: 'margin-top:12px',
      onClick: () => { store.startSession(meso.id, weekIndex, day.id); render(); window.scrollTo(0, 0); },
    }, 'Start this session'),
  );
}

/* ------------------------------------------------------- active session */

/**
 * Which set the card flow is showing, and whether it is mid-question. Kept in
 * module scope rather than in the store: it is where you are looking, not
 * something worth persisting or re-deriving on every render.
 */
const flow = { pendingEffort: null, pendingCheck: null, listView: false };

function activeSession(active) {
  return flow.listView ? listSession(active) : cardSession(active);
}

/* --------------------------------------------------------- card flow */

function cardSession(active) {
  const progress = sessionProgress(active);
  const wrap = h('div', { class: 'stack session-flow' });
  const program = getProgram(active.programId);
  const day = program?.days.find((d) => d.id === active.dayId);

  wrap.append(h('div', { class: 'flow-head' },
    h('div', { class: 'flow-bar' }, h('div', { class: 'flow-fill', style: `width:${progress.pct}%` })),
    h('div', { class: 'flow-meta' },
      h('span', {}, `${day?.name ?? 'Session'} · ${progress.done}/${progress.total} sets`),
      h('button', {
        class: 'btn-ghost btn-sm',
        onClick: () => { flow.listView = true; render(); },
      }, 'See the whole session'),
    ),
  ));

  const opts = {
    onChange: () => render(),
    onJump: () => { flow.listView = true; render(); },
    onLogged: (entry, position) => {
      flow.pendingEffort = { exerciseId: entry.exerciseId, setIndex: position.setIndex };
      if (store.state.settings.autoStartRest && !entry.sets[position.setIndex]?.warmup) {
        rest.start(entry.prescription.restSec, `Rest — ${getExercise(entry.exerciseId).name}`);
      }
      render();
    },
    onAnswered: (entry) => {
      flow.pendingEffort = null;
      // Once every set of an exercise is in, the mode may want a word about it.
      const finished = entry.sets.every((x) => x.done);
      const mode = getMode(active.mode);
      const wantsCheck = mode.setChecks.some((c) =>
        c !== 'side' || getExercise(entry.exerciseId)?.unilateral);
      if (finished && wantsCheck) flow.pendingCheck = entry.exerciseId;
      render();
    },
    onNext: () => { flow.pendingCheck = null; render(); },
  };

  // A per-exercise check-in takes priority, then an unanswered effort question,
  // then the next unlogged set.
  if (flow.pendingCheck) {
    const entry = active.entries.find((e) => e.exerciseId === flow.pendingCheck);
    const card = entry && exerciseCheckCard(active, entry, opts);
    if (card) { wrap.append(card); return wrap; }
    flow.pendingCheck = null;
  }

  if (flow.pendingEffort) {
    const entryIndex = active.entries.findIndex((e) => e.exerciseId === flow.pendingEffort.exerciseId);
    const entry = active.entries[entryIndex];
    const set = entry?.sets[flow.pendingEffort.setIndex];
    if (set?.done) {
      wrap.append(effortCard(active, { entryIndex, setIndex: flow.pendingEffort.setIndex }, opts));
      return wrap;
    }
    flow.pendingEffort = null;
  }

  const position = nextPosition(active);
  if (position) {
    wrap.append(setCard(active, position, opts));
    wrap.append(upNext(active, position));
    return wrap;
  }

  // Everything is logged.
  wrap.append(h('div', { class: 'setcard' },
    h('h2', { class: 'setcard-question' }, 'That is every set logged'),
    h('p', { class: 'setcard-hint' },
      'A few quick questions about how it went, then it is saved. They take about ' +
      'thirty seconds and they are what sets next week.'),
    h('button', { class: 'btn-primary setcard-done', onClick: () => finishFlow(active) }, 'Finish up'),
    h('button', {
      class: 'btn-ghost setcard-skip',
      onClick: () => { flow.listView = true; render(); },
    }, 'Go back and change something'),
  ));
  return wrap;
}

/** What is coming, so the session has a shape rather than being a tunnel. */
function upNext(active, position) {
  const remaining = active.entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry, index }) => index >= position.entryIndex && entry.sets.some((s) => !s.done));
  if (remaining.length <= 1) return null;
  return h('div', { class: 'upnext' },
    h('h4', {}, 'Still to come'),
    h('ol', {}, ...remaining.slice(1, 5).map(({ entry }) => {
      const left = entry.sets.filter((s) => !s.done).length;
      return h('li', {}, `${getExercise(entry.exerciseId)?.name} — ${left} sets`);
    })),
  );
}

/* --------------------------------------------------------- list view */

function listSession(active) {
  const program = getProgram(active.programId);
  const day = program?.days.find((d) => d.id === active.dayId);
  const doneSets = active.entries.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const totalSets = active.entries.reduce((n, e) => n + e.sets.length, 0);
  const allLogged = active.entries.every((e) => e.sets.every((s) => s.done || s.reps == null));

  const wrap = h('div', { class: 'stack' });
  wrap.append(h('div', { class: 'row', style: 'justify-content:flex-end' },
    h('button', {
      class: 'btn-sm',
      onClick: () => { flow.listView = false; render(); },
    }, '← Back to one set at a time'),
  ));

  wrap.append(h('div', { class: 'card' },
    h('div', { class: 'spread session-head' },
      h('div', {},
        h('h2', {}, day?.name ?? 'Session'),
        h('div', { class: 'small muted' },
          `${program?.name} · Week ${active.week + 1} · ${doneSets}/${totalSets} sets logged`),
      ),
      h('div', { class: 'row' },
        h('button', {
          class: 'btn-ghost',
          onClick: async () => {
            const ok = await confirmSheet({
              title: 'Throw this session away?',
              body: 'Everything you have ticked off so far will be lost, and this day will show as not done.',
              confirmLabel: 'Discard it', cancelLabel: 'Keep training', danger: true,
            });
            if (ok) { store.discardSession(); rest.stop(); render(); }
          },
        }, 'Discard'),
        h('button', {
          class: 'btn-primary',
          onClick: () => finishFlow(active),
        }, doneSets ? 'Finish session' : 'End session'),
      ),
    ),
  ));

  for (const entry of active.entries) wrap.append(exerciseCard(entry, active));

  wrap.append(h('div', { class: 'card' },
    h('div', { class: 'spread' },
      h('div', { class: 'small secondary' },
        allLogged && doneSets ? 'Every set is in. Finish up and record how it felt.' : 'Finish when you are done - part-logged sessions save fine.'),
      h('button', { class: 'btn-primary btn-lg', onClick: () => finishFlow(active) }, 'Finish session'),
    ),
  ));

  return wrap;
}

function exerciseCard(entry, active) {
  const exercise = getExercise(entry.exerciseId);
  const p = entry.prescription;
  const unit = store.state.settings.unit;
  const complete = entry.sets.length > 0 && entry.sets.every((s) => s.done);

  const card = h('div', { class: `exercise${complete ? ' is-complete' : ''}` });

  const beginner = usePlainLanguage();

  card.append(h('div', { class: 'exercise-head' },
    h('div', { class: 'title' },
      h('h3', {},
        exercise.name,
        entry.swappedFrom && h('span', { class: 'badge' }, 'swapped'),
        entry.slotSubstitutedFrom && h('span', { class: 'badge' }, 'for your kit'),
      ),
      h('div', { class: 'small muted' },
        `${exercise.primary.map(muscleName).join(', ')} · ${exercise.equipment} · rest ${fmtClock(p.restSec)}`),
    ),
    h('span', { class: `badge ${p.tag === 'load-up' ? 'badge-accent' : ''}` }, tagLabel(p.tag, beginner)),
  ));

  card.append(h('div', { class: 'prescription' },
    h('span', { class: 'target' }, targetLine(p, unit, beginner)),
    reasonLine(p, unit, beginner),
    p.weight == null && h('div', { class: 'tiny muted', style: 'margin-top:5px' },
      'Type the weight you used before ticking the set off. Doing it with just your ' +
      'bodyweight? Enter 0 — that is a real starting point and the app builds up from it.'),
    p.previous && h('div', { class: 'tiny muted', style: 'margin-top:5px' },
      beginner
        ? `Last time: ${fmtWeight(p.previous.weight, unit)} for ${p.previous.reps} reps, ` +
          `with ${p.previous.rir === 0 ? 'nothing' : p.previous.rir + ' more'} left in the tank.`
        : `Last time: ${fmtWeight(p.previous.weight, unit)} × ${p.previous.reps} @ ${p.previous.rir} RIR` +
          (p.e1rmBefore ? ` · e1RM ${Math.round(p.e1rmBefore)}${unit}` : '')),
  ));

  // Beginners are routinely left to guess at warming up, and then wonder why
  // the first working set feels awful.
  if (beginner) {
    const steps = warmupAdvice(exercise, p.weight, unit);
    card.append(h('details', { class: 'warmup' },
      h('summary', {}, 'How do I warm up for this?'),
      h('ul', { class: 'cues' }, ...steps.map((line) => h('li', {}, line))),
      h('p', { class: 'tiny muted', style: 'margin:6px 0 0' },
        'Warm-up sets do not count towards your training - tick the small "w" next to a ' +
        'row if you want to log one.'),
    ));
  }

  // Set rows
  const sets = h('div', { class: 'sets' });
  sets.append(h('div', { class: 'set-row head' },
    h('span', {}, 'Set'),
    h('span', {}, `Weight (${unit})`),
    h('span', {}, 'Reps'),
    h('span', {}, beginner ? term('rir', 'Left in tank') : term('rir', 'RIR')),
    h('span', {}, ''), h('span', {}, ''),
  ));
  entry.sets.forEach((set, i) => {
    sets.append(setRow(entry, set, i, p, exercise));
    // Beginners are asked the effort question in words, right after the set
    // they just did, instead of being handed an empty box labelled "RIR".
    if (beginner && set.done && set.rir == null && !set.warmup) {
      sets.append(effortStrip(entry, set, i));
    }
  });
  sets.append(h('div', { class: 'row', style: 'margin-top:10px' },
    h('button', { class: 'btn-sm', onClick: () => { store.addSet(entry.exerciseId); render(); } }, '+ Set'),
    h('button', {
      class: 'btn-sm',
      onClick: async () => {
        const picked = await chooseSheet({
          title: `Swap ${exercise.name}`,
          body: 'Machine taken, or something hurts? These train the same muscle.',
          options: exercise.subs.map((id) => {
            const alt = getExercise(id);
            return { value: id, label: alt.name, detail: `${alt.equipment} · ${alt.reps[0]}-${alt.reps[1]} reps` };
          }),
        });
        if (picked) { store.swapExercise(entry.exerciseId, picked); render(); }
      },
      disabled: !exercise.subs.length,
    }, 'Swap'),
    h('button', {
      class: 'btn-sm',
      onClick: () => { rest.start(p.restSec, `Rest — ${exercise.name}`); render(); },
    }, 'Rest timer'),
  ));
  card.append(sets);

  if (exercise.cues.length) {
    card.append(h('details', { style: 'margin:0 16px 14px' },
      h('summary', { class: 'small secondary', style: 'cursor:pointer' }, 'Technique cues'),
      h('ul', { class: 'cues' }, ...exercise.cues.map((c) => h('li', {}, c))),
    ));
  }

  return card;
}

/** The set as it currently stands in the store, not as it was when drawn. */
function liveSet(exerciseId, index) {
  return store.state.active?.entries.find((e) => e.exerciseId === exerciseId)?.sets[index] ?? null;
}

function setRow(entry, set, index, prescription, exercise) {
  const unit = store.state.settings.unit;
  const row = h('div', { class: `set-row${set.done ? ' done' : ''}${set.warmup ? ' warmup' : ''}` });

  // `input`, not `change`: `change` only fires on blur, so a value typed and
  // immediately confirmed would never reach the store.
  const commit = (field) => (ev) => {
    const raw = ev.target.value;
    store.logSet(entry.exerciseId, index, { [field]: raw === '' ? null : Number(raw) });
  };

  row.append(
    h('span', { class: 'idx', title: set.warmup ? 'Warm-up set' : 'Working set' }, set.warmup ? 'W' : String(index + 1)),
    h('input', {
      type: 'number', inputmode: 'decimal', step: 'any', value: set.weight ?? '',
      placeholder: prescription.weight == null ? '—' : String(prescription.weight),
      'aria-label': `Set ${index + 1} weight`, onInput: commit('weight'),
    }),
    h('input', {
      type: 'number', inputmode: 'numeric', value: set.reps ?? '',
      placeholder: String(prescription.targetReps),
      'aria-label': `Set ${index + 1} reps`, onInput: commit('reps'),
    }),
    // In beginner mode this is a button that opens the effort question in
    // words. A number box labelled "RIR" is the single most likely place for a
    // new lifter to decide this app is not for them.
    usePlainLanguage()
      ? h('button', {
          class: 'rir-button', 'aria-label': `Set ${index + 1}: how many reps were left`,
          onClick: async () => {
            const picked = await chooseSheet({
              title: 'How many more could you have done?',
              body: 'Your best honest guess. This is what tells the app whether the weight was right.',
              options: EFFORT_CHOICES.map((c) => ({ value: c.rir, label: c.label, detail: c.detail })),
              selected: set.rir,
            });
            if (picked != null) { store.logSet(entry.exerciseId, index, { rir: picked }); render(); }
          },
        }, set.rir == null ? '—' : effortShort(set.rir))
      : h('input', {
          type: 'number', inputmode: 'numeric', min: '0', max: '10', value: set.rir ?? '',
          placeholder: String(prescription.targetRir),
          'aria-label': `Set ${index + 1} reps in reserve`, onInput: commit('rir'),
        }),
    h('button', {
      class: 'check', title: set.done ? 'Logged - tap to undo' : 'Log this set',
      'aria-label': set.done ? 'Undo set' : 'Log set',
      onClick: (ev) => {
        // Read the set back out of the store rather than trusting the copy this
        // row closed over. Typing in a field updates the store but does not
        // re-render, so the captured object is one edit behind - which meant a
        // weight typed a second before tapping the tick was invisible here.
        const live = liveSet(entry.exerciseId, index) ?? set;
        if (live.done) {
          store.logSet(entry.exerciseId, index, { done: false });
        } else {
          // Falling back to the prescription means a completed set is one tap -
          // but only once there is a load to fall back to. A set logged with no
          // weight is worse than no set: it silently poisons next week's
          // prescription and every estimated max after it. Enter 0 for
          // bodyweight work; that is a real load and the engine treats it as one.
          const weight = live.weight ?? prescription.weight;
          if (weight == null) {
            const input = ev.currentTarget.closest('.set-row').querySelector('input');
            input?.focus();
            input?.classList.add('needs-value');
            setTimeout(() => input?.classList.remove('needs-value'), 1600);
            return;
          }
          store.logSet(entry.exerciseId, index, {
            done: true,
            weight,
            reps: live.reps ?? prescription.targetReps,
            // An experienced lifter who leaves the box empty means "as planned".
            // A beginner has not been asked yet, so leave it blank and ask.
            rir: live.rir ?? (usePlainLanguage() && !live.warmup ? null : prescription.targetRir),
          });
          if (store.state.settings.autoStartRest && !live.warmup) {
            rest.start(prescription.restSec, `Rest — ${exercise.name}`);
          }
        }
        render();
      },
    }, '✓'),
    h('button', {
      class: 'btn-ghost btn-sm', title: 'Mark as warm-up',
      'aria-label': 'Toggle warm-up set',
      onClick: () => { store.logSet(entry.exerciseId, index, { warmup: !set.warmup }); render(); },
    }, set.warmup ? '↺' : 'w'),
  );
  return row;
}

/**
 * The effort question, asked in words immediately after the set.
 *
 * Inline rather than in a dialog, so it reads as part of logging the set
 * rather than an interruption - and so it is obvious it can be skipped.
 */
function effortStrip(entry, set, index) {
  const strip = h('div', { class: 'effort-strip' },
    h('div', { class: 'effort-question' },
      'How many more could you have done?',
      h('button', { class: 'term', type: 'button', onClick: () => showTerm('rir') }, 'why this matters'),
    ),
  );
  const row = h('div', { class: 'effort-options' });
  for (const choice of EFFORT_CHOICES) {
    row.append(h('button', {
      class: 'effort-option', title: choice.detail,
      onClick: () => { store.logSet(entry.exerciseId, index, { rir: choice.rir }); render(); },
    }, choice.label));
  }
  strip.append(row);
  return strip;
}

/* --------------------------------------------------------- finish + feedback */

async function finishFlow(active) {
  const logged = active.entries.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);

  if (!logged) {
    const ok = await confirmSheet({
      title: 'Nothing logged yet',
      body: 'You have not ticked off any sets. End the session without saving it?',
      confirmLabel: 'End it', cancelLabel: 'Keep training', danger: true,
    });
    if (ok) { store.discardSession(); rest.stop(); flow.pendingEffort = null; flow.pendingCheck = null; render(); }
    return;
  }

  runReview(active);
}

/**
 * The post-session flashcards: one question a screen, tapped through.
 *
 * A single dense form asking nine things at once gets skipped, and skipped
 * feedback is the same as no feedback - the app falls back to a default step
 * up and stops being able to tell a good week from a bad one. One question at
 * a time, each with its consequence stated, actually gets answered.
 */
function runReview(active) {
  const cards = buildCards(active);
  let index = 0;

  const backdrop = h('div', { class: 'review-backdrop' });
  const panel = h('div', { class: 'review-panel' });

  const draw = () => {
    clear(panel);
    if (index >= cards.length) return save();

    panel.append(h('div', { class: 'review-progress' },
      ...cards.map((_, i) => h('span', { class: `dot${i === index ? ' is-current' : ''}${i < index ? ' is-done' : ''}` })),
      h('span', { class: 'small muted', style: 'margin-left:auto' }, `${index + 1} of ${cards.length}`),
    ));
    panel.append(cards[index].render(() => { index += 1; draw(); }));
    panel.append(h('div', { class: 'review-actions' },
      index > 0 && h('button', { class: 'btn-ghost', onClick: () => { index -= 1; draw(); } }, '← Back'),
      h('button', { class: 'btn-ghost', onClick: () => { index += 1; draw(); } },
        index === cards.length - 1 ? 'Skip and save' : 'Skip this'),
    ));
    panel.scrollTop = 0;
  };

  const save = () => {
    const before = store.progress();
    const session = store.finishSession();
    rest.stop();
    flow.pendingEffort = null;
    flow.pendingCheck = null;
    flow.listView = false;
    backdrop.remove();
    render();
    showSummary(session, before);
  };

  backdrop.append(panel);
  backdrop.addEventListener('click', (ev) => { if (ev.target === backdrop) backdrop.remove(); });
  document.body.append(backdrop);
  draw();
}

/**
 * The moment after a session is saved.
 *
 * This is the payoff, and the old version of it was a table of numbers. What
 * makes someone come back is seeing that the last hour moved something -
 * so it leads with the XP earned and where it came from, then any badge that
 * just unlocked, then the records. Numbers people care about, in order.
 */
function showSummary(session, before) {
  if (!session) return;
  const unit = store.state.settings.unit;
  const after = store.progress();
  const program = getProgram(session.programId);
  const deload = program ? session.week >= (program.accumulationWeeks ?? 4) : false;

  const prs = session.entries.map((e) => {
    const best = bestSet(e.sets);
    if (!best) return null;
    const now = e1rm(best.weight, best.reps, best.rir ?? 0);
    const previous = e.prescription?.e1rmBefore ?? 0;
    return previous && now > previous * 1.005
      ? { name: getExercise(e.exerciseId)?.name, now: Math.round(now) }
      : null;
  }).filter(Boolean);

  const xp = sessionXp(session, { isPr: prs.length > 0, deload, onPlan: followedPlan(session) });
  const badges = newlyEarned(before, after).map((id) => ACHIEVEMENT_BY_ID[id]).filter(Boolean);
  const sets = session.entries.reduce((n, e) => n + e.sets.length, 0);

  const dialog = h('div', { class: 'celebrate-backdrop' });
  const panel = h('div', { class: 'celebrate' },
    h('div', { class: 'celebrate-xp' },
      h('span', { class: 'celebrate-amount num' }, `+${xp.total}`),
      h('span', { class: 'celebrate-unit' }, 'XP'),
    ),
    h('h2', {}, deload ? 'Easy week done' : 'Session done'),
    h('div', { class: 'chips', style: 'justify-content:center' },
      chipEl(`${sets} sets`),
      // A session logged in under a minute is someone catching up on paper
      // notes, not a workout. "0 min" just reads as broken.
      session.durationSec >= 60 && chipEl(fmtDuration(session.durationSec)),
      after.streak.current > 1 && chipEl(`${after.streak.current} in a row`),
    ),
    h('div', { class: 'xp-lines' }, ...xp.lines.map((line) => h('div', { class: 'xp-line' },
      h('span', {}, line.label),
      h('span', { class: 'num' }, `+${line.amount}`),
    ))),
  );

  if (badges.length) {
    panel.append(h('div', { class: 'unlocked' },
      h('h4', {}, badges.length === 1 ? 'Badge unlocked' : 'Badges unlocked'),
      ...badges.map((b) => h('div', { class: `unlocked-badge tier-${b.tier}` },
        h('span', { class: 'badge-icon' }, b.icon),
        h('div', {}, h('b', {}, b.name), h('div', { class: 'muted small' }, b.blurb)),
        h('span', { class: 'num tiny' }, `+${b.xp}`),
      )),
    ));
  }

  if (prs.length) {
    panel.append(h('div', { class: 'unlocked' },
      h('h4', {}, 'New best'),
      ...prs.map((p) => h('div', { class: 'pr-row' },
        h('span', {}, p.name),
        h('span', { class: 'num' }, fmtWeight(p.now, unit)),
      )),
    ));
  }

  // Level-up gets its own line rather than being buried in the numbers.
  if (after.level.level > (before?.level.level ?? after.level.level)) {
    panel.append(h('div', { class: 'levelup' },
      h('b', {}, `Level ${after.level.level}`), ' — ', levelName(after.level.level)));
  }

  panel.append(h('button', {
    class: 'btn-primary btn-lg celebrate-done',
    onClick: () => { dialog.remove(); render(); },
  }, 'Done'));

  dialog.append(panel);
  dialog.addEventListener('click', (ev) => { if (ev.target === dialog) { dialog.remove(); render(); } });
  document.body.append(dialog);
}

function chipEl(text) {
  return text ? h('span', { class: 'chip' }, text) : null;
}

function levelName(level) {
  if (level >= 30) return 'Veteran';
  if (level >= 20) return 'Advanced';
  if (level >= 12) return 'Seasoned';
  if (level >= 6) return 'Committed';
  if (level >= 3) return 'Building';
  return 'Getting started';
}

export { rest };
