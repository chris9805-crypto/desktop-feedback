/**
 * Bodyweight, as a trend.
 *
 * This exists for one reason: to give strength retention a denominator. Holding
 * a 100kg bench while dropping four kilos is not "strength unchanged", it is a
 * meaningful gain in strength per kilo, and without bodyweight the app cannot
 * tell you that.
 *
 * It is built with some deliberate restraint, because a weight-tracking feature
 * is the part of a fitness app most capable of doing harm:
 *
 *   - It is entirely optional and off until you log something.
 *   - The TREND is the number, never today's reading. Day-to-day bodyweight is
 *     mostly water, glycogen and what is still in transit; a single figure is
 *     noise wearing the costume of a fact.
 *   - There is no goal weight, no projected finish date, no "behind schedule",
 *     and no calorie estimates. The app has no way to know any of that and
 *     guessing would be both wrong and unkind.
 *   - The only judgement it offers is on RATE, because rate is the part that
 *     actually affects whether you keep your muscle.
 */

/** Days of readings averaged together to smooth out day-to-day noise. */
export const SMOOTH_WINDOW_DAYS = 7;
/** Below this much history, a rate of change is not worth quoting. */
export const MIN_POINTS_FOR_RATE = 4;
export const MIN_DAYS_FOR_RATE = 10;
/** How far back the rate is measured over. */
export const RATE_WINDOW_DAYS = 21;

const DAY = 86400000;

/**
 * Smoothed series: each reading replaced by the average of everything within
 * the preceding week. Handles irregular spacing, because nobody weighs
 * themselves on a schedule and demanding it would be the wrong ask.
 */
export function smooth(weighIns, { windowDays = SMOOTH_WINDOW_DAYS } = {}) {
  const points = [...weighIns]
    .filter((w) => Number.isFinite(Number(w.weight)) && Number(w.weight) > 0)
    .sort((a, b) => a.date - b.date);

  return points.map((point, i) => {
    const from = point.date - windowDays * DAY;
    let sum = 0;
    let count = 0;
    for (let j = i; j >= 0; j--) {
      if (points[j].date < from) break;
      sum += Number(points[j].weight);
      count += 1;
    }
    return { date: point.date, raw: Number(point.weight), value: sum / count, samples: count };
  });
}

/**
 * Rate of change, from a least-squares fit over the recent smoothed series.
 *
 * A fit rather than first-versus-last, because two endpoints can both be noise
 * and a trend built from them is a coin flip presented as information.
 */
export function trend(weighIns, { now = Date.now(), windowDays = RATE_WINDOW_DAYS } = {}) {
  const series = smooth(weighIns);
  const recent = series.filter((p) => p.date >= now - windowDays * DAY);
  const span = recent.length ? (recent.at(-1).date - recent[0].date) / DAY : 0;

  const current = series.length ? series.at(-1).value : null;
  const base = {
    series,
    current,
    latest: series.length ? series.at(-1).raw : null,
    lastLoggedAt: series.length ? series.at(-1).date : null,
    perWeek: null,
    pctPerWeek: null,
    direction: 'unknown',
    confident: false,
  };

  if (recent.length < MIN_POINTS_FOR_RATE || span < MIN_DAYS_FOR_RATE) return base;

  // Least squares on (days, weight).
  const t0 = recent[0].date;
  const xs = recent.map((p) => (p.date - t0) / DAY);
  const ys = recent.map((p) => p.value);
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  if (den === 0) return base;

  const perDay = num / den;
  const perWeek = perDay * 7;
  const pctPerWeek = current > 0 ? (perWeek / current) * 100 : 0;

  return {
    ...base,
    perWeek,
    pctPerWeek,
    direction: pctPerWeek < -0.15 ? 'down' : pctPerWeek > 0.15 ? 'up' : 'flat',
    confident: true,
  };
}

/**
 * The only judgement offered, and only on rate.
 *
 * Roughly 0.5-1% of bodyweight a week is the range where a cut mostly costs fat.
 * Faster than that and the share coming from muscle climbs sharply - which is
 * exactly what someone using this app is trying to avoid, so it is worth
 * saying. Slower is not a problem, just slower.
 */
export function rateAdvice(trendResult, phaseId = 'gain') {
  if (!trendResult.confident) {
    return {
      level: 'unknown',
      label: 'Not enough readings yet',
      line: `A few more weigh-ins over a couple of weeks and the trend becomes meaningful. `
        + `Single readings are mostly water.`,
    };
  }

  const pct = trendResult.pctPerWeek;

  if (phaseId === 'cut') {
    if (pct > 0.15) {
      return {
        level: 'warning',
        label: 'Not actually losing',
        line: 'The trend is upward. That is fine if you have changed your mind, but it is not a deficit.',
      };
    }
    if (pct > -0.3) {
      return {
        level: 'info',
        label: 'Very slow',
        line: 'Barely moving. Nothing wrong with that - it just is not much of a cut yet.',
      };
    }
    if (pct >= -1) {
      return {
        level: 'good',
        label: 'Good rate',
        line: 'In the range where a cut mostly costs fat. This is the pace that keeps your strength.',
      };
    }
    return {
      level: 'warning',
      label: 'Losing quickly',
      line: `Faster than about 1% a week and the share of the loss coming from muscle climbs `
        + `sharply. If your lifts are also sliding, this is usually the reason.`,
    };
  }

  if (phaseId === 'gain') {
    if (pct > 0.75) {
      return {
        level: 'warning',
        label: 'Gaining quickly',
        line: 'Above roughly 0.5% a week, most of the extra tends to be fat rather than muscle.',
      };
    }
    if (pct >= 0.1) {
      return { level: 'good', label: 'Steady gain', line: 'A sensible rate to build on.' };
    }
    if (pct > -0.15) {
      return {
        level: 'info',
        label: 'Holding steady',
        line: 'Weight is flat. Building on this is possible but slower - you may simply not be eating enough.',
      };
    }
    return {
      level: 'info',
      label: 'Drifting down',
      line: 'You are losing weight while set to Gaining. Worth checking one of the two is wrong.',
    };
  }

  // Maintaining.
  if (Math.abs(pct) <= 0.25) {
    return { level: 'good', label: 'Steady', line: 'Holding within normal fluctuation.' };
  }
  return {
    level: 'info',
    label: pct > 0 ? 'Drifting up' : 'Drifting down',
    line: 'Moving more than maintenance normally does. Not a problem - just not maintenance.',
  };
}

/** Change over a window, for the "and you are down 3.4kg" line. */
export function changeOver(weighIns, days, { now = Date.now() } = {}) {
  const series = smooth(weighIns);
  if (series.length < 2) return null;
  const cutoff = now - days * DAY;
  const earlier = series.filter((p) => p.date <= cutoff).at(-1) ?? series[0];
  const latest = series.at(-1);
  if (!earlier || earlier === latest) return null;
  return {
    from: earlier.value,
    to: latest.value,
    delta: latest.value - earlier.value,
    days: Math.round((latest.date - earlier.date) / DAY),
  };
}
