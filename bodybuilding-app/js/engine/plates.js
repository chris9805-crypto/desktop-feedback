/**
 * What to put on the bar.
 *
 * The app prescribes 102.5kg and then leaves you doing arithmetic with a
 * barbell in front of you. Every lifter does this sum, every working set, and
 * gets it wrong often enough that gyms have people pressing 97.5 thinking it is
 * 100. It is a pure function of the weight and the plates in the room, so the
 * app should do it.
 *
 * Unlimited pairs of each plate are assumed. Real gyms run out of 20s, but
 * telling someone the loadout they cannot make is a worse failure than assuming
 * a rack that is normally stocked, and tracking an inventory would mean asking
 * them to maintain one.
 */

/** Bars people actually train on, heaviest first. */
export const BARS = {
  kg: [
    { weight: 20, label: '20kg — standard Olympic bar' },
    { weight: 15, label: '15kg — women’s Olympic bar' },
    { weight: 10, label: '10kg — training bar' },
    { weight: 7, label: '7kg — fixed / EZ bar' },
  ],
  lb: [
    { weight: 45, label: '45lb — standard Olympic bar' },
    { weight: 35, label: '35lb — women’s Olympic bar' },
    { weight: 25, label: '25lb — training bar' },
    { weight: 15, label: '15lb — fixed / EZ bar' },
  ],
};

export const DEFAULT_BAR = { kg: 20, lb: 45 };

/** The plates a normally stocked gym has, in the unit being lifted in. */
export const DEFAULT_PLATES = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lb: [45, 35, 25, 10, 5, 2.5],
};

/**
 * Competition plate colours, which is what the diagram uses. Anything not on
 * the list falls back to grey - a custom plate should look like a plate, just
 * not like one it is pretending to be.
 */
const COLOURS = {
  kg: { 25: '#c8352f', 20: '#2a63c0', 15: '#e0b425', 10: '#2f9e4f', 5: '#e8e6e1', 2.5: '#2b2b2b', 1.25: '#9aa0a6' },
  lb: { 55: '#c8352f', 45: '#2a63c0', 35: '#e0b425', 25: '#2f9e4f', 10: '#e8e6e1', 5: '#2b2b2b', 2.5: '#9aa0a6' },
};

export function plateColour(weight, unit = 'kg') {
  return COLOURS[unit]?.[weight] ?? '#8c8b83';
}

/** Two decimal places, because 1.25kg plates exist and floats do not round. */
function cents(n) {
  return Math.round(n * 100);
}

/**
 * How to load `total` on the bar.
 *
 * Returns the closest weight the plates can actually make at or below the
 * target, so the answer is always loadable. `exact` says whether that matched,
 * and `achieved` is what you would really be lifting - which the caller should
 * show rather than hide, because a 1.25kg gap is the difference between a
 * record and not.
 */
export function loadout(total, { bar = 20, plates = DEFAULT_PLATES.kg } = {}) {
  if (!Number.isFinite(total) || !Number.isFinite(bar)) return null;
  if (cents(total) < cents(bar)) {
    return { bar, perSide: [], achieved: bar, exact: cents(total) === cents(bar), short: total - bar, tooLight: true };
  }

  const usable = [...plates].filter((p) => p > 0).sort((a, b) => b - a);
  let remaining = cents(total - bar) / 2;      // one side
  const perSide = [];

  for (const plate of usable) {
    const step = cents(plate);
    const count = Math.floor(remaining / step);
    if (count > 0) {
      perSide.push({ weight: plate, count });
      remaining -= count * step;
    }
  }

  const achieved = bar + (cents(total - bar) / 2 - remaining) * 2 / 100;
  return {
    bar,
    perSide,
    achieved,
    exact: remaining === 0,
    short: total - achieved,
    tooLight: false,
  };
}

/** `20 · 20 · 5` - what goes on each side, outside first. */
export function shorthand(result) {
  if (!result || !result.perSide.length) return 'bar only';
  return result.perSide
    .flatMap(({ weight, count }) => Array.from({ length: count }, () => String(weight)))
    .join(' · ');
}

/** Total number of plates you will pick up per side - the lifting, not the maths. */
export function plateCount(result) {
  return (result?.perSide ?? []).reduce((n, p) => n + p.count, 0);
}

/**
 * The weights this bar and plate set can actually make, as a sorted list, used
 * to nudge a prescription onto something loadable.
 */
export function nearestLoadable(total, options = {}) {
  const down = loadout(total, options);
  if (!down || down.tooLight) return down?.bar ?? null;
  if (down.exact) return down.achieved;

  const smallest = Math.min(...[...(options.plates ?? DEFAULT_PLATES.kg)].filter((p) => p > 0));
  const up = loadout(total + smallest * 2, options);
  const upValue = up && !up.tooLight ? up.achieved : null;
  if (upValue == null) return down.achieved;
  return (total - down.achieved) <= (upValue - total) ? down.achieved : upValue;
}
