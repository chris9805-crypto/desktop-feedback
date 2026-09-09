/**
 * Plain-English versions of everything the engine decides.
 *
 * The engine's own `rationale` is written for someone who already knows what
 * RIR and a rep window are. That is the right voice for an experienced lifter
 * and completely wrong for someone in their second week, who will read
 * "topped out the 5-8 window at 2 RIR" and quietly stop reading the app.
 *
 * So the engine stays technical and pure, and every prescription is composed
 * again here from its structured fields. Two vocabularies, one set of numbers -
 * rather than a "simple mode" that hides information, which is how people end
 * up never learning the words at all.
 */

import { store } from '../store.js';

export function isBeginner() {
  return store.state.settings.experience === 'new';
}

/** Words for a reps-in-reserve value, used on buttons and in prose. */
export function effortWords(rir) {
  const n = Number(rir);
  if (!Number.isFinite(n)) return 'unknown';
  if (n <= 0) return 'nothing left';
  if (n === 1) return '1 more rep in you';
  if (n >= 4) return '4+ more reps in you';
  return `${n} more reps in you`;
}

export function effortShort(rir) {
  const n = Number(rir);
  if (!Number.isFinite(n)) return '?';
  if (n <= 0) return 'None left';
  if (n >= 4) return '4+ more';
  return `${n} more`;
}

/** The five choices offered instead of a number field. */
export const EFFORT_CHOICES = [
  { rir: 0, label: 'None left', detail: 'Could not have done another rep' },
  { rir: 1, label: '1 more', detail: 'One more, and that would have been it' },
  { rir: 2, label: '2 more', detail: 'A couple left in the tank' },
  { rir: 3, label: '3 more', detail: 'Comfortably short of failing' },
  { rir: 4, label: '4+ more', detail: 'That felt easy' },
];

/**
 * The headline instruction for a set: what to actually do.
 * Beginners get a sentence; experienced lifters get the compact line.
 */
export function targetLine(p, unit, beginner = isBeginner()) {
  const load = p.weight == null ? null : `${trim(p.weight)}${unit}`;
  if (!beginner) {
    return p.weight == null
      ? `${p.sets} × ${p.targetReps} reps @ ${p.targetRir} RIR — pick your load`
      : `${p.sets} × ${p.targetReps} @ ${load} · ${p.targetRir} RIR`;
  }
  const stop = p.targetRir === 0
    ? 'and stop when you genuinely cannot do another'
    : `and stop with about ${p.targetRir} ${p.targetRir === 1 ? 'rep' : 'reps'} still in you`;
  return p.weight == null
    ? `${p.sets} sets of about ${p.targetReps} reps — choose a weight you could stop ${stop.replace('and stop ', '')}`
    : `${p.sets} sets of ${p.targetReps} reps at ${load}, ${stop}`;
}

/**
 * Why that instruction. Composed from the decision the engine made rather than
 * translated from its wording, so nothing is lost in a find-and-replace.
 */
export function reasonLine(p, unit, beginner = isBeginner()) {
  if (!beginner) return p.rationale;
  const prev = p.previous;
  const load = p.weight == null ? '' : `${trim(p.weight)}${unit}`;

  switch (p.tag) {
    case 'establish':
      return p.weight == null
        ? 'First time doing this one here, so there is nothing to go on yet. Warm up, ' +
          'then pick a weight that feels manageable - it is better to start too light ' +
          'and find out than to start too heavy and learn nothing. Whatever you do, ' +
          'write it down: everything from next week is worked out from it.'
        : `Starting point worked out from the last time you did this movement. Treat this ` +
          `week as a test - log honestly and the weights sort themselves out from here.`;

    case 'load-up':
      return `Last time you got ${prev.reps} reps and still had ${effortWords(prev.rir)}. ` +
        `That is the signal to add weight, so you are going up to ${load} and back down to ` +
        `${p.targetReps} reps. The reps will climb again over the next few weeks.`;

    case 'rep-up':
      return `Last time was ${prev.reps} reps at ${load} and it landed about right. ` +
        `Same weight, one more rep. Getting an extra rep is progress - it counts just as ` +
        `much as adding weight, and it is much kinder to your technique.`;

    case 'hold':
      return `Last time you pushed harder than the plan asked for - only ${effortWords(prev.rir)} ` +
        `when there should have been ${p.targetRir}. You are already ahead, so nothing goes up ` +
        `this week. Repeating a session is not standing still; it is letting the plan catch up ` +
        `to where you already are.`;

    case 'back-off':
      return `Last time you managed ${prev.reps} reps, which was short of what this exercise ` +
        `needs to work well. The weight was simply too heavy, so it comes down to ${load}. ` +
        `This is normal and it is not a step backwards - getting the reps is the point.`;

    case 'deload':
      return `Easy week. The weight drops to ${load}, the sets are roughly halved, and you ` +
        `should finish every set feeling like you had plenty left. The hard weeks are done; ` +
        `this is the week they turn into muscle. Do not add anything back.`;

    default:
      return p.rationale;
  }
}

/** The short badge on an exercise card. */
export function tagLabel(tag, beginner = isBeginner()) {
  const technical = {
    'load-up': 'Load up', 'rep-up': 'Add a rep', hold: 'Hold',
    'back-off': 'Back off', deload: 'Deload', establish: 'Set your baseline',
  };
  const plain = {
    'load-up': 'Heavier today', 'rep-up': 'One more rep', hold: 'Same as last time',
    'back-off': 'Lighter today', deload: 'Easy week', establish: 'Find your weight',
  };
  return (beginner ? plain : technical)[tag] ?? tag;
}

/** Plain reading of where a muscle's weekly volume sits. */
export function volumeStatusLine(row, beginner = isBeginner()) {
  if (!beginner) return `${row.status.label} — ${row.status.advice}`;
  switch (row.status.zone) {
    case 'none': return 'Not trained yet this week.';
    case 'below-mev': return 'Not quite enough work yet to build much here.';
    case 'productive': return 'A good amount of work - this is where growth happens.';
    case 'near-mrv': return 'Plenty of work. Keep an eye on how sore and beaten up you feel.';
    case 'over-mrv': return 'More than you are likely to recover from. Extra sets here are costing you.';
    default: return row.status.advice;
  }
}

/** Warm-up guidance, which nobody tells beginners and everybody assumes. */
export function warmupAdvice(exercise, weight, unit) {
  if (!weight || weight <= 0) {
    return exercise.type === 'compound'
      ? ['Do a couple of easy sets of the movement itself before your real sets.']
      : ['One light set to feel the movement is plenty here.'];
  }
  if (exercise.type !== 'compound') {
    return [`One set of about 10 at ${trim(weight * 0.5)}${unit}, then straight into your real sets.`];
  }
  return [
    `8 reps at ${trim(weight * 0.4)}${unit}`,
    `5 reps at ${trim(weight * 0.6)}${unit}`,
    `3 reps at ${trim(weight * 0.8)}${unit}`,
    'Then your first real set. Rest a minute or two after the last warm-up.',
  ];
}

function trim(n) {
  const rounded = Math.round(Number(n) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}
