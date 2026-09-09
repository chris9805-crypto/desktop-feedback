/**
 * Program templates.
 *
 * A template is a *shape*, not a schedule of numbers. It says which movements
 * run on which day, how many sets week one starts at, and what rep window each
 * slot lives in. Loads are never written down here - they are derived from your
 * own logged performance by engine/progression.js.
 *
 * Every template runs as a mesocycle: N accumulation weeks where volume and
 * effort climb, then a deload where both drop and the fatigue you built gets
 * converted into adaptation. That block structure is the whole point - a
 * program you run at the same intensity forever is a maintenance plan.
 */

const slot = (exerciseId, sets, o = {}) => ({
  exerciseId,
  sets,
  reps: o.reps ?? null,          // null = use the exercise's own rep window
  restSec: o.restSec ?? null,    // null = derive from exercise type
  role: o.role ?? 'accessory',   // 'anchor' | 'secondary' | 'accessory'
  superset: o.superset ?? null,  // shared tag = alternate between the two
  note: o.note ?? null,
  growSets: o.growSets ?? true,  // may this slot gain sets across the block?
});

export const PROGRAMS = [
  {
    id: 'ul4',
    name: 'Upper / Lower',
    subtitle: '4 days · hypertrophy with a strength anchor',
    daysPerWeek: 4,
    level: 'Intermediate',
    focus: 'Balanced hypertrophy',
    accumulationWeeks: 4,
    rirByWeek: [3, 2, 1, 0],
    summary:
      'The default answer for most serious lifters. Each muscle gets hit roughly ' +
      'twice a week - the frequency that keeps protein synthesis elevated - while ' +
      'still leaving two full rest days. Day A leans heavy and low-rep, day B leans ' +
      'into volume and stretch-biased work.',
    bestFor: ['You can train 4 days a week and want the best size-per-session return',
              'You want measurable strength progress alongside hypertrophy'],
    days: [
      { id: 'upper-a', name: 'Upper A', focus: 'Heavy horizontal push & pull', slots: [
        slot('bb-bench', 4, { role: 'anchor', reps: [5, 8], restSec: 210 }),
        slot('bb-row', 4, { role: 'anchor', reps: [6, 10], restSec: 180 }),
        slot('incline-db-press', 3, { role: 'secondary' }),
        slot('lat-pulldown', 3, { role: 'secondary' }),
        slot('lateral-raise', 3, { superset: 'A' }),
        slot('skullcrusher', 3, { superset: 'B' }),
        slot('incline-db-curl', 3, { superset: 'B' }),
      ]},
      { id: 'lower-a', name: 'Lower A', focus: 'Squat pattern & posterior chain', slots: [
        slot('back-squat', 4, { role: 'anchor', reps: [5, 8], restSec: 240 }),
        slot('rdl', 3, { role: 'anchor', reps: [6, 10], restSec: 180 }),
        slot('leg-press', 2, { role: 'secondary' }),
        slot('lying-leg-curl', 3, { role: 'secondary' }),
        slot('standing-calf', 4, { superset: 'A' }),
        slot('hanging-leg-raise', 3, { superset: 'A' }),
      ]},
      { id: 'upper-b', name: 'Upper B', focus: 'Incline push, vertical pull, delts', slots: [
        slot('incline-bb-bench', 4, { role: 'anchor', reps: [6, 10], restSec: 180 }),
        slot('pullup', 4, { role: 'anchor', restSec: 180 }),
        slot('chest-supported-row', 3, { role: 'secondary' }),
        slot('cable-fly', 3, { superset: 'A' }),
        slot('cable-lateral', 4, { superset: 'A' }),
        slot('rear-delt-fly', 3, { superset: 'B' }),
        slot('pushdown', 3, { superset: 'B' }),
        slot('hammer-curl', 3, { superset: 'B' }),
      ]},
      { id: 'lower-b', name: 'Lower B', focus: 'Unilateral quads, glutes & hamstrings', slots: [
        slot('hack-squat', 3, { role: 'anchor', restSec: 210 }),
        slot('seated-leg-curl', 3, { role: 'secondary' }),
        slot('bulgarian-split-squat', 3, { role: 'secondary' }),
        slot('hip-thrust', 3, { role: 'secondary' }),
        slot('leg-extension', 3, { superset: 'A' }),
        slot('seated-calf', 4, { superset: 'A' }),
      ]},
    ],
  },

  {
    id: 'ppl6',
    name: 'Push / Pull / Legs',
    subtitle: '6 days · maximum volume, advanced only',
    daysPerWeek: 6,
    level: 'Advanced',
    focus: 'Volume-driven hypertrophy',
    accumulationWeeks: 4,
    rirByWeek: [3, 2, 1, 0],
    summary:
      'Six sessions gives every muscle two exposures a week with enough room to ' +
      'push each one deep into its adaptive volume range. This only works if ' +
      'sleep, food and stress are genuinely handled - run it in a deficit and ' +
      'you will hit your recoverable ceiling in week two.',
    bestFor: ['You have 4+ years of consistent training and recover well',
              'You are eating at maintenance or a surplus'],
    days: [
      { id: 'push-a', name: 'Push A', focus: 'Heavy chest', slots: [
        slot('bb-bench', 4, { role: 'anchor', reps: [5, 8], restSec: 210 }),
        slot('db-shoulder-press', 3, { role: 'secondary' }),
        slot('incline-db-press', 3, { role: 'secondary' }),
        slot('cable-lateral', 4, { superset: 'A' }),
        slot('overhead-ext', 3, { superset: 'A' }),
        slot('pushdown', 3),
      ]},
      { id: 'pull-a', name: 'Pull A', focus: 'Heavy horizontal pull', slots: [
        slot('bb-row', 4, { role: 'anchor', reps: [6, 10], restSec: 180 }),
        slot('lat-pulldown', 3, { role: 'secondary' }),
        slot('cable-row', 3, { role: 'secondary' }),
        slot('face-pull', 3, { superset: 'A' }),
        slot('bb-curl', 3, { superset: 'A' }),
        slot('hammer-curl', 2),
      ]},
      { id: 'legs-a', name: 'Legs A', focus: 'Squat pattern', slots: [
        slot('back-squat', 4, { role: 'anchor', reps: [5, 8], restSec: 240 }),
        slot('rdl', 3, { role: 'anchor', restSec: 180 }),
        slot('leg-press', 3, { role: 'secondary' }),
        slot('lying-leg-curl', 3, { role: 'secondary' }),
        slot('standing-calf', 4, { superset: 'A' }),
        slot('hanging-leg-raise', 3, { superset: 'A' }),
      ]},
      { id: 'push-b', name: 'Push B', focus: 'Incline & delt emphasis', slots: [
        slot('incline-bb-bench', 4, { role: 'anchor', reps: [6, 10], restSec: 180 }),
        slot('machine-press', 3, { role: 'secondary' }),
        slot('cable-fly', 3, { superset: 'A' }),
        slot('lateral-raise', 4, { superset: 'A' }),
        slot('close-grip-bench', 3, { role: 'secondary' }),
      ]},
      { id: 'pull-b', name: 'Pull B', focus: 'Vertical pull & rear delts', slots: [
        slot('pullup', 4, { role: 'anchor', restSec: 180 }),
        slot('chest-supported-row', 4, { role: 'secondary' }),
        slot('pullover', 3, { role: 'secondary' }),
        slot('rear-delt-fly', 4, { superset: 'A' }),
        slot('incline-db-curl', 2, { superset: 'A' }),
        slot('preacher-curl', 2),
      ]},
      { id: 'legs-b', name: 'Legs B', focus: 'Hamstrings, glutes & unilateral', slots: [
        slot('hack-squat', 4, { role: 'anchor', restSec: 210 }),
        slot('seated-leg-curl', 3, { role: 'secondary' }),
        slot('hip-thrust', 3, { role: 'secondary' }),
        slot('bulgarian-split-squat', 3, { role: 'secondary' }),
        slot('leg-extension', 3, { superset: 'A' }),
        slot('seated-calf', 4, { superset: 'A' }),
      ]},
    ],
  },

  {
    id: 'phul4',
    name: 'Power / Hypertrophy',
    subtitle: '4 days · two heavy days, two volume days',
    daysPerWeek: 4,
    level: 'Intermediate',
    focus: 'Strength and size together',
    accumulationWeeks: 4,
    rirByWeek: [3, 2, 1, 1],
    summary:
      'Splits the week by intent rather than by muscle: two low-rep days train ' +
      'the main lifts as skills, two higher-rep days chase the growth. Keeps a ' +
      'rising squat, bench and deadlift on the board while the tape measure ' +
      'still moves. Effort never goes past 1 RIR on the power days - the point ' +
      'there is bar speed and technique, not grinding. Power-day sets stay flat ' +
      'all block: those sessions progress by load alone, and only the ' +
      'hypertrophy days accumulate volume.',
    bestFor: ['You compete in, or care about, absolute strength numbers',
              'You get bored of pure bodybuilding rep ranges'],
    days: [
      { id: 'power-upper', name: 'Power Upper', focus: 'Heavy pressing & rowing', slots: [
        slot('bb-bench', 4, { role: 'anchor', reps: [3, 5], restSec: 240, growSets: false }),
        slot('bb-row', 4, { role: 'anchor', reps: [4, 6], restSec: 210, growSets: false }),
        slot('ohp', 3, { role: 'secondary', reps: [4, 6], restSec: 180, growSets: false }),
        slot('pullup', 3, { role: 'secondary', reps: [5, 8], growSets: false }),
        slot('close-grip-bench', 3, { reps: [6, 8], growSets: false }),
        slot('bb-curl', 3, { reps: [6, 10], growSets: false }),
      ]},
      { id: 'power-lower', name: 'Power Lower', focus: 'Squat & deadlift', slots: [
        slot('back-squat', 4, { role: 'anchor', reps: [3, 5], restSec: 300, growSets: false }),
        slot('deadlift', 3, { role: 'anchor', reps: [3, 5], restSec: 300, growSets: false,
          note: 'Heavy pulls cost more recovery than they return past 3 sets. Sets stay flat all block.' }),
        slot('leg-press', 2, { role: 'secondary', reps: [8, 12] }),
        slot('lying-leg-curl', 3, { reps: [8, 12] }),
        slot('standing-calf', 4, { superset: 'A' }),
      ]},
      { id: 'hyp-upper', name: 'Hypertrophy Upper', focus: 'Pump work, full ROM', slots: [
        slot('incline-db-press', 4, { role: 'anchor', reps: [8, 12] }),
        slot('cable-row', 4, { role: 'anchor', reps: [10, 14] }),
        slot('cable-fly', 3, { superset: 'A' }),
        slot('lat-pulldown', 3, { superset: 'A', reps: [10, 14] }),
        slot('lateral-raise', 4, { superset: 'B' }),
        slot('rear-delt-fly', 3, { superset: 'B' }),
        slot('machine-lateral', 3, { superset: 'C' }),
        slot('pushdown', 3, { superset: 'C' }),
        slot('incline-db-curl', 3, { superset: 'D' }),
      ]},
      { id: 'hyp-lower', name: 'Hypertrophy Lower', focus: 'Higher-rep legs', slots: [
        slot('hack-squat', 3, { role: 'anchor', reps: [10, 15] }),
        slot('seated-leg-curl', 4, { role: 'secondary', reps: [10, 15] }),
        slot('bulgarian-split-squat', 3, { reps: [10, 14] }),
        slot('leg-extension', 3, { superset: 'A' }),
        slot('seated-calf', 4, { superset: 'A' }),
        slot('cable-crunch', 3),
      ]},
    ],
  },

  {
    id: 'fb3',
    name: 'Full Body',
    subtitle: '3 days · highest return per hour in the gym',
    daysPerWeek: 3,
    level: 'Beginner to intermediate',
    focus: 'Efficiency',
    accumulationWeeks: 4,
    rirByWeek: [3, 2, 1, 0],
    summary:
      'Three sessions, every muscle three times a week, nothing wasted. Because ' +
      'each muscle is trained often, per-session volume stays low, which is ' +
      'exactly what makes this recoverable when life is busy. Supersets are ' +
      'built in - the antagonist pairs cost no extra time.',
    bestFor: ['You can only reliably train 3 days a week',
              'You are returning after a layoff and want frequency over volume'],
    days: [
      { id: 'fb-a', name: 'Full Body A', focus: 'Squat & bench', slots: [
        slot('back-squat', 3, { role: 'anchor', reps: [5, 8], restSec: 240 }),
        slot('bb-bench', 4, { role: 'anchor', reps: [5, 8], restSec: 210 }),
        slot('cable-row', 3, { role: 'anchor' }),
        slot('lying-leg-curl', 2, { superset: 'A' }),
        slot('lateral-raise', 3, { superset: 'A' }),
        slot('pushdown', 2, { superset: 'B' }),
        slot('bb-curl', 2, { superset: 'B' }),
      ]},
      { id: 'fb-b', name: 'Full Body B', focus: 'Hinge & vertical pull', slots: [
        slot('rdl', 3, { role: 'anchor', reps: [6, 10], restSec: 210 }),
        slot('pullup', 4, { role: 'anchor' }),
        slot('db-shoulder-press', 3, { role: 'anchor' }),
        slot('leg-press', 3, { role: 'secondary' }),
        slot('cable-lateral', 3, { superset: 'A' }),
        slot('hammer-curl', 2, { superset: 'A' }),
        slot('standing-calf', 3, { superset: 'B' }),
      ]},
      { id: 'fb-c', name: 'Full Body C', focus: 'Incline & unilateral', slots: [
        slot('incline-db-press', 4, { role: 'anchor' }),
        slot('chest-supported-row', 3, { role: 'anchor' }),
        slot('bulgarian-split-squat', 3, { role: 'secondary' }),
        slot('seated-leg-curl', 2, { role: 'secondary' }),
        slot('cable-fly', 2, { superset: 'A' }),
        slot('rear-delt-fly', 3, { superset: 'A' }),
        slot('overhead-ext', 2, { superset: 'B' }),
        slot('seated-calf', 3, { superset: 'B' }),
        slot('cable-crunch', 3, { superset: 'B' }),
      ]},
    ],
  },

  {
    id: 'split5',
    name: 'Classic Split',
    subtitle: '5 days · one muscle group per session',
    daysPerWeek: 5,
    level: 'Intermediate to advanced',
    focus: 'Weak-point specialisation',
    accumulationWeeks: 4,
    rirByWeek: [3, 2, 1, 0],
    summary:
      'The bodybuilding split, with the classic flaw fixed: instead of one ' +
      'brutal session per muscle per week, the smaller and faster-recovering ' +
      'groups (delts, arms, calves) get a second, lighter exposure attached to ' +
      'another day. You still get the focus and the pump of a dedicated day.',
    bestFor: ['You train 5 days and like attacking one area at a time',
              'You have a lagging body part that needs a dedicated session'],
    days: [
      { id: 'chest-day', name: 'Chest', focus: 'All pressing angles', slots: [
        slot('incline-bb-bench', 4, { role: 'anchor', reps: [6, 10], restSec: 180 }),
        slot('bb-bench', 3, { role: 'anchor', reps: [6, 10], restSec: 180 }),
        slot('machine-press', 3, { role: 'secondary' }),
        slot('cable-fly', 4, { role: 'secondary' }),
        slot('cable-lateral', 3, { superset: 'A', note: 'Second weekly side-delt exposure.' }),
      ]},
      { id: 'back-day', name: 'Back', focus: 'Width then thickness', slots: [
        slot('pullup', 4, { role: 'anchor', restSec: 180 }),
        slot('bb-row', 4, { role: 'anchor', reps: [6, 10], restSec: 180 }),
        slot('lat-pulldown', 3, { role: 'secondary' }),
        slot('chest-supported-row', 3, { role: 'secondary' }),
        slot('pullover', 3, { superset: 'A' }),
        slot('shrug', 3, { superset: 'A' }),
      ]},
      { id: 'legs-day', name: 'Legs', focus: 'Quads, hamstrings, calves', slots: [
        slot('back-squat', 4, { role: 'anchor', reps: [5, 8], restSec: 240 }),
        slot('rdl', 3, { role: 'anchor', restSec: 180 }),
        slot('hack-squat', 3, { role: 'secondary' }),
        slot('seated-leg-curl', 3, { role: 'secondary' }),
        slot('leg-extension', 3, { superset: 'A' }),
        slot('standing-calf', 4, { superset: 'A' }),
      ]},
      { id: 'delts-day', name: 'Shoulders', focus: 'All three heads', slots: [
        slot('ohp', 4, { role: 'anchor', reps: [5, 8], restSec: 180 }),
        slot('lateral-raise', 4, { role: 'secondary' }),
        slot('rear-delt-fly', 4, { role: 'secondary' }),
        slot('machine-lateral', 3, { superset: 'A' }),
        slot('face-pull', 3, { superset: 'A' }),
        slot('cable-crunch', 3),
      ]},
      { id: 'arms-day', name: 'Arms', focus: 'Biceps & triceps to failure', slots: [
        slot('close-grip-bench', 4, { role: 'anchor', reps: [6, 10], restSec: 150, superset: 'A' }),
        slot('bb-curl', 3, { role: 'anchor', superset: 'A' }),
        slot('overhead-ext', 3, { superset: 'B' }),
        slot('incline-db-curl', 3, { superset: 'B' }),
        slot('pushdown', 3, { superset: 'C' }),
        slot('hammer-curl', 3, { superset: 'C' }),
        slot('seated-calf', 3, { note: 'Second weekly calf exposure.' }),
      ]},
    ],
  },
];

export const PROGRAM_BY_ID = Object.fromEntries(PROGRAMS.map((p) => [p.id, p]));

export function getProgram(id) {
  return PROGRAM_BY_ID[id];
}
