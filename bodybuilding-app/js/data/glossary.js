/**
 * Every technical term the app uses, in plain English.
 *
 * The rule this file exists to enforce: jargon is never the *only* way
 * something is said. A beginner should be able to use the app without knowing
 * any of these words, and should be able to learn each one the moment they get
 * curious - by tapping it, where it stands, rather than by going and reading a
 * forum.
 *
 *   plain   what we call it by default
 *   short   the one-line answer
 *   full    the answer for someone who tapped because they wanted more
 *   why     why it matters to them, not to the theory
 */

export const GLOSSARY = {
  rir: {
    term: 'RIR',
    plain: 'reps left in the tank',
    short: 'How many more reps you could have done before failing.',
    full:
      'RIR stands for Reps In Reserve. If you stopped a set at 8 reps but could ' +
      'have ground out 2 more, that is 2 RIR. Zero means you genuinely could not ' +
      'have done another one.',
    why:
      'This is the single most useful thing you can tell the app. It is how it ' +
      'knows whether the weight was too light, about right, or too heavy - and ' +
      'therefore what to put on the bar next week. Guessing high to look tough ' +
      'only cheats you.',
  },
  set: {
    term: 'Set',
    plain: 'a set',
    short: 'A group of reps done back to back without resting.',
    full: 'Ten press-ups in a row is one set of ten. Rest, then do ten more, and that is two sets.',
    why: 'Sets are the unit everything else is counted in - volume, progress, fatigue.',
  },
  rep: {
    term: 'Rep',
    plain: 'a rep',
    short: 'One complete performance of the movement.',
    full: 'Short for repetition. Lowering the bar to your chest and pressing it back up is one rep.',
    why: '',
  },
  repRange: {
    term: 'Rep range',
    plain: 'the rep window',
    short: 'The number of reps a movement works best in, given as a range like 6-10.',
    full:
      'You aim to stay inside the range. Once you can hit the top of it at the ' +
      'planned effort, the weight goes up and you drop back to the bottom of the range.',
    why:
      'It stops you either adding weight faster than your technique can hold, or ' +
      'sitting at the same weight for months.',
  },
  workingSet: {
    term: 'Working set',
    plain: 'a real set',
    short: 'A set at your actual training weight - not a warm-up.',
    full: 'Warm-up sets get you ready. Working sets are the ones that cause the growth, and the only ones counted.',
    why: '',
  },
  warmup: {
    term: 'Warm-up set',
    plain: 'warm-up',
    short: 'Light sets before your real ones, to prepare the joints and rehearse the movement.',
    full:
      'A normal warm-up on a big lift: the empty bar for 8, then roughly 50%, 70% ' +
      'and 85% of your working weight for a few reps each, resting briefly. ' +
      'Small isolation exercises usually need one light set or none.',
    why: 'It reduces injury risk and, genuinely, makes your working sets stronger.',
  },
  compound: {
    term: 'Compound',
    plain: 'big multi-joint lift',
    short: 'A lift that moves more than one joint and trains several muscles at once.',
    full: 'Squats, presses, rows, deadlifts. They build the most muscle per set and cost the most recovery.',
    why: 'These come first in a session, while you are fresh, and get the longest rests.',
  },
  isolation: {
    term: 'Isolation',
    plain: 'single-muscle exercise',
    short: 'An exercise that trains one muscle through one joint.',
    full: 'Bicep curls, lateral raises, leg extensions. Less fatiguing, easier to recover from.',
    why: 'This is where extra volume gets added, because it costs you the least.',
  },
  volume: {
    term: 'Volume',
    plain: 'how much work you do',
    short: 'The number of hard sets you do for a muscle in a week.',
    full:
      'Counted per muscle, per week. A set where a muscle does the work counts as ' +
      'one; a set where it only helps counts as a half. Sets stopped a long way ' +
      'from failure are not counted at all - they are not hard enough to matter.',
    why: 'Volume is the main driver of muscle growth, right up until it becomes the main driver of exhaustion.',
  },
  mev: {
    term: 'MEV',
    plain: 'enough to grow',
    short: 'The least work per week that reliably grows a muscle.',
    full: 'Minimum Effective Volume. Below this you are maintaining what you have, not building.',
    why: 'If the app says a muscle is below this, it is telling you that work is not currently doing anything for you.',
  },
  mav: {
    term: 'MAV',
    plain: 'the productive range',
    short: 'The amount of work where most of your growth actually happens.',
    full: 'Maximum Adaptive Volume. The comfortable middle - enough to grow, not enough to bury you.',
    why: 'A block is designed to start below this and climb into it.',
  },
  mrv: {
    term: 'MRV',
    plain: 'more than you can recover from',
    short: 'The ceiling. Past this you accumulate fatigue instead of muscle.',
    full:
      'Maximum Recoverable Volume. It is not a safety limit so much as a point of ' +
      'diminishing and then negative returns: the sets still hurt, they just stop paying.',
    why: 'The app will not schedule you past it, however good you feel.',
  },
  mesocycle: {
    term: 'Mesocycle',
    plain: 'training block',
    short: 'A run of about five weeks that builds up and then backs off.',
    full:
      'Four weeks where the work and the effort climb, then one easy week. Then you ' +
      'start a new block, heavier than the last one started.',
    why:
      'Training flat-out forever does not work - you stall and stay stalled. ' +
      'Building up and backing off is what turns hard weeks into actual muscle.',
  },
  deload: {
    term: 'Deload',
    plain: 'easy week',
    short: 'A planned light week at the end of a block.',
    full: 'About half the sets, roughly 12% off the weight, stopping well short of failure.',
    why:
      'This is not a week off and it is not wasted. The growth you built over the ' +
      'hard weeks turns up during this one. Skipping it is the most common way ' +
      'people stall.',
  },
  progressiveOverload: {
    term: 'Progressive overload',
    plain: 'doing a bit more over time',
    short: 'Gradually giving the muscle more than it is used to.',
    full: 'More reps, more weight, or more sets - one of them has to move, or there is no reason for the body to change.',
    why: 'It is the whole reason training works. Everything else in this app is machinery for making it happen safely.',
  },
  doubleProgression: {
    term: 'Double progression',
    plain: 'reps first, then weight',
    short: 'Add reps until you fill the range, then add weight and start the range again.',
    full:
      'If the range is 6-10 and you got 8 last week, you go for 9 this week. Once ' +
      'you hit 10 at the planned effort, the weight goes up and you are back to 6.',
    why: 'It is the safest way to get stronger without your technique falling apart on the way.',
  },
  failure: {
    term: 'Training to failure',
    plain: 'going until you cannot do another',
    short: 'Ending a set when another rep is genuinely impossible.',
    full:
      'Useful in small doses on machines and cables, where nothing bad happens when ' +
      'you stall. On heavy barbell lifts it is a bad trade: high risk, high fatigue, ' +
      'no extra growth.',
    why: 'This app deliberately keeps you 1-3 reps short of it most of the time, and never lets a heavy barbell lift go all the way.',
  },
  superset: {
    term: 'Superset',
    plain: 'paired exercises',
    short: 'Two exercises done back to back, resting once instead of twice.',
    full: 'Paired so they do not compete - while your triceps work, your side delts are recovering.',
    why: 'It saves you real time without costing you performance.',
  },
  tonnage: {
    term: 'Tonnage',
    plain: 'total weight lifted',
    short: 'Weight times reps times sets, added up.',
    full: 'A rough measure of how much work a session contained.',
    why: 'Useful for comparing a session to the same session last month. Not useful for comparing exercises to each other.',
  },
  e1rm: {
    term: 'Estimated 1RM',
    plain: 'your estimated best single',
    short: 'The heaviest single rep you could probably do, worked out from your normal sets.',
    full:
      'Calculated from the weight, reps and effort you logged, so you never have to ' +
      'actually attempt a maximum to know you are getting stronger. Reliable up to ' +
      'about 12 reps; beyond that it drifts and the app says so.',
    why: 'It is the cleanest single number for "am I actually getting stronger", because it accounts for reps and effort as well as weight.',
  },
  hypertrophy: {
    term: 'Hypertrophy',
    plain: 'muscle growth',
    short: 'Muscles getting bigger.',
    full: 'As opposed to training purely for strength, which is partly a skill and nervous-system adaptation.',
    why: '',
  },
  frequency: {
    term: 'Frequency',
    plain: 'how often you train it',
    short: 'How many times a week a muscle gets trained.',
    full: 'Twice a week beats once for most muscles, because the growth signal from a session fades after a couple of days.',
    why: 'It is why these programs split the week the way they do.',
  },
};

export const GLOSSARY_ORDER = [
  'rep', 'set', 'workingSet', 'warmup', 'repRange', 'rir', 'failure',
  'progressiveOverload', 'doubleProgression', 'volume', 'mev', 'mav', 'mrv',
  'mesocycle', 'deload', 'frequency', 'compound', 'isolation', 'superset',
  'e1rm', 'tonnage', 'hypertrophy',
];

export function lookup(key) {
  return GLOSSARY[key] ?? null;
}
