/**
 * Card-based session logging.
 *
 * The grid of number inputs assumes you want to type. Mostly you do not: you
 * did roughly what the app told you to, and typing three numbers per set,
 * twenty times a session, with chalk on your hands, is the reason training logs
 * get abandoned in week three.
 *
 * So the app proposes and you confirm. One card per set, the predicted numbers
 * already filled in at a size you can read from arm's length, and a single
 * button that means "yes, that". Adjusting is a tap on a stepper, not a
 * keyboard. Typing is still there for the case where reality diverged badly,
 * but it is the exception rather than the interaction.
 *
 * The prediction is not a guess - it is the same progression engine that
 * writes the plan, so confirming is genuinely the common case.
 */

import { h, fmtWeight } from '../dom.js';
import { store } from '../../store.js';
import { getExercise } from '../../data/exercises.js';
import { muscleName, isPlural } from '../../data/muscles.js';
import { getMode } from '../../data/modes.js';
import { patternFor } from '../../data/patterns.js';
import { muscleMap } from '../muscle-map.js';
import { loadStep } from '../../engine/progression.js';
import { showTerm } from '../term.js';
import { chooseSheet, alertSheet, detailSheet } from '../sheet.js';
import { EFFORT_CHOICES, effortShort, warmupAdvice, reasonLine, tagLabel } from '../explain.js';

/* ------------------------------------------------------------- position */

/** The first set that has not been logged, in order. */
export function nextPosition(active) {
  for (let e = 0; e < active.entries.length; e++) {
    const entry = active.entries[e];
    for (let i = 0; i < entry.sets.length; i++) {
      if (!entry.sets[i].done) return { entryIndex: e, setIndex: i };
    }
  }
  return null;
}

export function sessionProgress(active) {
  let done = 0;
  let total = 0;
  for (const entry of active.entries) {
    for (const set of entry.sets) { total += 1; if (set.done) done += 1; }
  }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

/* ------------------------------------------------------------ the card */

/**
 * @param {object} opts
 * @param {Function} opts.onChange   re-render after a store write
 * @param {Function} opts.onRest     start the rest timer
 * @param {Function} opts.onFinish   session complete
 */
export function setCard(active, position, opts) {
  const entry = active.entries[position.entryIndex];
  const set = entry.sets[position.setIndex];
  const p = entry.prescription;
  const exercise = getExercise(entry.exerciseId);
  const unit = store.state.settings.unit;
  const mode = getMode(active.mode);
  const plain = store.plainLanguage();

  // Writing to the store must NOT re-render: doing so replaces the input the
  // person is typing into, which on a phone closes the keyboard mid-number.
  // The card updates the few things that depend on these values by hand.
  const quiet = (patch) => store.logSet(entry.exerciseId, position.setIndex, patch);
  const commit = (patch) => { quiet(patch); opts.onChange(); };

  const card = h('div', { class: 'setcard' });

  /* --- which set, of what ------------------------------------------- */
  card.append(h('div', { class: 'setcard-head' },
    // The map is small here on purpose: enough to confirm at a glance that you
    // are about to train what you think you are, not a diagram to study.
    h('button', {
      class: 'setcard-map', type: 'button',
      'aria-label': `What ${exercise.name} trains`,
      onClick: () => showExercise(exercise),
    }, muscleMap(exercise.id, { height: 54 })),
    h('div', { style: 'flex:1;min-width:0' },
      h('div', { class: 'setcard-exercise' }, exercise.name),
      h('div', { class: 'setcard-meta' },
        `Set ${position.setIndex + 1} of ${entry.sets.length} · `,
        exercise.primary.map(muscleName).join(', '),
      ),
    ),
    h('button', {
      class: 'btn-ghost btn-sm', title: 'Jump to another exercise',
      onClick: () => opts.onJump?.(),
    }, 'All'),
  ));

  /* --- the numbers, big --------------------------------------------- */
  // What to propose, in order of how much it is worth trusting: what is already
  // on this set, then whatever the lifter actually did earlier in this exercise
  // today, then the plan. The middle one is what stops a first-ever lift asking
  // for the same two numbers on every set.
  const logged = entry.sets.filter((x) => x.done && x.weight != null);
  const lastDone = logged[logged.length - 1] ?? null;
  let currentWeight = set.weight ?? lastDone?.weight ?? p.weight;
  let currentReps = set.reps ?? lastDone?.reps ?? p.targetReps;
  const step = loadStep(exercise, currentWeight ?? 20, unit);

  const done = h('button', { class: 'btn-primary setcard-done' });
  const refreshDone = () => {
    const missing = currentWeight == null;
    done.disabled = missing;
    done.textContent = missing
      ? 'Set the weight first'
      : `Done — ${fmtWeight(currentWeight, unit)} × ${currentReps}`;
  };

  card.append(h('div', { class: 'setcard-numbers' },
    stepper({
      label: `Weight (${unit})`,
      value: currentWeight,
      placeholder: '—',
      step,
      min: 0,
      onCommit: (v) => { currentWeight = v; store.editSet(entry.exerciseId, position.setIndex, { weight: v }); refreshDone(); },
    }),
    h('div', { class: 'setcard-times' }, '×'),
    stepper({
      label: 'Reps',
      value: currentReps,
      step: 1,
      min: 1,
      onCommit: (v) => { currentReps = v; store.editSet(entry.exerciseId, position.setIndex, { reps: v }); refreshDone(); },
    }),
  ));

  // One line, not a paragraph. The full reasoning is a tap away for the people
  // who want it and out of the way for the people mid-set.
  if (currentWeight == null) {
    card.append(h('p', { class: 'setcard-hint' }, 'New lift — set your weight. Bodyweight? Enter 0.'));
  } else if (p.previous) {
    card.append(h('div', { class: 'lastline' },
      h('span', { class: 'lastline-label' }, 'Last'),
      h('span', {}, `${fmtWeight(p.previous.weight, unit)} × ${p.previous.reps}`),
      p.previous.rir != null && h('span', { class: 'muted' }, effortShort(p.previous.rir).toLowerCase()),
      h('button', {
        class: 'lastline-why', type: 'button',
        onClick: () => alertSheet({ title: tagLabel(p.tag), body: reasonLine(p, unit) }),
      }, 'why?'),
    ));
  }

  if (p.tempo) {
    card.append(h('p', { class: 'setcard-tempo' }, p.tempo.note));
  }

  /* --- confirm ------------------------------------------------------- */
  done.addEventListener('click', () => {
    quiet({
      done: true,
      weight: currentWeight ?? 0,
      reps: currentReps,
      // Effort is asked straight after, so it is left blank rather than
      // assumed - an invented RIR is worse than a missing one.
      rir: set.rir ?? null,
    });
    opts.onLogged?.(entry, position);
  });
  refreshDone();
  card.append(done);

  card.append(h('div', { class: 'setcard-secondary' },
    h('button', {
      class: 'btn-sm',
      onClick: () => { store.logSet(entry.exerciseId, position.setIndex, { warmup: !set.warmup }); opts.onChange(); },
      'aria-pressed': String(Boolean(set.warmup)),
    }, set.warmup ? 'Warm-up set ✓' : 'This was a warm-up'),
    h('button', {
      class: 'btn-sm',
      onClick: async () => {
        const picked = await chooseSheet({
          title: `Swap ${exercise.name}`,
          body: 'Machine taken, or something hurts? These train the same muscle.',
          options: exercise.subs.map((id) => {
            const alt = getExercise(id);
            return {
              value: id,
              label: alt.name,
              detail: `${alt.equipment} · ${alt.reps[0]}-${alt.reps[1]} reps · ${alt.primary.map(muscleName).join(', ')}`,
              visual: () => muscleMap(id, { height: 46 }),
            };
          }),
        });
        if (picked) { store.swapExercise(entry.exerciseId, picked); opts.onChange(); }
      },
      disabled: !exercise.subs.length,
    }, 'Swap exercise'),
    h('button', {
      class: 'btn-sm',
      onClick: () => { store.addSet(entry.exerciseId); opts.onChange(); },
    }, '+ Extra set'),
    // The rack being busy is the single most common reason to want a different
    // order, and it needs to be one tap from the set you are looking at.
    // Available part-way through too: somebody taking the bench between your
    // sets is exactly the moment you need it, and the sets you have already
    // logged stay logged.
    !entry.sets.every((x) => x.done) && h('button', {
      class: 'btn-sm',
      title: 'Move this to the end and get on with something else',
      onClick: () => { store.deferEntry(entry.exerciseId); opts.onChange(); },
    }, 'Do later'),
  ));

  /* --- coaching, where the mode asks for it -------------------------- */
  if (mode.showCues && exercise.cues.length) {
    card.append(h('details', { class: 'setcard-cues' },
      h('summary', {}, plain ? 'How do I do this properly?' : 'Technique cues'),
      h('ul', { class: 'cues' }, ...exercise.cues.map((c) => h('li', {}, c))),
    ));
  }
  if (plain) {
    card.append(h('details', { class: 'warmup' },
      h('summary', {}, 'How do I warm up for this?'),
      h('ul', { class: 'cues' }, ...warmupAdvice(exercise, currentWeight, unit).map((l) => h('li', {}, l))),
    ));
  }

  return card;
}

/** The full picture, cues and pattern - one tap from the set you are doing. */
export function showExercise(exercise) {
  const pattern = patternFor(exercise.id);
  return detailSheet({
    title: exercise.name,
    build: (panel) => {
      panel.append(muscleMap(exercise.id, { height: 150, legend: true }));
      if (pattern) {
        panel.append(h('div', { class: 'pattern' },
          h('h4', {}, pattern.name),
          h('div', { class: 'pattern-ends' },
            h('div', {}, h('span', { class: 'pattern-tag' }, 'Start'), h('span', {}, pattern.bottom)),
            h('div', {}, h('span', { class: 'pattern-tag' }, 'Finish'), h('span', {}, pattern.top)),
          ),
          h('p', { class: 'pattern-watch' }, pattern.watch),
        ));
      }
      if (exercise.cues.length) {
        panel.append(h('h4', { style: 'margin-top:16px' }, 'Cues'));
        panel.append(h('ul', { class: 'cues' }, ...exercise.cues.map((c) => h('li', {}, c))));
      }
    },
  });
}

/**
 * A number you change by tapping, with typing as the fallback.
 *
 * It owns its own value and updates its own input, so nothing above needs to
 * re-render while someone is mid-edit. The steppers are the interaction; the
 * field is the escape hatch for when reality diverged badly from the plan.
 */
function stepper({ label, value, step, min = 0, onCommit, placeholder }) {
  let current = value;
  const input = h('input', {
    type: 'number', inputmode: 'decimal', step: 'any',
    value: value ?? '', placeholder: placeholder ?? '',
    'aria-label': label,
  });

  // Buttons set the value and write it back to the field.
  const apply = (next) => {
    current = next == null ? null : Math.max(min, Math.round(next * 100) / 100);
    input.value = current ?? '';
    onCommit(current);
  };

  // Typing updates the value but must not rewrite the field underneath the
  // person doing the typing. `input` rather than `change` because `change`
  // only fires on blur: someone who types a weight and immediately taps Done
  // would otherwise have the number silently dropped.
  input.addEventListener('input', () => {
    const raw = input.value;
    current = raw === '' ? null : Math.max(min, Number(raw));
    onCommit(Number.isFinite(current) ? current : null);
  });

  return h('div', { class: 'stepper' },
    h('span', { class: 'stepper-label' }, label),
    h('div', { class: 'stepper-controls' },
      h('button', {
        class: 'stepper-btn', type: 'button', 'aria-label': `Decrease ${label}`,
        onClick: () => apply((current ?? 0) - step),
      }, '\u2212'),
      input,
      h('button', {
        class: 'stepper-btn', type: 'button', 'aria-label': `Increase ${label}`,
        onClick: () => apply((current ?? 0) + step),
      }, '+'),
    ),
  );
}

/* ------------------------------------------------- the effort question */

/**
 * Asked once per set, immediately, in words. This is the one number the engine
 * cannot predict for you - everything else it already knows.
 */
export function effortCard(active, position, opts) {
  const entry = active.entries[position.entryIndex];
  const set = entry.sets[position.setIndex];
  const exercise = getExercise(entry.exerciseId);
  const unit = store.state.settings.unit;

  const card = h('div', { class: 'setcard is-effort' });
  card.append(
    h('div', { class: 'setcard-logged' },
      `Logged · ${fmtWeight(set.weight, unit)} × ${set.reps}`,
      h('button', {
        class: 'btn-ghost btn-sm',
        onClick: () => { store.logSet(entry.exerciseId, position.setIndex, { done: false }); opts.onChange(); },
      }, 'Undo'),
    ),
    h('h2', { class: 'setcard-question' }, 'How many more could you have done?'),
    h('p', { class: 'setcard-hint' },
      h('button', { class: 'term', type: 'button', onClick: () => showTerm('rir') }, 'Why this matters'),
    ),
  );

  const options = h('div', { class: 'bigchoice' });
  for (const choice of EFFORT_CHOICES) {
    options.append(h('button', {
      class: 'bigchoice-option',
      onClick: () => {
        store.logSet(entry.exerciseId, position.setIndex, { rir: choice.rir });
        opts.onAnswered?.(entry, position);
      },
    },
      h('span', { class: 'bigchoice-label' }, choice.label),
      h('span', { class: 'bigchoice-detail' }, choice.detail),
    ));
  }
  card.append(options);

  card.append(h('button', {
    class: 'btn-ghost setcard-skip',
    onClick: () => {
      store.logSet(entry.exerciseId, position.setIndex, { rir: entry.prescription.targetRir });
      opts.onAnswered?.(entry, position);
    },
  }, `Skip — it felt about as planned (${entry.prescription.targetRir} left)`));

  return card;
}

/* --------------------------------------------- per-exercise check-ins */

/**
 * Asked once, after the last set of an exercise, and only where the mode cares.
 * Beginner mode gates load on these answers; advanced mode uses the side
 * reports to find asymmetries nobody otherwise measures.
 */
export function exerciseCheckCard(active, entry, opts) {
  const mode = getMode(active.mode);
  const exercise = getExercise(entry.exerciseId);
  const checks = mode.setChecks.filter((c) => c !== 'side' || exercise.unilateral);
  if (!checks.length) return null;

  const card = h('div', { class: 'setcard is-check' });
  card.append(h('h2', { class: 'setcard-question' }, `${exercise.name} — done`));

  if (checks.includes('form')) {
    card.append(question({
      title: 'How did the technique hold up?',
      hint: mode.holdOnPoorForm
        ? 'If form broke down, the weight will not go up next week. That is the point.'
        : null,
      options: [
        { value: 0, label: 'Clean', detail: 'Same on the last rep as the first' },
        { value: 1, label: 'A bit shaky', detail: 'Held together, but I had to work at it' },
        { value: 2, label: 'Broke down', detail: 'Position went, or I needed help' },
      ],
      selected: entry.form,
      onPick: (v) => { store.setEntryField(entry.exerciseId, 'form', v); opts.onChange(); },
    }));
  }

  if (checks.includes('connection')) {
    card.append(question({
      title: `Did you feel your ${muscleName(exercise.primary[0]).toLowerCase()} working?`,
      hint: 'Feeling the right muscle do the work is a skill, and it is most of what ' +
            'separates a productive set from just moving a weight.',
      options: [
        { value: 2, label: 'Definitely', detail: 'That muscle was clearly doing the job' },
        { value: 1, label: 'A bit', detail: 'Some of it, some elsewhere' },
        { value: 0, label: 'Not really', detail: 'Felt it everywhere except there' },
      ],
      selected: entry.connection,
      onPick: (v) => { store.setEntryField(entry.exerciseId, 'connection', v); opts.onChange(); },
    }));
  }

  if (checks.includes('side')) {
    card.append(question({
      title: 'Which side was harder?',
      hint: 'Side-to-side differences are near universal and almost never measured. ' +
            'A few sessions of this and the app can tell you which one to lead with.',
      options: [
        { value: 'left', label: 'Left', detail: 'Left side struggled more' },
        { value: 'even', label: 'Even', detail: 'No real difference' },
        { value: 'right', label: 'Right', detail: 'Right side struggled more' },
      ],
      selected: entry.side,
      onPick: (v) => { store.setEntryField(entry.exerciseId, 'side', v); opts.onChange(); },
    }));
  }

  card.append(h('button', { class: 'btn-primary setcard-done', onClick: () => opts.onNext?.() }, 'Next exercise'));
  return card;
}

export function question({ title, hint, options, selected, onPick }) {
  const block = h('div', { class: 'question' },
    h('h3', {}, title),
    hint && h('p', { class: 'setcard-hint' }, hint),
  );
  const row = h('div', { class: 'bigchoice' });
  for (const option of options) {
    row.append(h('button', {
      class: 'bigchoice-option',
      'aria-pressed': String(selected === option.value),
      onClick: () => onPick(option.value),
    },
      h('span', { class: 'bigchoice-label' }, option.label),
      h('span', { class: 'bigchoice-detail' }, option.detail),
    ));
  }
  block.append(row);
  return block;
}
