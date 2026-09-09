/**
 * First run.
 *
 * A beginner opening a training app faces a wall of programs with names that
 * assume they already know the answer. Four questions is enough to make that
 * choice for them and explain why, which is the difference between starting on
 * Monday and closing the tab.
 *
 * Nothing here is locked in: the recommendation is a suggestion with its
 * reasoning shown, and every other program stays one tap away.
 */

import { h, clear } from '../dom.js';
import { store } from '../../store.js';
import { PROGRAMS, getProgram } from '../../data/programs.js';
import { getExercise } from '../../data/exercises.js';
import { EQUIPMENT_PROFILES, adaptationReport } from '../../engine/equipment.js';
import { programTimeProfile } from '../../engine/mesocycle.js';
import { term } from '../term.js';
import { MODES, MODE_ORDER } from '../../data/modes.js';

const answers = { mode: null, days: null, equipment: null };
let step = 0;

const STEPS = [
  {
    key: 'mode',
    question: 'What should this block be about?',
    help: 'This changes the training itself, not just the wording - how close to failure you ' +
          'work, how fast load climbs, and what the app pays attention to. You can switch later.',
    options: MODE_ORDER.map((id) => ({
      value: id,
      label: MODES[id].name,
      detail: MODES[id].tagline,
    })),
  },
  {
    key: 'days',
    question: 'How many days a week can you realistically train?',
    help: 'Be honest rather than ambitious. A program you finish beats a program you admire.',
    options: [
      { value: 3, label: '3 days', detail: 'Plenty to build muscle on' },
      { value: 4, label: '4 days', detail: 'The sweet spot for most people' },
      { value: 5, label: '5 days', detail: 'Room for a dedicated session per area' },
      { value: 6, label: '6 days', detail: 'Only if sleep and food are genuinely handled' },
    ],
  },
  {
    key: 'equipment',
    question: 'What do you have access to?',
    help: 'Exercises you cannot do are swapped automatically for ones that train the same muscle.',
    options: Object.values(EQUIPMENT_PROFILES).map((p) => ({ value: p.id, label: p.name, detail: p.detail })),
  },
];

export function render(container) {
  clear(container);
  container.append(step < STEPS.length ? questionCard(container) : recommendation(container));
}

function questionCard(container) {
  const current = STEPS[step];
  return h('div', { class: 'stack onboarding' },
    h('div', { class: 'progress-dots' },
      ...STEPS.map((_, i) => h('span', { class: `dot${i === step ? ' is-current' : ''}${i < step ? ' is-done' : ''}` })),
      h('span', { class: 'small muted', style: 'margin-left:auto' }, `${step + 1} of ${STEPS.length}`),
    ),
    h('div', { class: 'card' },
      step === 0 && h('div', { style: 'margin-bottom:20px' },
        h('h1', {}, 'Let\'s find the right program'),
        h('p', { class: 'secondary' },
          'Three questions. There are no wrong answers and you can change any of it later.'),
      ),
      h('h2', {}, current.question),
      h('p', { class: 'secondary small' }, current.help),
      h('div', { class: 'choice-list', style: 'margin-top:16px' },
        ...current.options.map((option) => h('button', {
          class: 'choice',
          onClick: () => {
            answers[current.key] = option.value;
            step += 1;
            render(container);
            window.scrollTo(0, 0);
          },
        },
          h('span', { class: 'choice-label' }, option.label),
          h('span', { class: 'choice-detail' }, option.detail),
        )),
      ),
      step > 0 && h('button', {
        class: 'btn-ghost', style: 'margin-top:14px',
        onClick: () => { step -= 1; render(container); },
      }, '← Back'),
    ),
    h('button', {
      class: 'btn-ghost',
      onClick: () => { finish(null); },
    }, 'Skip this and browse the programs myself'),
  );
}

/**
 * Choose a program from the answers.
 *
 * Experience gates the ceiling (a novice is never handed a six-day split, no
 * matter how many days they say they can train), then the closest available
 * day count wins.
 */
export function recommendProgram({ mode, days, equipment }) {
  const usable = PROGRAMS.filter((p) => adaptationReport(p, equipment ?? 'full').usable);
  const pool = usable.length ? usable : PROGRAMS;

  if (mode === 'beginner') {
    const novice = pool.find((p) => p.volumeProfile === 'novice');
    if (novice) {
      return {
        program: novice,
        reasons: [
          'You are in Form & foundation mode, so this is a beginner block: six exercises a session, mostly machines and dumbbells.',
          'Every set stops a few reps short of failing. You will spend this block learning to move well, which is what makes the next six months work.',
          'The volume is deliberately low. Beginners grow on far less work than experienced lifters need, and recovering easily is what gets you back three times a week.',
        ],
        alternative: pool.find((p) => p.id === 'fb3'),
      };
    }
  }

  const eligible = pool.filter((p) => {
    if (p.volumeProfile === 'novice') return false;
    if (mode !== 'advanced' && p.daysPerWeek >= 6) return false;
    return true;
  });

  const target = days ?? 4;
  const sorted = [...eligible].sort((a, b) =>
    Math.abs(a.daysPerWeek - target) - Math.abs(b.daysPerWeek - target) || a.daysPerWeek - b.daysPerWeek);
  const program = sorted[0] ?? pool[0];

  const reasons = [];
  if (program.daysPerWeek === target) {
    reasons.push(`It runs on the ${target} days a week you said you have.`);
  } else {
    reasons.push(`It runs on ${program.daysPerWeek} days, the closest fit to the ${target} you said you have.`);
  }
  if (mode !== 'advanced' && target >= 6) {
    reasons.push('Six sessions a week only pays off once you have a couple of years of consistent training and your recovery is genuinely handled, so this steps you down to something you will actually finish.');
  }
  reasons.push(program.summary.split('. ')[0] + '.');
  return { program, reasons, alternative: sorted[1] };
}

function recommendation(container) {
  const { program, reasons, alternative } = recommendProgram(answers);
  const time = programTimeProfile(program);
  const report = adaptationReport(program, answers.equipment ?? 'full');

  return h('div', { class: 'stack onboarding' },
    h('div', { class: 'card' },
      h('h4', {}, 'Recommended for you'),
      h('h1', { style: 'margin:6px 0 4px' }, program.name),
      h('p', { class: 'muted small' }, program.subtitle),
      h('ul', { class: 'cues', style: 'margin:16px 0' }, ...reasons.map((r) => h('li', {}, r))),
      answers.mode && h('div', { class: 'mode-card', style: 'margin-bottom:16px' },
        h('h3', {}, MODES[answers.mode].name),
        h('p', { class: 'tagline' }, MODES[answers.mode].tagline),
        h('p', { class: 'secondary small', style: 'margin:0' }, MODES[answers.mode].summary),
        h('ul', {}, ...MODES[answers.mode].priorities.map((x) => h('li', {}, x))),
      ),
      h('div', { class: 'grid grid-3', style: 'margin:18px 0' },
        stat('Days a week', String(program.daysPerWeek)),
        stat('Per session', `${time.sessionMin}–${time.sessionMax} min`),
        stat('Per week', `${(time.weeklyStart / 60).toFixed(1)}–${(time.weeklyPeak / 60).toFixed(1)} h`),
      ),
      report.swaps.length
        ? h('div', { class: 'notice' },
            `${report.swaps.length} exercises have been swapped for ones you can do with `,
            (EQUIPMENT_PROFILES[answers.equipment]?.name ?? 'your equipment').toLowerCase(),
            ' — for example ',
            h('b', {}, getExercise(report.swaps[0].from)?.name),
            ' becomes ',
            h('b', {}, getExercise(report.swaps[0].to)?.name),
            '. You can change any of them mid-session too.')
        : null,
      h('div', { class: 'row', style: 'margin-top:18px' },
        h('button', {
          class: 'btn-primary btn-lg',
          onClick: () => finish(program.id),
        }, 'Start this program'),
        alternative && h('button', {
          onClick: () => { answers.pick = alternative.id; finish(alternative.id); },
        }, `Or ${alternative.name}`),
      ),
    ),
    h('div', { class: 'card' },
      h('h3', {}, 'What happens next'),
      h('ol', { class: 'cues', style: 'margin-top:10px' },
        h('li', {}, 'Each session tells you exactly what to lift, for how many reps, and how hard to push.'),
        h('li', {}, 'You log what you actually did. That is the whole job.'),
        h('li', {}, 'After each session it asks how sore you got and how your joints felt.'),
        h('li', {},
          'Every week the ', term('progressiveOverload', 'weights and sets go up a little'),
          ', and the fifth week is an ', term('deload', 'easy week'), ' where the muscle you built shows up.'),
      ),
    ),
    h('button', { class: 'btn-ghost', onClick: () => finish(null) }, 'Actually, let me browse all the programs'),
  );
}

function finish(programId) {
  store.update((s) => ({
    ...s,
    settings: {
      ...s.settings,
      mode: answers.mode ?? s.settings.mode ?? 'intermediate',
      equipment: answers.equipment ?? s.settings.equipment ?? 'full',
      onboarded: true,
    },
  }));
  if (programId) {
    const program = getProgram(programId);
    store.startMesocycle(programId, undefined, answers.equipment ?? 'full');
    location.hash = '#/train';
  } else {
    location.hash = '#/programs';
  }
}

function stat(label, value) {
  return h('div', { class: 'stat' },
    h('span', { class: 'label' }, label),
    h('span', { class: 'value num' }, value),
  );
}

export function reset() {
  step = 0;
  answers.mode = answers.days = answers.equipment = null;
}
