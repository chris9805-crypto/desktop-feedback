/** Exercise library: what each movement trains, how to do it, what replaces it. */

import { h, clear } from '../dom.js';
import { EXERCISES, getExercise } from '../../data/exercises.js';
import { MUSCLE_DISPLAY_ORDER, muscleName } from '../../data/muscles.js';
import { patternFor } from '../../data/patterns.js';
import { muscleMap } from '../muscle-map.js';

const EQUIPMENT = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'];

let filters = { muscle: '', equipment: '', query: '' };

export function render(container) {
  clear(container);
  const wrap = h('div', { class: 'stack' });

  wrap.append(h('div', { class: 'page-head' },
    h('h1', {}, 'Exercise library'),
    h('p', {},
      `${EXERCISES.length} movements, each mapped to the muscles it actually trains, the rep ` +
      'range it is good at, and the substitutes that train the same thing when the rack is taken.'),
  ));

  const list = h('div', { class: 'stack' });

  const controls = h('div', { class: 'filter-row' },
    h('input', {
      type: 'search', placeholder: 'Search movements…', value: filters.query,
      'aria-label': 'Search exercises',
      onInput: (ev) => { filters.query = ev.target.value; draw(list); },
    }),
    h('select', {
      'aria-label': 'Filter by muscle',
      onChange: (ev) => { filters.muscle = ev.target.value; draw(list); },
    },
      h('option', { value: '' }, 'All muscles'),
      ...MUSCLE_DISPLAY_ORDER.map((m) => h('option', { value: m, selected: filters.muscle === m }, muscleName(m))),
    ),
    h('select', {
      'aria-label': 'Filter by equipment',
      onChange: (ev) => { filters.equipment = ev.target.value; draw(list); },
    },
      h('option', { value: '' }, 'All equipment'),
      ...EQUIPMENT.map((e) => h('option', { value: e, selected: filters.equipment === e }, e[0].toUpperCase() + e.slice(1))),
    ),
  );

  wrap.append(controls, list);
  draw(list);
  container.append(wrap);
}

function draw(list) {
  clear(list);
  const q = filters.query.trim().toLowerCase();
  const matches = EXERCISES.filter((ex) => {
    if (filters.muscle && !ex.primary.includes(filters.muscle) && !ex.secondary.includes(filters.muscle)) return false;
    if (filters.equipment && ex.equipment !== filters.equipment) return false;
    if (q && !ex.name.toLowerCase().includes(q)) return false;
    return true;
  });

  if (!matches.length) {
    list.append(h('div', { class: 'empty' }, h('h3', {}, 'Nothing matches'), h('p', {}, 'Try a broader filter.')));
    return;
  }

  list.append(h('p', { class: 'small muted' }, `${matches.length} movement${matches.length === 1 ? '' : 's'}`));
  for (const ex of matches) list.append(card(ex));
}

function card(ex) {
  const pattern = patternFor(ex.id);
  return h('div', { class: 'card' },
    h('div', { class: 'card-head' },
      h('div', {},
        h('h3', {}, ex.name),
        h('div', { class: 'small muted' },
          `${ex.type === 'compound' ? 'Compound' : 'Isolation'} · ${ex.equipment}` +
          (ex.unilateral ? ' · one side at a time' : '')),
      ),
      h('span', { class: 'badge' }, `${ex.reps[0]}–${ex.reps[1]} reps`),
    ),
    h('div', { class: 'exercise-visual' },
      muscleMap(ex.id, { height: 132 }),
      pattern && h('div', { class: 'pattern' },
        h('h4', {}, pattern.name),
        h('div', { class: 'pattern-ends' },
          h('div', {}, h('span', { class: 'pattern-tag' }, 'Start'), h('span', {}, pattern.bottom)),
          h('div', {}, h('span', { class: 'pattern-tag' }, 'Finish'), h('span', {}, pattern.top)),
        ),
        h('p', { class: 'pattern-watch' }, pattern.watch),
      ),
    ),
    h('div', { class: 'row small', style: 'gap:6px;margin:12px 0 10px' },
      ...ex.primary.map((m) => h('span', { class: 'badge badge-accent' }, muscleName(m))),
      ...ex.secondary.map((m) => h('span', { class: 'badge' }, muscleName(m), h('span', { class: 'muted' }, ' ½'))),
    ),
    ex.cues.length && h('ul', { class: 'cues', style: 'margin-left:0' }, ...ex.cues.map((c) => h('li', {}, c))),
    h('div', { class: 'small muted', style: 'margin-top:8px' },
      `Smallest useful jump ${ex.inc}kg · ` +
      (ex.stability === 'low' ? 'stop at 1 RIR minimum - not a lift to grind'
        : ex.stability === 'high' ? 'stable enough to take to failure safely'
        : 'can be pushed close to failure'),
    ),
    ex.subs.length && h('div', { class: 'small secondary', style: 'margin-top:6px' },
      'Swaps: ', ex.subs.map((id) => getExercise(id)?.name).filter(Boolean).join(', ')),
  );
}
