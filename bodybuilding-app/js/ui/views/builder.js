/**
 * The program editor.
 *
 * Six templates cover six shapes. People arrive already running something else,
 * and "your split is not in the list" is where they stop using the app. So the
 * shape is editable - and only the shape. What goes on the bar, how many sets
 * week three gets, when the deload lands and how hard each set should be are
 * still the engine's job, because those are the parts people get wrong.
 *
 * The draft lives in this module and is only written to the store on Save, so
 * abandoning a half-built program leaves nothing behind.
 */

import { h, clear } from '../dom.js';
import { store } from '../../store.js';
import { getProgram } from '../../data/programs.js';
import { allExercises, getExercise } from '../../data/exercises.js';
import { MUSCLES, MUSCLE_DISPLAY_ORDER, muscleName } from '../../data/muscles.js';
import { newMesocycle, weekPlan, programTimeProfile, estimateSessionMinutes } from '../../engine/mesocycle.js';
import { plannedSetsByMuscle, volumeReport } from '../../engine/volume.js';
import { volumeChart } from '../charts.js';
import { muscleMap } from '../muscle-map.js';
import { confirmSheet, chooseSheet, alertSheet, openSheet, sheetHeader } from '../sheet.js';
import { routeParams, clearRouteParams, routeTo } from '../../util/route.js';
import {
  blankProgram, forkProgram, addDay, removeDay, updateDay, moveDay,
  addSlot, removeSlot, updateSlot, moveSlot, validate, isRunnable, weeklySets,
  ROLES, MAX_DAYS, MAX_SLOTS_PER_DAY, MIN_ACCUMULATION_WEEKS, MAX_ACCUMULATION_WEEKS,
} from '../../engine/program-builder.js';

let draft = null;
let openDay = null;
let root = null;

/** Common rep windows, in the words people would use for them. */
const REP_CHOICES = [
  { value: null, label: 'As the lift prefers', detail: 'Whatever suits that movement' },
  { value: [3, 5], label: '3–5 reps', detail: 'Strength' },
  { value: [5, 8], label: '5–8 reps', detail: 'Heavy, still building' },
  { value: [6, 10], label: '6–10 reps', detail: 'The usual compound range' },
  { value: [8, 12], label: '8–12 reps', detail: 'Classic hypertrophy' },
  { value: [10, 15], label: '10–15 reps', detail: 'Isolation, machines' },
  { value: [12, 20], label: '12–20 reps', detail: 'Pump work, small muscles' },
];

export function render(container) {
  if (container) root = container;
  if (!root) return;
  if (container) consumeIntent();
  if (!draft) draft = blankProgram();

  clear(root);
  const wrap = h('div', { class: 'stack builder' });
  const problems = validate(draft);
  const runnable = !problems.some((p) => p.level === 'error');

  wrap.append(head());
  wrap.append(shapeCard());
  for (const day of draft.days) wrap.append(dayCard(day));

  if (draft.days.length < MAX_DAYS) {
    wrap.append(h('button', { class: 'btn-lg addday', onClick: () => { draft = addDay(draft); render(); } },
      `+ Add a day`));
  }

  if (runnable) wrap.append(costCard());
  if (problems.length) wrap.append(problemsCard(problems));
  wrap.append(actions(runnable));

  root.append(wrap);
}

/* ------------------------------------------------------------- arriving */

function consumeIntent() {
  const params = routeParams();
  const edit = params.get('program');
  const fork = params.get('fork');
  const fresh = params.get('new');

  // Coming back from the exercise editor with a lift that did not exist when
  // we left. The draft is untouched - only the new lift is added.
  const added = params.get('add');
  const addTo = params.get('day');
  if (added && addTo) {
    clearRouteParams();
    if (draft && getExercise(added)) {
      draft = addSlot(draft, addTo, added);
      openDay = addTo;
    }
    return;
  }

  if (!edit && !fork && !fresh) return;
  clearRouteParams();
  openDay = null;

  if (edit) {
    const existing = store.customPrograms().find((p) => p.id === edit);
    draft = existing ? { ...existing } : blankProgram();
    return;
  }
  if (fork) {
    const source = getProgram(fork);
    draft = source ? forkProgram(source) : blankProgram();
    openDay = draft.days[0]?.id ?? null;
    return;
  }
  draft = blankProgram();
  openDay = draft.days[0]?.id ?? null;
}

/** The draft being edited, for tests and for anything that needs to inspect it. */
export function currentDraft() {
  return draft;
}

/** Start the editor somewhere specific, without going through the URL. */
export function startFrom(program) {
  draft = program;
  openDay = program.days[0]?.id ?? null;
}

/* ---------------------------------------------------------------- pieces */

function head() {
  const name = h('input', {
    class: 'builder-name', value: draft.name, 'aria-label': 'Program name',
    placeholder: 'Name it',
    onInput: (ev) => { draft = { ...draft, name: ev.target.value }; refreshSummary(); },
  });
  return h('div', { class: 'page-head builder-head' },
    name,
    h('div', { class: 'row' },
      h('p', { class: 'builder-summary small muted', style: 'margin:0' }, summaryLine()),
      h('span', { style: 'margin-left:auto' }, discardButton()),
    ),
  );
}

function summaryLine() {
  const sets = weeklySets(draft);
  const days = draft.days.length;
  return `${days} day${days === 1 ? '' : 's'} a week · ${sets} sets to start · `
    + `${draft.accumulationWeeks} weeks then a deload`;
}

function refreshSummary() {
  const node = root?.querySelector('.builder-summary');
  if (node) node.textContent = summaryLine();
}

function shapeCard() {
  return h('div', { class: 'panel' },
    h('div', { class: 'panel-head' },
      h('h3', {}, 'Block length'),
      h('span', { class: 'muted small' }, `${draft.accumulationWeeks} + deload`),
    ),
    h('div', { class: 'week-strip', style: 'margin-top:10px' },
      ...weekOptions().map((n) => h('button', {
        class: 'week-pill', 'aria-pressed': String(n === draft.accumulationWeeks),
        onClick: () => { draft = { ...draft, accumulationWeeks: n }; render(); },
      }, `${n} weeks`)),
    ),
    h('p', { class: 'tiny muted', style: 'margin:10px 0 0' },
      'Volume climbs across these weeks and effort creeps towards failure, then the deload '
      + 'drops both so the work turns into muscle. Four is the usual answer.'),
  );
}

function weekOptions() {
  const out = [];
  for (let n = MIN_ACCUMULATION_WEEKS; n <= MAX_ACCUMULATION_WEEKS; n += 1) out.push(n);
  return out;
}

function dayCard(day) {
  const isOpen = openDay === day.id;
  const sets = day.slots.reduce((n, s) => n + s.sets, 0);
  const minutes = day.slots.length ? estimateSessionMinutes({ ...day, slots: day.slots }) : 0;

  const head = h('button', {
    class: 'daybar', onClick: () => { openDay = isOpen ? null : day.id; render(); },
    'aria-expanded': String(isOpen),
  },
    h('span', { class: 'daybar-name' }, day.name),
    h('span', { class: 'daybar-meta' },
      day.slots.length
        ? `${day.slots.length} lifts · ${sets} sets · ~${minutes} min`
        : 'empty'),
    h('span', { class: 'daybar-caret' }, isOpen ? '⌃' : '⌄'),
  );

  const card = h('div', { class: `panel daycard${isOpen ? ' is-open' : ''}` }, head);
  if (!isOpen) return card;

  card.append(h('div', { class: 'field', style: 'margin-top:12px' },
    h('label', {}, 'What to call it'),
    h('input', {
      value: day.name, placeholder: 'Push, Upper A, Legs…',
      onInput: (ev) => { draft = updateDay(draft, day.id, { name: ev.target.value }); refreshDayName(day.id, ev.target.value); },
    }),
  ));

  card.append(h('div', { class: 'slotlist' }, ...day.slots.map((slot, i) => slotRow(day, slot, i))));

  card.append(h('div', { class: 'row', style: 'margin-top:12px' },
    day.slots.length < MAX_SLOTS_PER_DAY && h('button', {
      class: 'btn-primary btn-sm',
      onClick: () => pickExercise(day),
    }, '+ Add exercise'),
    h('button', {
      class: 'btn-sm', disabled: draft.days.length < 2,
      onClick: () => { draft = moveDay(draft, day.id, -1); render(); },
    }, 'Move up'),
    h('button', {
      class: 'btn-danger btn-sm', style: 'margin-left:auto',
      onClick: async () => {
        const ok = day.slots.length === 0 || await confirmSheet({
          title: `Delete ${day.name}?`,
          body: 'The exercises on it go with it.',
          confirmLabel: 'Delete', danger: true,
        });
        if (ok) { draft = removeDay(draft, day.id); openDay = null; render(); }
      },
    }, 'Delete day'),
  ));

  return card;
}

/** Typing a day name should not rebuild the card under the keyboard. */
function refreshDayName(dayId, name) {
  const card = root?.querySelector('.daycard.is-open .daybar-name');
  if (card) card.textContent = name || 'Day';
  refreshSummary();
}

function slotRow(day, slot, index) {
  const exercise = getExercise(slot.exerciseId);
  const role = ROLES.find((r) => r.id === slot.role) ?? ROLES[2];
  const reps = slot.reps ?? exercise?.reps ?? null;

  return h('div', { class: 'slot' },
    h('button', {
      class: 'slot-map', type: 'button', 'aria-label': `What ${exercise?.name} trains`,
      onClick: () => showSlotDetail(day, slot),
    }, muscleMap(slot.exerciseId, { height: 42 })),

    h('div', { class: 'slot-body' },
      h('div', { class: 'slot-name' }, exercise?.name ?? slot.exerciseId),
      h('div', { class: 'slot-meta' },
        h('button', {
          class: 'slot-tag', type: 'button',
          onClick: async () => {
            const picked = await chooseSheet({
              title: 'What is this lift here for?',
              options: ROLES.map((r) => ({ value: r.id, label: r.label, detail: r.detail })),
              selected: slot.role,
            });
            if (picked) { draft = updateSlot(draft, day.id, slot.exerciseId, { role: picked }); render(); }
          },
        }, role.label),
        h('button', {
          class: 'slot-tag', type: 'button',
          onClick: async () => {
            const picked = await chooseSheet({
              title: 'Rep range',
              body: 'The window the engine keeps you inside before adding weight.',
              options: REP_CHOICES.map((c) => ({
                value: c.value ? c.value.join('-') : 'auto', label: c.label, detail: c.detail,
              })),
              selected: slot.reps ? slot.reps.join('-') : 'auto',
            });
            if (!picked) return;
            const value = picked === 'auto' ? null : picked.split('-').map(Number);
            draft = updateSlot(draft, day.id, slot.exerciseId, { reps: value });
            render();
          },
        }, reps ? `${reps[0]}–${reps[1]}` : 'auto'),
      ),
    ),

    h('div', { class: 'slot-sets' },
      h('button', {
        class: 'slot-step', 'aria-label': 'One set fewer',
        onClick: () => {
          if (slot.sets <= 1) return;
          draft = updateSlot(draft, day.id, slot.exerciseId, { sets: slot.sets - 1 });
          render();
        },
      }, '−'),
      h('span', { class: 'slot-count num' }, String(slot.sets)),
      h('button', {
        class: 'slot-step', 'aria-label': 'One set more',
        onClick: () => {
          draft = updateSlot(draft, day.id, slot.exerciseId, { sets: Math.min(8, slot.sets + 1) });
          render();
        },
      }, '+'),
    ),

    h('div', { class: 'reorder' },
      h('button', {
        'aria-label': 'Move up', disabled: index === 0,
        onClick: () => { draft = moveSlot(draft, day.id, slot.exerciseId, -1); render(); },
      }, '↑'),
      h('button', {
        'aria-label': 'Move down', disabled: index === day.slots.length - 1,
        onClick: () => { draft = moveSlot(draft, day.id, slot.exerciseId, 1); render(); },
      }, '↓'),
    ),
  );
}

function showSlotDetail(day, slot) {
  const exercise = getExercise(slot.exerciseId);
  if (!exercise) return;
  return openSheet((panel, finish) => {
    sheetHeader(panel, exercise.name);
    const body = h('div', { class: 'sheet-body' },
      h('div', { class: 'exercise-visual' },
        muscleMap(exercise.id, { height: 150, legend: true }),
      ),
      h('p', { class: 'small secondary' },
        `${exercise.type === 'compound' ? 'Compound' : 'Isolation'} · ${exercise.equipment} · `
        + exercise.primary.map(muscleName).join(', ')),
    );
    panel.append(body);
    panel.append(h('div', { class: 'sheet-actions' },
      h('button', { class: 'btn-primary btn-lg', onClick: () => finish(true) }, 'Close'),
      h('button', {
        class: 'btn-danger btn-lg',
        onClick: () => { draft = removeSlot(draft, day.id, slot.exerciseId); render(); finish(false); },
      }, 'Take it off this day'),
    ));
  });
}

/* ------------------------------------------------------- exercise picker */

/**
 * The picker is a search box because 69 lifts is too many to scroll and the
 * name is the one thing somebody definitely knows. Grouped by what it trains,
 * so browsing works too, and anything already on the day is shown as taken
 * rather than hidden - "where is bench press" is a worse question than "why is
 * bench press greyed out".
 */
function pickExercise(day) {
  return openSheet((panel, finish) => {
    sheetHeader(panel, `Add to ${day.name}`);
    const results = h('div', { class: 'picker-list' });
    const search = h('input', {
      type: 'search', placeholder: 'Search lifts…', 'aria-label': 'Search lifts',
      onInput: (ev) => draw(ev.target.value),
    });

    const taken = new Set(day.slots.map((s) => s.exerciseId));

    const draw = (query = '') => {
      clear(results);
      const q = query.trim().toLowerCase();
      const matches = allExercises().filter((e) =>
        !q || e.name.toLowerCase().includes(q)
        || e.primary.some((m) => muscleName(m).toLowerCase().includes(q))
        || e.equipment.toLowerCase().includes(q));

      if (!matches.length) {
        results.append(h('p', { class: 'small muted' }, 'Nothing matches that.'));
        return;
      }

      for (const muscle of MUSCLE_DISPLAY_ORDER) {
        const group = matches.filter((e) => e.primary[0] === muscle);
        if (!group.length) continue;
        results.append(h('h4', { class: 'picker-group' }, MUSCLES[muscle].name));
        for (const exercise of group) {
          const already = taken.has(exercise.id);
          results.append(h('button', {
            class: 'picker-row', disabled: already,
            onClick: () => {
              draft = addSlot(draft, day.id, exercise.id);
              taken.add(exercise.id);
              render();
              finish(exercise.id);
            },
          },
            h('span', { class: 'picker-name' }, exercise.name),
            h('span', { class: 'picker-meta' },
              already ? 'already on this day' : `${exercise.equipment} · ${exercise.type}`),
          ));
        }
      }
    };

    panel.append(h('div', { class: 'field' }, search));
    // The library cannot know about the one good machine in your gym, so the
    // way out of it is the first thing in the list rather than buried.
    panel.append(h('a', {
      class: 'btn picker-new',
      href: routeTo('/exercise', { new: 1, day: day.id }),
      onClick: () => finish(null),
    }, '+ Add a lift that is not here'));
    panel.append(results);
    panel.append(h('div', { class: 'sheet-actions' },
      h('button', { class: 'btn-lg', onClick: () => finish(null) }, 'Done'),
    ));
    draw();
  });
}

/* --------------------------------------------------------- what it costs */

/**
 * The part no template library gives you: what this shape actually does to each
 * muscle at the hardest week, against the range that muscle grows in. Building
 * a program blind is how people end up with 30 sets of chest and four of legs.
 */
function costCard() {
  const meso = newMesocycle(draft);
  const peak = weekPlan(meso, [], draft.accumulationWeeks - 1, { program: draft });
  const report = volumeReport(plannedSetsByMuscle(peak.days)).filter((r) => r.sets > 0);
  const time = programTimeProfile(draft);
  const thin = report.filter((r) => r.status.zone === 'below-mev');

  return h('details', { class: 'panel expandable', open: true },
    h('summary', {},
      h('h3', {}, 'What this asks of you'),
      h('span', { class: 'muted small' }, `${(time.weeklyPeak / 60).toFixed(1)} h at peak`),
    ),
    h('div', {},
      volumeChart(report),
      thin.length
        ? h('p', { class: 'small secondary', style: 'margin-top:10px' },
            h('b', {}, 'Light on: '), thin.map((r) => r.name).join(', '),
            ' — under the volume most people need to grow them. Fine if that is deliberate.')
        : h('p', { class: 'small secondary', style: 'margin-top:10px' },
            'Every muscle you train lands in a productive range at the hardest week.'),
    ),
  );
}

function problemsCard(problems) {
  return h('div', { class: 'stack', style: 'gap:8px' }, ...problems.map((p) => h('div', {
    class: `notice${p.level === 'error' ? ' is-critical' : ''}`,
  }, p.message)));
}

/* --------------------------------------------------------------- saving */

/**
 * One row, pinned. Three stacked buttons filled half a phone screen and hid the
 * fact that there were more days underneath.
 */
function actions(runnable) {
  const existing = store.customPrograms().some((p) => p.id === draft.id);
  return h('div', { class: 'builder-actions' },
    h('button', {
      class: 'btn-primary btn-lg', disabled: !runnable,
      onClick: () => save({ start: false }),
    }, existing ? 'Save changes' : 'Save program'),
    h('button', {
      class: 'btn-lg', disabled: !runnable,
      onClick: () => save({ start: true }),
    }, 'Save and start'),
  );
}

function discardButton() {
  return h('button', {
    class: 'btn-ghost btn-sm',
    onClick: async () => {
      const ok = await confirmSheet({
        title: 'Throw this away?',
        body: 'Nothing here has been saved yet.',
        confirmLabel: 'Discard', cancelLabel: 'Keep editing', danger: true,
      });
      if (ok) { draft = null; location.hash = '#/programs'; }
    },
  }, 'Discard');
}

async function save({ start }) {
  const saved = store.saveProgram(draft);
  if (!saved) {
    await alertSheet({ title: 'Not quite yet', body: 'Fix the problems listed and it will save.' });
    return;
  }
  draft = null;

  if (!start) {
    location.hash = '#/programs';
    return;
  }
  if (store.activeMeso()) {
    const ok = await confirmSheet({
      title: 'Start this block now?',
      body: 'The block you are running is archived where it is. Its history is kept.',
      confirmLabel: 'Start it', cancelLabel: 'Not yet',
    });
    if (!ok) { location.hash = '#/programs'; return; }
  }
  store.startMesocycle(saved.id, saved.name, store.state.settings.equipment);
  location.hash = '#/';
}
