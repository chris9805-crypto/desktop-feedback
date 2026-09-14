/**
 * Adding a lift of your own.
 *
 * The muscle tags are the substance here. Where a movement is felt is not a
 * fact a library can hold for you - two people doing the same machine row
 * genuinely feel it in different places, and the one doing the set is the only
 * one who knows. So that question is asked plainly, with the body map filling
 * in as it is answered, and everything else on the screen has a default good
 * enough to ignore.
 */

import { h, clear } from '../dom.js';
import { store } from '../../store.js';
import { getExercise, allExercises } from '../../data/exercises.js';
import { MUSCLES, MUSCLE_DISPLAY_ORDER, muscleName } from '../../data/muscles.js';
import { muscleMap } from '../muscle-map.js';
import { confirmSheet, alertSheet, chooseSheet } from '../sheet.js';
import { routeParams, clearRouteParams, routeTo } from '../../util/route.js';
import {
  blankExercise, forkExercise, normalise, validate, isSaveable,
  defaultsFor, creditLine, EQUIPMENT, isCustomExerciseId,
} from '../../engine/exercise-builder.js';

let draft = null;
let returnTo = null;     // { day } - the builder day that sent us here
let root = null;

const REP_CHOICES = [
  { value: [3, 5], label: '3–5 reps' },
  { value: [5, 8], label: '5–8 reps' },
  { value: [6, 10], label: '6–10 reps' },
  { value: [8, 12], label: '8–12 reps' },
  { value: [10, 15], label: '10–15 reps' },
  { value: [12, 20], label: '12–20 reps' },
];

export function render(container) {
  if (container) root = container;
  if (!root) return;
  if (container) consumeIntent();
  if (!draft) draft = blankExercise();

  clear(root);
  const problems = validate(draft, { existing: store.customExercises() });
  const saveable = !problems.some((p) => p.level === 'error');

  const wrap = h('div', { class: 'stack builder' });
  wrap.append(head());
  wrap.append(feelCard());
  wrap.append(kitCard());
  wrap.append(detailCard());
  if (problems.length) wrap.append(problemsCard(problems));
  wrap.append(actions(saveable));
  root.append(wrap);
}

function consumeIntent() {
  const params = routeParams();
  const edit = params.get('exercise');
  const copy = params.get('copy');
  const fresh = params.get('new');
  const day = params.get('day');
  if (!edit && !copy && !fresh) return;
  clearRouteParams();
  returnTo = day ? { day } : null;

  if (edit) {
    const existing = store.customExercises().find((e) => e.id === edit);
    draft = existing ? { ...existing } : blankExercise();
    return;
  }
  if (copy) {
    const source = getExercise(copy);
    draft = source ? forkExercise(source) : blankExercise();
    return;
  }
  draft = blankExercise({ name: params.get('name') ?? '' });
}

/* ---------------------------------------------------------------- pieces */

function head() {
  return h('div', { class: 'page-head builder-head' },
    h('input', {
      class: 'builder-name', value: draft.name, 'aria-label': 'Exercise name',
      placeholder: 'What do you call it?',
      onInput: (ev) => { draft = { ...draft, name: ev.target.value }; },
    }),
    h('p', { class: 'small muted', style: 'margin-top:8px' },
      'Whatever you call it in the gym. "Hammer row", "the good leg press", anything.'),
  );
}

/**
 * The question that matters.
 *
 * One list, not two. Tapping a muscle cycles it: nothing, then where you feel
 * it most, then a bit. Two separate sixteen-chip grids made a screen you had to
 * scroll to tell apart, and made "a muscle cannot be both" a surprise instead
 * of something the control simply cannot express.
 */
function feelCard() {
  const tagged = draft.primary.length + draft.secondary.length;
  const preview = draft.primary.length
    ? muscleMap(draft.id, { height: 150, legend: true, exercise: draft })
    : h('p', { class: 'small muted', style: 'text-align:center;padding:24px 0' },
        'Tap a muscle and the map fills in.');

  return h('div', { class: 'panel' },
    h('div', { class: 'panel-head' },
      h('h3', {}, 'Where do you feel it?'),
      tagged
        ? h('span', { class: 'muted small' }, `${tagged} tagged`)
        : h('span', { class: 'badge badge-warning' }, 'needed'),
    ),
    h('div', { class: 'musclemap-preview' }, preview),
    h('p', { class: 'tiny muted', style: 'margin:12px 0 8px' },
      'Tap once for the muscles this really works, twice for the ones just along for '
      + 'the ride. The same machine is not the same lift for everybody — this is your answer, '
      + 'and it is what your sets get counted towards.'),
    musclePicker(),
    creditLine(draft) && h('p', { class: 'tiny muted', style: 'margin-top:12px' },
      h('b', {}, 'One set counts as: '), creditLine(draft)),
  );
}

/** Off, mainly, a bit - in that order, and back to off. */
function musclePicker() {
  return h('div', { class: 'musclepicker' }, ...MUSCLE_DISPLAY_ORDER.map((id) => {
    const level = draft.primary.includes(id) ? 'primary'
      : draft.secondary.includes(id) ? 'secondary' : 'off';
    return h('button', {
      class: `musclechip is-${level}`,
      'aria-pressed': String(level !== 'off'),
      'aria-label': `${MUSCLES[id].name}: ${level === 'primary' ? 'main mover'
        : level === 'secondary' ? 'assisting' : 'not involved'}`,
      onClick: () => {
        const primary = draft.primary.filter((m) => m !== id);
        const secondary = draft.secondary.filter((m) => m !== id);
        if (level === 'off') primary.push(id);
        else if (level === 'primary') secondary.push(id);
        draft = normalise({ ...draft, primary, secondary });
        render();
      },
    },
      MUSCLES[id].name,
      level === 'secondary' && h('span', { class: 'musclechip-half' }, '\u00bd'),
    );
  }));
}

function kitCard() {
  return h('div', { class: 'panel' },
    h('div', { class: 'panel-head' }, h('h3', {}, 'What kind of thing is it?')),
    h('div', { class: 'platepicker', style: 'margin-top:10px' },
      ...EQUIPMENT.map((kit) => h('button', {
        class: 'platechip', 'aria-pressed': String(draft.equipment === kit.id),
        onClick: () => {
          // Moving to different kit re-derives the things that follow from it,
          // unless they have been set by hand.
          const defaults = defaultsFor(kit.id, draft.type);
          draft = normalise({
            ...draft,
            equipment: kit.id,
            inc: draft.incTouched ? draft.inc : defaults.inc,
            stability: defaults.stability,
          });
          render();
        },
      }, kit.label)),
    ),
    h('div', { class: 'seg', style: 'margin-top:14px' },
      ...[['isolation', 'One muscle'], ['compound', 'Several muscles']].map(([value, label]) => h('button', {
        'aria-pressed': String(draft.type === value),
        onClick: () => {
          const defaults = defaultsFor(draft.equipment, value);
          draft = normalise({ ...draft, type: value, stability: defaults.stability });
          render();
        },
      }, label)),
    ),
    h('p', { class: 'tiny muted', style: 'margin-top:8px' },
      draft.stability === 'low'
        ? 'Heavy barbell work: the app will keep you further from failure on this.'
        : draft.stability === 'high'
          ? 'Stable enough to push right up to failure safely.'
          : 'The app will let you work close to failure, but not grind it out.'),
  );
}

function detailCard() {
  const unit = store.state.settings.unit;
  return h('details', { class: 'panel expandable' },
    h('summary', {},
      h('h3', {}, 'The fiddly bits'),
      h('span', { class: 'muted small' }, `${draft.reps[0]}–${draft.reps[1]} reps · +${draft.inc}${unit}`),
    ),
    h('div', {},
      h('div', { class: 'field' },
        h('label', {}, 'Rep range it is good at'),
        h('div', { class: 'platepicker' }, ...REP_CHOICES.map((choice) => h('button', {
          class: 'platechip',
          'aria-pressed': String(draft.reps[0] === choice.value[0] && draft.reps[1] === choice.value[1]),
          onClick: () => { draft = normalise({ ...draft, reps: choice.value }); render(); },
        }, choice.label))),
      ),
      h('div', { class: 'field' },
        h('label', {}, `Smallest weight jump (${unit})`),
        h('input', {
          type: 'number', value: String(draft.inc), min: '0.25', step: '0.25',
          inputmode: 'decimal',
          onInput: (ev) => {
            const value = Number(ev.target.value);
            if (value > 0) draft = { ...draft, inc: value, incTouched: true };
          },
        }),
        h('p', { class: 'tiny muted', style: 'margin:4px 0 0' },
          'The smallest step this machine or rack actually has.'),
      ),
      h('div', { class: 'field' },
        h('div', { class: 'row' },
          h('button', {
            class: 'seg', 'aria-pressed': String(Boolean(draft.unilateral)),
            style: `padding:6px 12px;${draft.unilateral ? 'background:var(--accent);color:var(--accent-ink);border-color:var(--accent)' : ''}`,
            onClick: () => { draft = { ...draft, unilateral: !draft.unilateral }; render(); },
          }, draft.unilateral ? 'On' : 'Off'),
          h('span', {}, 'One side at a time'),
        ),
        h('p', { class: 'tiny muted', style: 'margin:4px 0 0' },
          'Single-arm or single-leg. The app will ask which side felt weaker.'),
      ),
    ),
  );
}

function problemsCard(problems) {
  return h('div', { class: 'stack', style: 'gap:8px' }, ...problems.map((p) => h('div', {
    class: `notice${p.level === 'error' ? ' is-critical' : ''}`,
  }, p.message)));
}

function actions(saveable) {
  const existing = store.customExercises().some((e) => e.id === draft.id);
  return h('div', { class: 'builder-actions' },
    h('button', {
      class: 'btn-primary btn-lg', disabled: !saveable,
      onClick: () => save(),
    }, existing ? 'Save changes' : (returnTo ? 'Add it' : 'Save lift')),
    h('button', {
      class: 'btn-lg',
      onClick: async () => {
        const ok = await confirmSheet({
          title: 'Throw this away?',
          body: 'Nothing here has been saved yet.',
          confirmLabel: 'Discard', cancelLabel: 'Keep editing', danger: true,
        });
        if (ok) leave(null);
      },
    }, 'Cancel'),
  );
}

function save() {
  const saved = store.saveExercise(draft);
  if (!saved) return;
  draft = null;
  leave(saved.id);
}

/** Back where we came from - and if the builder sent us, carrying the new lift. */
function leave(exerciseId) {
  const day = returnTo?.day;
  returnTo = null;
  draft = null;
  location.hash = day && exerciseId
    ? routeTo('/build', { add: exerciseId, day })
    : '#/exercises';
}
