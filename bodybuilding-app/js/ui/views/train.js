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
  isBeginner, targetLine, reasonLine, tagLabel, warmupAdvice,
  EFFORT_CHOICES, effortShort,
} from '../explain.js';
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

function activeSession(active) {
  const program = getProgram(active.programId);
  const day = program?.days.find((d) => d.id === active.dayId);
  const doneSets = active.entries.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const totalSets = active.entries.reduce((n, e) => n + e.sets.length, 0);
  const allLogged = active.entries.every((e) => e.sets.every((s) => s.done || s.reps == null));

  const wrap = h('div', { class: 'stack' });

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

  const beginner = isBeginner();

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

  const commit = (field) => (ev) => {
    const raw = ev.target.value;
    store.logSet(entry.exerciseId, index, { [field]: raw === '' ? null : Number(raw) });
  };

  row.append(
    h('span', { class: 'idx', title: set.warmup ? 'Warm-up set' : 'Working set' }, set.warmup ? 'W' : String(index + 1)),
    h('input', {
      type: 'number', inputmode: 'decimal', step: 'any', value: set.weight ?? '',
      placeholder: prescription.weight == null ? '—' : String(prescription.weight),
      'aria-label': `Set ${index + 1} weight`, onChange: commit('weight'),
    }),
    h('input', {
      type: 'number', inputmode: 'numeric', value: set.reps ?? '',
      placeholder: String(prescription.targetReps),
      'aria-label': `Set ${index + 1} reps`, onChange: commit('reps'),
    }),
    // In beginner mode this is a button that opens the effort question in
    // words. A number box labelled "RIR" is the single most likely place for a
    // new lifter to decide this app is not for them.
    isBeginner()
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
          'aria-label': `Set ${index + 1} reps in reserve`, onChange: commit('rir'),
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
            rir: live.rir ?? (isBeginner() && !live.warmup ? null : prescription.targetRir),
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
  const program = getProgram(active.programId);
  const day = program?.days.find((d) => d.id === active.dayId);
  const logged = active.entries.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const beginner = isBeginner();

  if (!logged) {
    const ok = await confirmSheet({
      title: 'Nothing logged yet',
      body: 'You have not ticked off any sets. End the session without saving it?',
      confirmLabel: 'End it', cancelLabel: 'Keep training', danger: true,
    });
    if (ok) { store.discardSession(); rest.stop(); render(); }
    return;
  }

  const muscles = feedbackTargets({ slots: day.slots });
  const dialog = h('div', {
    style: 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:50;display:grid;place-items:center;padding:16px;overflow:auto',
  });
  const panel = h('div', { class: 'card', style: 'max-width:520px;width:100%' });

  panel.append(
    h('h2', {}, beginner ? 'How does your body feel?' : 'How did that land?'),
    h('p', { class: 'secondary small' },
      beginner
        ? 'This decides how much work you get next week. If a muscle recovered easily it gets ' +
          'a bit more; if it is still wrecked it gets less. There is no right answer and no ' +
          'reward for being tough - just say what is true. You can skip it.'
        : 'This is what sets next week\'s volume. Answer honestly - the app adds sets where you ' +
          'recovered and takes them away where you did not. Skipping it just means a default step up.'),
  );

  const grid = h('div', { class: 'feedback-grid', style: 'margin:16px 0' });
  for (const muscle of muscles) {
    grid.append(h('div', {},
      h('h4', { style: 'margin-bottom:8px' }, muscleName(muscle)),
      beginner
        ? scaleRow(muscle, 'soreness', 'Still aching from last time?',
            ['Not at all', 'A little', 'Yes, quite', 'Yes, a lot'])
        : scaleRow(muscle, 'soreness', 'Soreness', ['None', 'Mild', 'Sore', 'Still sore']),
      beginner
        ? scaleRow(muscle, 'pump', 'Did it feel worked?',
            ['Barely', 'A bit', 'Definitely', 'Massively'])
        : scaleRow(muscle, 'pump', 'Pump', ['None', 'Slight', 'Good', 'Huge']),
      beginner
        ? scaleRow(muscle, 'joint', 'Any joint pain?',
            ['None', 'A twinge', 'Yes, it hurt', 'Sharp pain'])
        : scaleRow(muscle, 'joint', 'Joints', ['Fine', 'Niggle', 'Painful', 'Sharp']),
    ));
  }
  panel.append(grid);

  panel.append(h('div', { class: 'row', style: 'justify-content:flex-end' },
    h('button', { onClick: () => dialog.remove() }, 'Back'),
    h('button', {
      class: 'btn-primary',
      onClick: () => {
        const session = store.finishSession();
        rest.stop();
        dialog.remove();
        render();
        showSummary(session);
      },
    }, 'Save session'),
  ));

  dialog.append(panel);
  dialog.addEventListener('click', (ev) => { if (ev.target === dialog) dialog.remove(); });
  document.body.append(dialog);
}

function scaleRow(muscle, field, label, options) {
  const current = store.state.active?.feedback?.[muscle]?.[field];
  const row = h('div', { class: 'feedback-row', style: 'margin-bottom:6px' },
    h('span', { class: 'small secondary' }, label),
  );
  const scale = h('div', { class: 'scale' });
  options.forEach((text, value) => {
    scale.append(h('button', {
      class: 'btn-sm', 'aria-pressed': String(current === value),
      onClick: (ev) => {
        store.setFeedback(muscle, { [field]: value });
        for (const sib of scale.children) sib.setAttribute('aria-pressed', 'false');
        ev.currentTarget.setAttribute('aria-pressed', 'true');
      },
    }, text));
  });
  row.append(scale);
  return row;
}

function showSummary(session) {
  if (!session) return;
  const unit = store.state.settings.unit;
  const sets = session.entries.reduce((n, e) => n + e.sets.length, 0);
  const volume = session.entries.reduce((n, e) => n + tonnage(e.sets), 0);
  const prs = session.entries.map((e) => {
    const best = bestSet(e.sets);
    if (!best) return null;
    const now = e1rm(best.weight, best.reps, best.rir ?? 0);
    const before = e.prescription?.e1rmBefore ?? 0;
    return before && now > before * 1.005
      ? { name: getExercise(e.exerciseId)?.name, gain: now - before, now }
      : null;
  }).filter(Boolean);

  const dialog = h('div', {
    style: 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:50;display:grid;place-items:center;padding:16px',
  });
  dialog.append(h('div', { class: 'card', style: 'max-width:460px;width:100%' },
    h('h2', {}, 'Session logged'),
    h('div', { class: 'grid grid-3', style: 'margin:16px 0' },
      h('div', { class: 'stat' }, h('span', { class: 'label' }, 'Sets'), h('span', { class: 'value num' }, String(sets))),
      h('div', { class: 'stat' }, h('span', { class: 'label' }, 'Volume'), h('span', { class: 'value num' }, `${Math.round(volume).toLocaleString()}${unit}`)),
      h('div', { class: 'stat' }, h('span', { class: 'label' }, 'Time'), h('span', { class: 'value num' }, fmtDuration(session.durationSec))),
    ),
    prs.length
      ? h('div', {},
          h('h4', {}, 'Estimated max moved up'),
          h('ul', { class: 'cues', style: 'margin-top:6px' },
            ...prs.map((p) => h('li', {}, `${p.name} — now ${Math.round(p.now)}${unit} (+${p.gain.toFixed(1)})`))),
        )
      : h('p', { class: 'secondary small' },
          'No estimated max moved today. That is normal inside a block - volume and effort ' +
          'climb first, and the strength shows up after the deload.'),
    h('div', { class: 'row', style: 'justify-content:flex-end;margin-top:14px' },
      h('button', { class: 'btn-primary', onClick: () => dialog.remove() }, 'Done'),
    ),
  ));
  dialog.addEventListener('click', (ev) => { if (ev.target === dialog) dialog.remove(); });
  document.body.append(dialog);
}

export { rest };
