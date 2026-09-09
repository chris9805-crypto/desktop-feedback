/**
 * Training phases: what you are eating for.
 *
 * Separate from training mode, which is about how experienced you are. Mode
 * decides how the app talks to you and how close to failure it sends you;
 * phase decides what counts as a good week.
 *
 * This distinction matters because in a deficit the app's normal behaviour is
 * actively wrong, not merely unhelpful:
 *
 *   - Progression targets assume more is possible. On a cut it usually is not,
 *     so every week reads as a failed week.
 *   - Missing a rep target drops the load. Miss occasionally while genuinely
 *     maintaining and the loads ratchet down, because each drop lowers the
 *     next target. Over a block that can cost far more than the diet does.
 *   - Weekly volume climbs. Recovery is impaired in a deficit, so that is the
 *     wrong direction and the ceiling is genuinely lower.
 *
 * So a cutting phase changes the goal to holding, makes the load floor sticky,
 * flattens volume, and moves success from "beat it" to "matched it".
 */

export const PHASES = {
  gain: {
    id: 'gain',
    name: 'Gaining',
    tagline: 'Eating enough to build',
    summary:
      'The normal case. Load and volume climb week to week, and the app pushes ' +
      'you to beat what you did last time.',
    detail: 'Pick this if you are eating at or above maintenance and the scale is stable or rising.',

    /* --- how progression behaves -------------------------------------- */
    // 'push' asks for more every week; 'hold' treats matching as the target.
    goal: 'push',
    // Weekly set change when no feedback says otherwise.
    weeklySetDelta: 1,
    // How far a missed session pulls the load back, and how many misses first.
    backOffFactor: 0.94,
    missesBeforeBackOff: 1,
    // Multiplier on each muscle's maximum recoverable volume.
    mrvFactor: 1,
    // Added to the effort floor - how far from failure to stay.
    rirFloorBonus: 0,

    successLine: 'Beat last week.',
  },

  maintain: {
    id: 'maintain',
    name: 'Maintaining',
    tagline: 'Holding steady, eating around maintenance',
    summary:
      'Volume stops climbing and load only moves when you clearly earn it. Useful ' +
      'between blocks, in a busy stretch of life, or when you are happy where you are.',
    detail: 'Pick this if you are eating roughly at maintenance and not trying to change weight.',

    goal: 'push',
    weeklySetDelta: 0,
    backOffFactor: 0.96,
    missesBeforeBackOff: 2,
    mrvFactor: 0.9,
    rirFloorBonus: 0,

    successLine: 'Hold what you have, take progress where it comes.',
  },

  cut: {
    id: 'cut',
    name: 'Cutting',
    tagline: 'In a deficit — the job is keeping what you built',
    summary:
      'Matching last week is the win, not a stall. Load will not creep down from ' +
      'the odd missed session, volume stops climbing because you cannot recover ' +
      'from more, and sets stop further from failure. Progress still counts when ' +
      'it comes — it is just not what you are being asked for.',
    detail: 'Pick this if you are eating in a deficit and losing weight on purpose.',

    goal: 'hold',
    weeklySetDelta: 0,
    // A gentle, slow-to-trigger back-off. The ratchet is the thing to avoid:
    // in a deficit you will have off days that are not a sign the load is wrong.
    backOffFactor: 0.97,
    missesBeforeBackOff: 2,
    // Recoverable volume genuinely drops in a deficit.
    mrvFactor: 0.8,
    // Grinding to failure in a deficit recovers worse and injures more, for less.
    rirFloorBonus: 1,

    successLine: 'Match last week. Holding is the win.',
  },
};

export const PHASE_ORDER = ['gain', 'maintain', 'cut'];
export const DEFAULT_PHASE = 'gain';

export function getPhase(id) {
  return PHASES[id] ?? PHASES[DEFAULT_PHASE];
}

/** True when the phase treats repeating a performance as a success. */
export function holdingIsSuccess(phaseId) {
  return getPhase(phaseId).goal === 'hold';
}
