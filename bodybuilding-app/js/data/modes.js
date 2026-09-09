/**
 * Training modes.
 *
 * A beginner, an intermediate and an advanced lifter are not doing the same
 * training with different labels on it. They have genuinely different jobs:
 *
 *   Beginner      learn the movement, learn to feel the muscle, build a base.
 *                 Progress is limited by technique, not by recovery, so the
 *                 constraint that matters is "did that look and feel right",
 *                 not "how close to failure were you".
 *
 *   Intermediate  drive the main lifts up while technique holds. Progress is
 *                 limited by how much load you can add before form degrades,
 *                 so form is the gate on progression rather than the goal.
 *
 *   Advanced      find what is lagging and attack it. Progress is limited by
 *                 your weakest links and by how hard you can genuinely push,
 *                 so the app spends its attention on imbalances and lets you
 *                 train to failure where that is safe.
 *
 * Each mode is a small parameter set consumed by the progression engine and
 * the session UI. Deliberately not a fork of the engine: one set of rules,
 * three sets of dials, so a change to the maths cannot silently apply to one
 * mode and not the others.
 */

export const MODES = {
  beginner: {
    id: 'beginner',
    name: 'Form & foundation',
    tagline: 'Learn the movements, feel the muscle, build a base',
    order: 0,

    summary:
      'Your first months are won by learning to move well, not by how much you ' +
      'lift. Everything here is set up so technique is the thing that improves: ' +
      'controlled tempo, sets that stop well short of failure, and load that only ' +
      'goes up once you have shown you can handle the current one twice.',

    priorities: [
      'Technique before load, every single time',
      'Learning to feel the target muscle working, not just moving the weight',
      'Building a base of general strength across every movement pattern',
    ],

    /* --- how it prescribes ------------------------------------------- */
    // Never within 2 reps of failure: form degrades first, and a beginner
    // cannot yet tell the difference between hard and unsafe.
    rirFloor: 2,
    // Shift rep windows up. Lighter loads for more reps are far more forgiving
    // of imperfect technique and teach position better.
    repBias: 2,
    // Half-size load jumps. There is no hurry, and the most common beginner
    // mistake is outrunning their own technique.
    loadStepFactor: 0.5,
    // Load only goes up after two clean sessions at the top of the range.
    consecutiveSuccessesForLoad: 2,
    // A session where form felt poor holds the load, whatever the reps said.
    holdOnPoorForm: true,
    // Prefer machines and supported movements where a swap is offered.
    preferStability: 'high',
    tempo: { eccentric: 3, pause: 1, note: 'Three seconds down, pause, then lift with control.' },

    /* --- what it asks after a set and after a session ---------------- */
    setChecks: ['form', 'connection'],
    sessionCards: ['effort', 'connection', 'look'],

    /* --- what it shows ------------------------------------------------ */
    showCues: true,
    showTempo: true,
    showImbalances: false,
    showE1rm: false,       // an estimated max means little before technique settles
    plainLanguage: true,
  },

  intermediate: {
    id: 'intermediate',
    name: 'Strength & structure',
    tagline: 'Drive the compound lifts up while technique holds',
    order: 1,

    summary:
      'You know the lifts; now the job is loading them. The main compounds get ' +
      'the heavy work and the attention, accessories fill in around them, and ' +
      'form is the gate on progression: if technique broke down on a set, the ' +
      'load does not go up next week no matter what the reps said.',

    priorities: [
      'Adding load to squat, bench, row, press and deadlift over time',
      'Holding technique together as the weight climbs',
      'Enough accessory work to keep everything else growing alongside',
    ],

    // No mode-wide floor: the movement's own floor still applies (heavy barbell
    // lifts stop at 1 RIR), but taking a leg extension to failure in the last
    // hard week is normal, useful training for someone at this level. What
    // separates this mode is that form gates progression, not that effort is
    // capped.
    rirFloor: 0,
    repBias: 0,
    loadStepFactor: 1,
    consecutiveSuccessesForLoad: 1,
    holdOnPoorForm: true,
    preferStability: null,
    tempo: null,

    setChecks: ['form'],
    sessionCards: ['effort', 'stamina', 'strength', 'look'],

    showCues: true,
    showTempo: false,
    showImbalances: false,
    showE1rm: true,
    plainLanguage: false,
  },

  advanced: {
    id: 'advanced',
    name: 'Weak points & limits',
    tagline: 'Find what is lagging, attack it, and train close to the edge',
    order: 2,

    summary:
      'At this point the average is not the problem - the weak links are. The app ' +
      'watches your logged strength ratios, per-muscle volume and per-side ' +
      'reports, tells you what is lagging, and steers extra volume there. Sets on ' +
      'stable movements can be taken to genuine failure, because you can tell the ' +
      'difference between hard and dangerous.',

    priorities: [
      'Finding and fixing muscle imbalances and lagging groups',
      'Bringing weak points up to the rest of the physique',
      'Training genuinely close to failure where it is safe to do so',
    ],

    rirFloor: 0,
    repBias: 0,
    loadStepFactor: 1,
    consecutiveSuccessesForLoad: 1,
    // An advanced lifter reporting rough form is reporting a hard set, not a
    // technical failure - they get told, and decide for themselves.
    holdOnPoorForm: false,
    preferStability: null,
    tempo: null,

    setChecks: ['side'],
    sessionCards: ['effort', 'stamina', 'strength', 'look', 'weakpoint'],

    showCues: false,
    showTempo: false,
    showImbalances: true,
    showE1rm: true,
    plainLanguage: false,
  },
};

export const MODE_ORDER = Object.values(MODES).sort((a, b) => a.order - b.order).map((m) => m.id);
export const DEFAULT_MODE = 'intermediate';

export function getMode(id) {
  return MODES[id] ?? MODES[DEFAULT_MODE];
}

/** Rep window after the mode's bias, kept inside sane bounds. */
export function biasedRepRange(range, mode) {
  const bias = getMode(mode?.id ?? mode).repBias ?? 0;
  if (!bias) return range;
  return [Math.min(range[0] + bias, 20), Math.min(range[1] + bias, 25)];
}
