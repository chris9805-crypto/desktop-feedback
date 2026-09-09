/**
 * Achievements.
 *
 * The hard rule here: an achievement must reward something that actually makes
 * you bigger or stronger. That sounds obvious until you write one. "Most sets
 * in a week" rewards training past what you can recover from, which is the
 * exact failure this app exists to prevent - a badge for it would be the app
 * arguing with itself.
 *
 * So these reward turning up, following the plan, logging honestly, and taking
 * the easy week. Especially the easy week: it is the single most-skipped part
 * of a training block and the one that converts the work into muscle, so it is
 * worth more than anything else here.
 */

export const TIERS = { bronze: 1, silver: 2, gold: 3 };

export const ACHIEVEMENTS = [
  /* --- turning up ---------------------------------------------------- */
  {
    id: 'first-session', name: 'Started', tier: 'bronze', xp: 50,
    icon: '●',
    blurb: 'Logged your first session.',
    detail: 'The hardest one. Everything the app does from here is calculated from what you just logged.',
    test: (s) => s.totals.sessions >= 1,
    progress: (s) => ({ have: s.totals.sessions, need: 1 }),
  },
  {
    id: 'ten-sessions', name: 'Regular', tier: 'bronze', xp: 100,
    icon: '◐',
    blurb: 'Ten sessions logged.',
    detail: 'Past the point where most people quit.',
    test: (s) => s.totals.sessions >= 10,
    progress: (s) => ({ have: s.totals.sessions, need: 10 }),
  },
  {
    id: 'fifty-sessions', name: 'Established', tier: 'silver', xp: 300,
    icon: '◑',
    blurb: 'Fifty sessions logged.',
    detail: 'Roughly three months of consistent training. This is where the mirror starts agreeing with you.',
    test: (s) => s.totals.sessions >= 50,
    progress: (s) => ({ have: s.totals.sessions, need: 50 }),
  },
  {
    id: 'hundred-sessions', name: 'Long game', tier: 'gold', xp: 800,
    icon: '●',
    blurb: 'One hundred sessions logged.',
    detail: 'Very few people get here. The ones who do are the ones who look like they lift.',
    test: (s) => s.totals.sessions >= 100,
    progress: (s) => ({ have: s.totals.sessions, need: 100 }),
  },

  /* --- consistency ---------------------------------------------------- */
  {
    id: 'streak-5', name: 'On a roll', tier: 'bronze', xp: 75,
    icon: '▲',
    blurb: 'Five planned sessions in a row, none missed.',
    detail: 'Rest days do not break this. Only skipping a session you had planned does.',
    test: (s) => s.streak.best >= 5,
    progress: (s) => ({ have: s.streak.best, need: 5 }),
  },
  {
    id: 'streak-20', name: 'Reliable', tier: 'silver', xp: 250,
    icon: '▲',
    blurb: 'Twenty planned sessions in a row.',
    detail: 'A full block and then some, without missing one.',
    test: (s) => s.streak.best >= 20,
    progress: (s) => ({ have: s.streak.best, need: 20 }),
  },
  {
    id: 'perfect-week', name: 'Clean week', tier: 'bronze', xp: 120,
    icon: '■',
    blurb: 'Every session in a training week, logged.',
    detail: 'Not the hardest week - the complete one.',
    test: (s) => s.totals.perfectWeeks >= 1,
    progress: (s) => ({ have: s.totals.perfectWeeks, need: 1 }),
  },

  /* --- the part everyone skips ---------------------------------------- */
  {
    id: 'took-the-deload', name: 'Took the easy week', tier: 'gold', xp: 400,
    icon: '▬',
    blurb: 'Completed a deload instead of skipping it.',
    detail: 'The most-skipped week in training and the one where the previous four turn into ' +
            'muscle. Worth more here than any amount of extra work, because it is what makes ' +
            'the extra work count.',
    test: (s) => s.totals.deloadsCompleted >= 1,
    progress: (s) => ({ have: s.totals.deloadsCompleted, need: 1 }),
  },
  {
    id: 'full-block', name: 'Block finished', tier: 'gold', xp: 600,
    icon: '◆',
    blurb: 'Finished an entire five-week block, deload included.',
    detail: 'A complete training cycle. This is the unit progress is actually measured in.',
    test: (s) => s.totals.blocksCompleted >= 1,
    progress: (s) => ({ have: s.totals.blocksCompleted, need: 1 }),
  },

  /* --- honest logging -------------------------------------------------- */
  {
    id: 'honest-50', name: 'Straight answers', tier: 'bronze', xp: 100,
    icon: '○',
    blurb: 'Reported your effort on fifty sets.',
    detail: 'The one number the app cannot work out for you. Every weight it picks comes from these.',
    test: (s) => s.totals.setsWithEffort >= 50,
    progress: (s) => ({ have: s.totals.setsWithEffort, need: 50 }),
  },
  {
    id: 'full-feedback', name: 'Told it everything', tier: 'silver', xp: 200,
    icon: '○',
    blurb: 'Answered the end-of-session questions ten times.',
    detail: 'This is what moves your volume up where you recover and down where you do not.',
    test: (s) => s.totals.sessionsWithFeedback >= 10,
    progress: (s) => ({ have: s.totals.sessionsWithFeedback, need: 10 }),
  },

  /* --- actual progress -------------------------------------------------- */
  {
    id: 'first-pr', name: 'First record', tier: 'bronze', xp: 80,
    icon: '△',
    blurb: 'Set your first estimated best on any lift.',
    detail: 'Worked out from your normal sets - you never have to attempt a true maximum.',
    test: (s) => s.totals.prs >= 1,
    progress: (s) => ({ have: s.totals.prs, need: 1 }),
  },
  {
    id: 'twenty-prs', name: 'Twenty records', tier: 'silver', xp: 250,
    icon: '△',
    blurb: 'Twenty personal bests across your lifts.',
    detail: 'Steady, boring, repeated progress. The kind that adds up.',
    test: (s) => s.totals.prs >= 20,
    progress: (s) => ({ have: s.totals.prs, need: 20 }),
  },
  {
    id: 'balanced-week', name: 'Nothing neglected', tier: 'silver', xp: 200,
    icon: '▣',
    blurb: 'A week where every muscle you trained landed in its productive range.',
    detail: 'Not too little to grow, not more than you can recover from. Harder than it sounds.',
    test: (s) => s.totals.balancedWeeks >= 1,
    progress: (s) => ({ have: s.totals.balancedWeeks, need: 1 }),
  },
];

export const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
