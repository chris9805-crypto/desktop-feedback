/**
 * Dashboard - what to do next, and whether the block is working.
 *
 * Two questions, in that order. Everything else is one scroll further down.
 */

import { h, clear, fmtWeight, fmtNumber, relativeDay } from '../dom.js';
import { store } from '../../store.js';
import { getProgram } from '../../data/programs.js';
import { getExercise } from '../../data/exercises.js';
import { muscleName } from '../../data/muscles.js';
import { weekPlan, mesoProgress, totalWeeks, estimateSessionMinutes } from '../../engine/mesocycle.js';
import { setsByMuscle, volumeReport, volumeFlags } from '../../engine/volume.js';
import { e1rm, tonnage } from '../../engine/onerm.js';
import { bestSet, strengthTrend } from '../../engine/progression.js';
import { volumeChart, trendChart } from '../charts.js';
import { term } from '../term.js';
import { usePlainLanguage, volumeStatusLine } from '../explain.js';
import { getMode } from '../../data/modes.js';

export function render(container) {
  clear(container);
  const meso = store.activeMeso();
  if (!meso) return container.append(welcome());

  const program = getProgram(meso.programId);
  const sessions = store.mesoSessions(meso.id);
  const next = store.nextUp();
  const progress = mesoProgress(meso, sessions);
  const unit = store.state.settings.unit;

  const wrap = h('div', { class: 'stack' });

  /* --- next session ---------------------------------------------------- */
  wrap.append(h('div', { class: 'card' },
    h('div', { class: 'card-head' },
      h('div', {},
        h('h4', {}, 'Next session'),
        h('h2', { style: 'margin-top:4px' }, next ? `${next.plan.label} · ${next.day.name}` : 'Block complete'),
      ),
      next?.plan.deload && h('span', { class: 'badge badge-accent' },
        usePlainLanguage() ? 'Easy week' : 'Deload week'),
    ),
    next
      ? h('div', {},
          h('p', { class: 'secondary' },
            usePlainLanguage()
              ? `${next.day.focus} · ${next.day.slots.reduce((n, s) => n + s.sets, 0)} sets · ` +
                `about ${estimateSessionMinutes(next.day)} minutes. Stop each set with roughly ` +
                `${next.plan.targetRir} ${next.plan.targetRir === 1 ? 'rep' : 'reps'} still in you.`
              : `${next.day.focus} · ${next.day.slots.reduce((n, s) => n + s.sets, 0)} sets · ` +
                `about ${estimateSessionMinutes(next.day)} min · target ${next.plan.targetRir} RIR`),
          h('div', { class: 'row' },
            h('a', { class: 'btn btn-primary btn-lg', href: '#/train' }, 'Open session'),
            h('span', { class: 'small muted' },
              `${progress.done} of ${progress.total} sessions logged this block`),
          ),
        )
      : h('div', {},
          h('p', { class: 'secondary' }, 'Every session including the deload is done. Time to start the next block.'),
          h('a', { class: 'btn btn-primary', href: '#/programs' }, 'Choose the next program'),
        ),
  ));

  /* --- block position -------------------------------------------------- */
  const weeks = totalWeeks(program);
  wrap.append(h('div', { class: 'card' },
    h('div', { class: 'card-head' },
      h('h3', {}, meso.name),
      h('span', { class: 'small muted' }, `${program.name} · ${program.daysPerWeek} days/week`),
    ),
    h('div', { class: 'week-strip' },
      ...Array.from({ length: weeks }, (_, w) => {
        const plan = weekPlan(meso, sessions, w);
        const done = plan.days.filter((d) => d.done).length;
        return h('button', {
          class: `week-pill${plan.deload ? ' is-deload' : ''}`,
          'aria-pressed': String(w === (next?.weekIndex ?? -1)),
          title: `${plan.label}: ${done}/${plan.days.length} sessions, target ${plan.targetRir} RIR`,
          onClick: () => { location.hash = '#/train'; },
        }, `${plan.label} · ${done}/${plan.days.length}`);
      }),
    ),
    usePlainLanguage()
      ? h('p', { class: 'small secondary', style: 'margin-top:12px;margin-bottom:0' },
          'Each week you push a little closer to your limit: ',
          program.rirByWeek.map((r, i) =>
            `week ${i + 1} stopping with ${r === 0 ? 'nothing' : r} ${r === 0 ? 'left' : r === 1 ? 'rep left' : 'reps left'}`).join(', '),
          '. Then an ', term('deload', 'easy week'),
          ' where the muscle you built actually shows up. Sets go up week to week wherever you told us you recovered well.')
      : h('p', { class: 'small secondary', style: 'margin-top:12px;margin-bottom:0' },
          `Effort tightens as the block runs: ${program.rirByWeek.map((r, i) => `week ${i + 1} at ${r} RIR`).join(', ')}, ` +
          'then a deload. Sets are added week to week wherever your feedback says you recovered.'),
  ));

  /* --- this week's volume ---------------------------------------------- */
  const currentWeek = next?.weekIndex ?? weeks - 1;
  const weekSessions = sessions.filter((s) => s.week === currentWeek);
  const totals = setsByMuscle(weekSessions);
  const report = volumeReport(totals).filter((r) => r.sets > 0 || r.mev > 0);
  const flags = volumeFlags(totals);

  wrap.append(h('div', { class: 'card' },
    h('div', { class: 'card-head' },
      h('h3', {}, 'Weekly volume'),
      h('span', { class: 'small muted' }, `Hard sets logged so far in ${weekPlan(meso, sessions, currentWeek).label.toLowerCase()}`),
    ),
    usePlainLanguage()
      ? h('div', { class: 'zone-legend', style: 'margin-bottom:10px' },
          h('span', {}, 'The grey band is how much work each muscle wants in a week. Bars inside it are on track.'),
          h('span', {}, 'Easy sets are not counted — only ones you took reasonably close to your limit.'),
        )
      : h('div', { class: 'zone-legend', style: 'margin-bottom:10px' },
          h('span', {}, 'Shaded band = ', term('mev', 'MEV'), ' to ', term('mrv', 'MRV'), ', the range where a muscle grows'),
          h('span', {}, 'Only sets within 4 reps of failure are counted'),
        ),
    weekSessions.length ? volumeChart(report) : h('p', { class: 'muted small' }, 'Log a session to see this week\'s volume.'),
    flags.length
      ? h('div', { class: 'stack', style: 'margin-top:14px;gap:8px' },
          ...flags.slice(0, 4).map((f) => h('div', {
            class: `notice${f.status.zone === 'over-mrv' ? ' is-critical' : ''}`,
          }, h('b', {}, `${f.name}: `), volumeStatusLine(f))),
        )
      : null,
  ));

  /* --- weak points (advanced mode) -------------------------------------- */
  const mode = store.mode();
  if (mode.showImbalances) {
    const { findings } = store.weakPoints();
    wrap.append(h('div', { class: 'card' },
      h('div', { class: 'card-head' },
        h('h3', {}, 'Weak points'),
        h('span', { class: 'small muted' }, 'From your logged strength ratios, progress and per-side reports'),
      ),
      findings.length
        ? h('div', { class: 'stack', style: 'gap:10px' },
            ...findings.slice(0, 4).map((f) => h('div', { class: 'finding' },
              h('h4', {}, f.title),
              h('p', {}, f.detail),
              h('p', { class: 'evidence' }, f.evidence),
            )),
            h('p', { class: 'small muted', style: 'margin:4px 0 0' },
              'The top two get an extra set a week in your next block, clamped to what you can ' +
              'recover from like anything else.'),
          )
        : h('p', { class: 'secondary small', style: 'margin:0' },
            'Nothing is standing out yet. Strength ratios need a few sessions on the main lifts ' +
            'before they mean anything, and side-to-side reports need a handful of unilateral ' +
            'sets. Keep logging and this fills in.'),
    ));
  }

  /* --- strength -------------------------------------------------------- */
  const anchors = anchorLifts(program);
  const trends = anchors.map((exerciseId) => {
    const entries = store.state.sessions
      .filter((s) => s.entries?.some((e) => e.exerciseId === exerciseId))
      .sort((a, b) => a.date - b.date)
      .map((s) => ({ date: s.date, ...s.entries.find((e) => e.exerciseId === exerciseId) }));
    return { exerciseId, entries, trend: strengthTrend(entries) };
  }).filter((t) => t.trend.points.length > 0);

  if (trends.length && mode.showE1rm) {
    wrap.append(h('div', { class: 'card' },
      h('div', { class: 'card-head' },
        h('h3', {}, usePlainLanguage() ? 'How strong you are getting' : 'Estimated max on the main lifts'),
        h('span', { class: 'small muted' },
          usePlainLanguage()
            ? h('span', {}, 'Your ', term('e1rm', 'estimated best single'), ', worked out from your normal sets')
            : ''),
      ),
      h('div', { class: 'grid grid-3' },
        ...trends.map(({ exerciseId, trend }) => {
          const latest = trend.points.at(-1).e1rm;
          const arrow = trend.direction === 'up' ? '▲' : trend.direction === 'down' ? '▼' : '—';
          return h('div', { class: 'stat' },
            h('span', { class: 'label' }, getExercise(exerciseId).name),
            h('span', { class: 'value num' }, fmtWeight(Math.round(latest), unit)),
            h('span', { class: 'sub' },
              `${arrow} ${trend.changePct >= 0 ? '+' : ''}${trend.changePct.toFixed(1)}% across ${trend.points.length} sessions`),
          );
        }),
      ),
      trends[0].trend.points.length >= 2
        ? h('div', { style: 'margin-top:16px' },
            h('h4', { style: 'margin-bottom:8px' }, getExercise(trends[0].exerciseId).name),
            trendChart(trends[0].trend.points.map((p) => ({
              value: Math.round(p.e1rm),
              label: relativeDay(p.date),
              detail: new Date(p.date).toLocaleDateString(),
            })), { unit }),
          )
        : null,
    ));
  }

  /* --- recent sessions -------------------------------------------------- */
  const recent = [...store.state.sessions].sort((a, b) => b.date - a.date).slice(0, 5);
  if (recent.length) {
    wrap.append(h('div', { class: 'card' },
      h('div', { class: 'card-head' },
        h('h3', {}, 'Recent sessions'),
        h('a', { class: 'small', href: '#/history' }, 'Full history'),
      ),
      h('div', { class: 'table-scroll' }, h('table', {},
        h('thead', {}, h('tr', {},
          h('th', {}, 'Session'), h('th', {}, 'When'), h('th', {}, 'Sets'), h('th', {}, 'Volume'),
        )),
        h('tbody', {}, ...recent.map((s) => {
          const program = getProgram(s.programId);
          const day = program?.days.find((d) => d.id === s.dayId);
          const sets = s.entries.reduce((n, e) => n + e.sets.length, 0);
          const vol = s.entries.reduce((n, e) => n + tonnage(e.sets), 0);
          return h('tr', {},
            h('td', {}, `${day?.name ?? s.dayId}`, h('span', { class: 'muted' }, ` · wk ${s.week + 1}`)),
            h('td', { class: 'muted' }, relativeDay(s.date)),
            h('td', {}, String(sets)),
            h('td', {}, `${fmtNumber(Math.round(vol))}${unit}`),
          );
        })),
      )),
    ));
  }

  container.append(wrap);
}

/** The heavy lifts a program is actually built around. */
function anchorLifts(program) {
  const seen = new Set();
  for (const day of program?.days ?? []) {
    for (const slot of day.slots) {
      if (slot.role === 'anchor' && getExercise(slot.exerciseId)?.type === 'compound') seen.add(slot.exerciseId);
    }
  }
  return [...seen].slice(0, 6);
}

function welcome() {
  return h('div', { class: 'stack' },
    h('div', { class: 'card' },
      h('h1', {}, 'Train in blocks, not sessions'),
      h('p', { class: 'secondary', style: 'max-width:64ch' },
        'IronBlock tells you exactly what to lift each session and works the weights out from ' +
        'what you actually did last time. Training runs in five-week ',
        term('mesocycle', 'blocks'),
        ': four weeks that build up, then an ', term('deload', 'easy week'),
        ' where the work turns into muscle.'),
      h('p', { class: 'secondary', style: 'max-width:64ch' },
        'You do not need to know any of the terminology. Answer three questions and it will ' +
        'pick a program for you and explain everything as it goes.'),
      h('div', { class: 'row', style: 'margin-top:16px' },
        h('a', { class: 'btn btn-primary btn-lg', href: '#/welcome' }, 'Find my program'),
        h('a', { class: 'btn', href: '#/programs' }, 'Browse them all'),
      ),
    ),
    h('div', { class: 'grid grid-3' },
      principle('Intentional', 'Every set has a prescribed load, rep target and RIR before you touch the bar - and the reasoning behind it in plain English.'),
      principle('Efficient', 'Volume is capped at what you can recover from, supersets are built into the templates, and the app tells you what each session will cost you in minutes.'),
      principle('Progressive', 'Double progression on load and reps, autoregulated by your reported RIR, with weekly volume steered by how you actually recovered.'),
    ),
  );
}

function principle(title, body) {
  return h('div', { class: 'card' },
    h('h4', {}, title),
    h('p', { class: 'secondary small', style: 'margin:8px 0 0' }, body),
  );
}
