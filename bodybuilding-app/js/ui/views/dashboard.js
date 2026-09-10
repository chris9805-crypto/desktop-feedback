/**
 * Today.
 *
 * The old version of this screen opened with three paragraphs. Nobody reads
 * three paragraphs standing in a gym doorway, and a wall of prose is what makes
 * an app feel like homework.
 *
 * So it opens with the four things that answer "how am I doing" at a glance -
 * streak, level, week, next session - as numbers and shapes rather than
 * sentences. Explanation is still available everywhere, but it is one tap down
 * instead of in the way.
 *
 * The hooks are deliberately pointed at behaviour that works: the streak counts
 * sessions rather than days so rest never breaks it, and the ring fills toward
 * finishing a training week rather than toward doing more sets than last time.
 */

import { h, clear, fmtWeight, fmtNumber, relativeDay } from '../dom.js';
import { store } from '../../store.js';
import { getProgram } from '../../data/programs.js';
import { getExercise } from '../../data/exercises.js';
import { weekPlan, mesoProgress, totalWeeks, estimateSessionMinutes } from '../../engine/mesocycle.js';
import { setsByMuscle, volumeReport, volumeFlags } from '../../engine/volume.js';
import { strengthTrend } from '../../engine/progression.js';
import { levelTitle } from '../../engine/progress.js';
import { VERDICT_COPY } from '../../engine/retention.js';
import { promptSheet } from '../sheet.js';
import { routeTo } from '../../util/route.js';
import { volumeChart, trendChart } from '../charts.js';
import { volumeStatusLine, usePlainLanguage } from '../explain.js';
import { term } from '../term.js';

export function render(container) {
  clear(container);
  const meso = store.activeMeso();
  container.append(meso ? active(meso, container) : welcome());
}

/* ------------------------------------------------------------- the top */

function active(meso, container) {
  const program = getProgram(meso.programId);
  const sessions = store.mesoSessions(meso.id);
  const next = store.nextUp();
  const progress = store.progress();
  const phase = store.phase();
  const blockProgress = mesoProgress(meso, sessions);
  const wrap = h('div', { class: 'stack' });

  /* --- the four numbers ------------------------------------------------ */
  wrap.append(h('div', { class: 'scoreboard' },
    tile({
      value: String(progress.streak.current),
      label: 'session streak',
      accent: progress.streak.current > 0,
      foot: progress.streak.atRisk ? 'Train soon to keep it' : 'Rest days don’t break it',
      warn: progress.streak.atRisk,
    }),
    tile({
      value: String(progress.level.level),
      label: levelTitle(progress.level.level),
      ring: progress.level.pct,
      foot: `${fmtNumber(progress.level.next - progress.xp)} XP to level ${progress.level.level + 1}`,
    }),
    tile({
      value: `${blockProgress.done}/${blockProgress.total}`,
      label: 'block',
      ring: blockProgress.pct,
      foot: next ? next.plan.label : 'Complete',
    }),
  ));

  /* --- next session, as an action not a paragraph ---------------------- */
  if (next) {
    const minutes = estimateSessionMinutes(next.day);
    const sets = next.day.slots.reduce((n, s) => n + s.sets, 0);
    wrap.append(h('a', { class: 'next-card', href: '#/train' },
      h('div', { class: 'next-body' },
        h('span', { class: 'next-eyebrow' }, next.plan.deload ? 'Easy week' : next.plan.label),
        h('h2', {}, next.day.name),
        h('div', { class: 'chips' },
          chip(`${sets} sets`),
          chip(`~${minutes} min`),
          chip(next.plan.deload ? 'Back off' : `${next.plan.targetRir} in reserve`),
          phase.goal === 'hold' && chip('Match last week'),
        ),
      ),
      h('span', { class: 'next-go' }, 'Start'),
    ));
    // Tapping an exercise starts the session and goes straight to it. Useful
    // when the first machine is taken and you would rather begin elsewhere -
    // the order is yours anyway, so the shortcut should be too.
    wrap.append(h('div', { class: 'exercise-strip' },
      ...next.day.slots.slice(0, 6).map((s) => h('a', {
        href: routeTo('/train', { week: next.weekIndex, day: next.day.id, at: s.exerciseId }),
        title: `Start here — ${getExercise(s.exerciseId)?.name ?? s.exerciseId}`,
      }, getExercise(s.exerciseId)?.name ?? s.exerciseId)),
      next.day.slots.length > 6 && h('a', {
        class: 'muted',
        href: routeTo('/train', { week: next.weekIndex, day: next.day.id }),
      }, `+${next.day.slots.length - 6} more`),
    ));
  } else {
    wrap.append(h('a', { class: 'next-card', href: '#/programs' },
      h('div', { class: 'next-body' },
        h('span', { class: 'next-eyebrow' }, 'Block complete'),
        h('h2', {}, 'Start the next one'),
        h('div', { class: 'chips' }, chip('Picks up from where you finished')),
      ),
      h('span', { class: 'next-go' }, 'Choose'),
    ));
  }

  /* --- the week, as dots ----------------------------------------------- */
  const weekIndex = next?.weekIndex ?? totalWeeks(program) - 1;
  const plan = weekPlan(meso, sessions, weekIndex);
  wrap.append(h('div', { class: 'panel' },
    h('div', { class: 'panel-head' },
      h('h3', {}, plan.label),
      h('span', { class: 'muted small' }, meso.name),
    ),
    h('div', { class: 'daydots' },
      // Each day is a link into the thing it represents: an unfinished day
      // opens Train ready to run it, a finished one opens its entry in History.
      // Looking at a grid of days and not being able to tap one is the kind of
      // small dead end that makes an app feel like a printout.
      ...plan.days.map((day) => h('a', {
        class: `daydot${day.done ? ' is-done' : ''}${day.id === next?.day.id ? ' is-next' : ''}`,
        href: day.done
          ? routeTo('/history', { session: day.sessionId })
          : routeTo('/train', { week: weekIndex, day: day.id }),
        title: day.done
          ? `${day.name} — logged, tap to review`
          : `${day.name} — tap to train this one`,
        'aria-label': day.done ? `Review ${day.name}` : `Train ${day.name}`,
      }, dayInitials(day.name))),
    ),
  ));

  /* --- what just changed ------------------------------------------------ */
  const recent = [...store.state.sessions].sort((a, b) => b.date - a.date).slice(0, 3);
  if (recent.length) {
    wrap.append(h('div', { class: 'panel' },
      h('div', { class: 'panel-head' },
        h('h3', {}, 'Recent'),
        h('a', { class: 'small', href: '#/history' }, 'All'),
      ),
      h('div', { class: 'recent-list' }, ...recent.map((s) => {
        const day = getProgram(s.programId)?.days.find((d) => d.id === s.dayId);
        const setCount = s.entries.reduce((n, e) => n + e.sets.length, 0);
        return h('div', { class: 'recent-row' },
          h('span', { class: 'recent-name' }, day?.name ?? s.dayId),
          h('span', { class: 'muted small' }, relativeDay(s.date)),
          h('span', { class: 'recent-sets' }, `${setCount} sets`),
        );
      })),
    ));
  }

  /* --- badges just earned, and the next one within reach ---------------- */
  wrap.append(achievementStrip(progress));

  /* --- volume, only once there is something to show --------------------- */
  const weekSessions = sessions.filter((s) => s.week === weekIndex);
  if (weekSessions.length) {
    const totals = setsByMuscle(weekSessions);
    const report = volumeReport(totals).filter((r) => r.sets > 0 || r.mev > 0);
    // Mid-week, only an over-the-ceiling muscle is worth flagging. Everything
    // is below its weekly target on Monday; saying so is noise.
    const weekComplete = plan.days.every((d) => d.done);
    const flags = volumeFlags(totals, { weekComplete });
    wrap.append(h('details', { class: 'panel expandable' },
      h('summary', {},
        h('h3', {}, 'Volume this week'),
        h('span', { class: 'muted small' },
          flags.length ? `${flags.length} to watch`
            : weekComplete ? 'On track' : `${weekSessions.length}/${plan.days.length} in`),
      ),
      h('div', { style: 'margin-top:14px' },
        volumeChart(report),
        ...flags.slice(0, 3).map((f) => h('div', {
          class: `notice${f.status.zone === 'over-mrv' ? ' is-critical' : ''}`,
          style: 'margin-top:10px',
        }, h('b', {}, `${f.name}: `), volumeStatusLine(f))),
      ),
    ));
  }

  /* --- weak points, advanced only --------------------------------------- */
  const mode = store.mode();
  if (mode.showImbalances) {
    const { findings } = store.weakPoints();
    if (findings.length) {
      wrap.append(h('details', { class: 'panel expandable' },
        h('summary', {},
          h('h3', {}, 'Weak points'),
          h('span', { class: 'badge badge-warning' }, String(findings.length)),
        ),
        h('div', { class: 'stack', style: 'gap:10px;margin-top:14px' },
          ...findings.slice(0, 3).map((f) => h('div', { class: 'finding' },
            h('h4', {}, f.title),
            h('p', {}, f.detail),
            h('p', { class: 'evidence' }, f.evidence),
          )),
        ),
      ));
    }
  }

  /* --- retention --------------------------------------------------------- */
  const retention = store.retention();
  if (retention.pct != null && (phase.goal === 'hold' || retention.verdict === 'losing')) {
    const copy = VERDICT_COPY[retention.verdict] ?? VERDICT_COPY.unknown;
    wrap.append(h('div', { class: 'panel retention' },
      h('div', { class: 'panel-head' },
        h('h3', {}, 'Strength retention'),
        h('span', { class: `badge badge-${retention.verdict === 'losing' ? 'critical' : retention.verdict === 'slipping' ? 'warning' : 'good'}` },
          copy.label),
      ),
      h('div', { class: 'retention-figure' },
        h('span', { class: 'retention-pct num' }, `${retention.pct}%`),
        h('div', {},
          h('div', { class: 'small strong' }, 'of your best, held'),
          h('div', { class: 'tiny muted' },
            `${retention.held} of ${retention.total} lifts within 3% of their peak`),
        ),
      ),
      h('p', { class: 'secondary small', style: 'margin:10px 0 0' }, copy.line),
      // The line that makes a cut legible: same bar, less of you lifting it.
      retention.relative && retention.relative.improved && h('div', { class: 'relative-note' },
        h('b', {}, `+${retention.relative.changePct.toFixed(1)}% strength per kilo`),
        ` — you are moving the same weight at `,
        fmtWeight(Math.round(retention.relative.bodyweightNow * 10) / 10, store.state.settings.unit),
        `, down from `,
        fmtWeight(Math.round(retention.relative.bodyweightThen * 10) / 10, store.state.settings.unit),
        `. That is a real gain the headline number cannot show.`),
      h('div', { class: 'retention-list' }, ...retention.lifts.slice(0, 5).map((lift) => h('div', {
        class: `retention-row${lift.held ? ' is-held' : ''}`,
      },
        h('span', { class: 'retention-name' }, lift.name),
        h('div', { class: 'retention-bar' },
          h('div', {
            class: 'retention-fill',
            style: `width:${Math.min(100, lift.pct)}%`,
          }),
        ),
        h('span', { class: 'retention-value num' }, `${lift.pct}%`),
      ))),
      h('p', { class: 'tiny muted', style: 'margin:12px 0 0' },
        'This is strength retention, not muscle retention — no app can measure muscle. ' +
        'Strength is the best signal a training log has, and a good one, but it is a proxy.'),
    ));
  }

  /* --- weigh-ins (optional, and only where they help) --------------------- */
  if (phase.goal === 'hold' || store.hasWeighIns()) {
    wrap.append(weighInPanel(container));
  }

  /* --- strength ---------------------------------------------------------- */
  if (mode.showE1rm) {
    const anchors = anchorLifts(program);
    const trends = anchors.map((id) => {
      const entries = store.state.sessions
        .filter((s) => s.entries?.some((e) => e.exerciseId === id))
        .sort((a, b) => a.date - b.date)
        .map((s) => ({ date: s.date, ...s.entries.find((e) => e.exerciseId === id) }));
      return { id, trend: strengthTrend(entries) };
    }).filter((t) => t.trend.points.length >= 2);

    if (trends.length) {
      wrap.append(h('details', { class: 'panel expandable' },
        h('summary', {},
          h('h3', {}, 'Strength'),
          h('span', { class: 'muted small' }, `${trends.length} lifts tracked`),
        ),
        h('div', { style: 'margin-top:14px' },
          h('div', { class: 'lift-grid' }, ...trends.map(({ id, trend }) => {
            const latest = Math.round(trend.points.at(-1).e1rm);
            const arrow = trend.direction === 'up' ? '▲' : trend.direction === 'down' ? '▼' : '—';
            return h('div', { class: `lift ${trend.direction}` },
              h('span', { class: 'lift-name' }, getExercise(id).name),
              h('span', { class: 'lift-value num' }, fmtWeight(latest, store.state.settings.unit)),
              h('span', { class: 'lift-delta' },
                `${arrow} ${trend.changePct >= 0 ? '+' : ''}${trend.changePct.toFixed(1)}%`),
            );
          })),
          h('div', { style: 'margin-top:16px' },
            trendChart(trends[0].trend.points.map((p) => ({
              value: Math.round(p.e1rm),
              label: relativeDay(p.date),
              detail: new Date(p.date).toLocaleDateString(),
            })), { unit: store.state.settings.unit })),
        ),
      ));
    }
  }

  return wrap;
}

/**
 * Bodyweight, shown as a trend and nothing else.
 *
 * No goal weight, no projection, no calorie estimate: the app cannot know any
 * of that. The only judgement offered is on rate, because rate is the part
 * that decides whether a cut costs you muscle.
 */
function weighInPanel(container) {
  const bw = store.bodyweight();
  const unit = store.state.settings.unit;
  const phase = store.phase();

  const log = async () => {
    const value = await promptSheet({
      title: 'Log your weight',
      body: 'First thing in the morning is the most comparable. Missing days is fine — '
        + 'the app reads the trend, not any single number.',
      label: `Weight (${unit})`,
      value: bw.latest != null ? String(bw.latest) : '',
      confirmLabel: 'Save',
    });
    if (value == null || value === '') return;
    try { store.addWeighIn(Number(value)); render(container); } catch { /* ignore junk */ }
  };

  if (!store.hasWeighIns()) {
    return h('div', { class: 'panel' },
      h('div', { class: 'panel-head' }, h('h3', {}, 'Bodyweight'), h('span', { class: 'badge' }, 'Optional')),
      h('p', { class: 'secondary small', style: 'margin:10px 0 0' },
        'Logging it lets the app show strength per kilo — holding your lifts while the scale '
        + 'drops is a real gain, and without a bodyweight it just looks like a flat line.'),
      h('button', { class: 'btn-primary', style: 'margin-top:12px', onClick: log }, 'Log a weight'),
    );
  }

  const points = bw.series.slice(-14).map((p) => ({
    value: Math.round(p.value * 10) / 10,
    label: relativeDay(p.date),
    detail: `${Math.round(p.raw * 10) / 10}${unit} on the day`,
  }));

  return h('details', { class: 'panel expandable' },
    h('summary', {},
      h('h3', {}, 'Bodyweight'),
      h('span', { class: `badge badge-${bw.advice.level === 'good' ? 'good' : bw.advice.level === 'warning' ? 'warning' : ''}` },
        bw.advice.label),
    ),
    h('div', {},
      h('div', { class: 'bw-figure' },
        h('span', { class: 'bw-value num' }, fmtWeight(Math.round(bw.current * 10) / 10, unit)),
        h('div', {},
          h('div', { class: 'small strong' }, `${SMOOTH_LABEL} average`),
          bw.confident && h('div', { class: 'tiny muted' },
            `${bw.perWeek >= 0 ? '+' : ''}${bw.perWeek.toFixed(2)}${unit} a week `
            + `(${bw.pctPerWeek >= 0 ? '+' : ''}${bw.pctPerWeek.toFixed(2)}%)`),
        ),
      ),
      h('p', { class: 'secondary small', style: 'margin:8px 0 12px' }, bw.advice.line),
      points.length >= 2 ? trendChart(points, { unit, height: 160 }) : null,
      h('div', { class: 'row', style: 'margin-top:12px' },
        h('button', { class: 'btn-primary btn-sm', onClick: log }, 'Log today'),
        h('span', { class: 'tiny muted' },
          `${bw.series.length} readings · trend only, no target weight`),
      ),
    ),
  );
}

const SMOOTH_LABEL = '7-day';

/* ------------------------------------------------------------- pieces */

function tile({ value, label, foot, ring, accent, warn }) {
  return h('div', { class: `tile${accent ? ' is-accent' : ''}${warn ? ' is-warn' : ''}` },
    ring != null ? ringGraphic(ring, value) : h('span', { class: 'tile-value num' }, value),
    h('span', { class: 'tile-label' }, label),
    foot && h('span', { class: 'tile-foot' }, foot),
  );
}

/** A progress ring. Cheap to read at a glance, which a number alone is not. */
function ringGraphic(pct, value) {
  const size = 62;
  const r = 26;
  const circumference = 2 * Math.PI * r;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('class', 'ring');
  svg.setAttribute('aria-hidden', 'true');
  const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  const fill = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  for (const [el, cls] of [[track, 'ring-track'], [fill, 'ring-fill']]) {
    el.setAttribute('cx', size / 2);
    el.setAttribute('cy', size / 2);
    el.setAttribute('r', r);
    el.setAttribute('fill', 'none');
    el.setAttribute('class', cls);
    svg.appendChild(el);
  }
  fill.setAttribute('stroke-dasharray', `${(pct / 100) * circumference} ${circumference}`);
  fill.setAttribute('transform', `rotate(-90 ${size / 2} ${size / 2})`);
  return h('div', { class: 'ring-wrap' }, svg, h('span', { class: 'ring-value num' }, value));
}

function chip(text) {
  return h('span', { class: 'chip' }, text);
}

/** "Upper A" -> "UA". Two letters of the name alone makes every day identical. */
function dayInitials(name) {
  const parts = String(name).split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return String(name).slice(0, 2).toUpperCase();
}

function achievementStrip(progress) {
  const earned = progress.achievements.filter((a) => a.earned);
  const next = progress.achievements
    .filter((a) => !a.earned && a.progress.have > 0)
    .sort((a, b) => (b.progress.have / b.progress.need) - (a.progress.have / a.progress.need))[0];

  return h('details', { class: 'panel expandable' },
    h('summary', {},
      h('h3', {}, 'Badges'),
      h('span', { class: 'muted small' }, `${earned.length}/${progress.achievements.length}`),
    ),
    h('div', { style: 'margin-top:14px' },
      next && h('div', { class: 'next-badge' },
        h('span', { class: `badge-icon tier-${next.tier}` }, next.icon),
        h('div', {},
          h('b', {}, next.name),
          h('div', { class: 'muted small' }, next.blurb),
          h('div', { class: 'mini-bar' },
            h('div', {
              class: 'mini-fill',
              style: `width:${Math.min(100, (next.progress.have / next.progress.need) * 100)}%`,
            })),
          h('span', { class: 'tiny muted' }, `${next.progress.have} of ${next.progress.need}`),
        ),
      ),
      h('div', { class: 'badge-grid' }, ...progress.achievements.map((a) => h('div', {
        class: `badge-tile tier-${a.tier}${a.earned ? ' is-earned' : ''}`,
        title: a.earned ? `${a.name} — ${a.blurb}` : `Locked: ${a.blurb}`,
      },
        h('span', { class: 'badge-icon' }, a.icon),
        h('span', { class: 'badge-name' }, a.name),
      ))),
      h('a', { class: 'btn btn-sm', href: '#/crew', style: 'margin-top:14px' }, 'Crew standings'),
    ),
  );
}

function anchorLifts(program) {
  const seen = new Set();
  for (const day of program?.days ?? []) {
    for (const slot of day.slots) {
      if (slot.role === 'anchor' && getExercise(slot.exerciseId)?.type === 'compound') seen.add(slot.exerciseId);
    }
  }
  return [...seen].slice(0, 6);
}

/* ------------------------------------------------------------- welcome */

function welcome() {
  return h('div', { class: 'stack' },
    h('div', { class: 'hero' },
      h('h1', {}, 'Lift with a plan'),
      h('p', {}, 'It tells you what to lift. You tap done. It works out the rest.'),
      h('a', { class: 'btn btn-primary btn-lg', href: '#/welcome' }, 'Get started'),
      h('a', { class: 'btn-ghost', href: '#/programs' }, 'Browse programs'),
    ),
    h('div', { class: 'promise-grid' },
      promise('◆', 'Weights worked out for you', 'From what you actually lifted last time.'),
      promise('▲', 'Streaks that survive rest days', 'Counted in sessions, not days.'),
      promise('▬', 'Five-week blocks', 'Four weeks up, one easy week where it turns into muscle.'),
    ),
  );
}

function promise(icon, title, body) {
  return h('div', { class: 'promise' },
    h('span', { class: 'promise-icon' }, icon),
    h('b', {}, title),
    h('span', { class: 'muted small' }, body),
  );
}
