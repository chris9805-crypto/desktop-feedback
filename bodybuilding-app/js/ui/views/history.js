/**
 * History - the record, and what it says about whether the training worked.
 *
 * The per-exercise view is the important one: estimated 1RM over time on a
 * single lift is the clearest signal that a block did its job.
 */

import { h, clear, fmtWeight, fmtNumber, fmtDate, fmtDateLong, fmtDuration, relativeDay } from '../dom.js';
import { store } from '../../store.js';
import { getProgram } from '../../data/programs.js';
import { getExercise } from '../../data/exercises.js';
import { muscleName } from '../../data/muscles.js';
import { setsByMuscle, volumeReport, windowReport, HEATMAP_WINDOWS } from '../../engine/volume.js';
import { e1rm, tonnage } from '../../engine/onerm.js';
import { bestSet, strengthTrend } from '../../engine/progression.js';
import { hasDrops, describeDrops } from '../../engine/dropsets.js';
import { trendChart, volumeChart } from '../charts.js';
import { muscleHeatmap, heatLegend } from '../muscle-map.js';
import { alertSheet } from '../sheet.js';
import { confirmSheet } from '../sheet.js';
import { routeParams, clearRouteParams } from '../../util/route.js';

let selectedExercise = '';
/** Remembered across renders: somebody who looks at 90 days wants 90 days. */
let heatmapDays = 30;

export function render(container) {
  clear(container);
  const sessions = [...store.state.sessions].sort((a, b) => b.date - a.date);
  const unit = store.state.settings.unit;
  // Arriving from a finished day on the Today screen: that session is what you
  // came to look at, so open it rather than making you find it in the list.
  const focusId = takeFocusedSession();
  let focusRow = null;

  const wrap = h('div', { class: 'stack' });
  wrap.append(h('div', { class: 'page-head' },
    h('h1', {}, 'History'),
    h('p', {}, 'Every set you have logged, and what it adds up to.'),
  ));

  if (!sessions.length) {
    wrap.append(h('div', { class: 'empty' },
      h('h3', {}, 'Nothing logged yet'),
      h('p', {}, 'Finish a session and it will appear here with its volume, tonnage and estimated maxes.'),
      h('a', { class: 'btn btn-primary', href: '#/train' }, 'Go train'),
    ));
    container.append(wrap);
    return;
  }

  /* --- headline numbers ------------------------------------------------ */
  const totalSets = sessions.reduce((n, s) => n + s.entries.reduce((k, e) => k + e.sets.length, 0), 0);
  const totalVolume = sessions.reduce((n, s) => n + s.entries.reduce((k, e) => k + tonnage(e.sets), 0), 0);
  const totalTime = sessions.reduce((n, s) => n + (s.durationSec ?? 0), 0);

  wrap.append(h('div', { class: 'card' },
    h('div', { class: 'grid grid-3' },
      stat('Sessions', String(sessions.length), `since ${fmtDate(sessions.at(-1).date)}`),
      stat('Hard sets', fmtNumber(totalSets), 'logged and completed'),
      stat('Total volume', `${fmtNumber(Math.round(totalVolume))}${unit}`, `${fmtDuration(totalTime)} under the bar`),
    ),
  ));

  /* --- per-exercise trend ---------------------------------------------- */
  const trained = [...new Set(sessions.flatMap((s) => s.entries.map((e) => e.exerciseId)))]
    .map((id) => ({ id, name: getExercise(id)?.name ?? id }))
    .filter((x) => x.name)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!selectedExercise || !trained.some((t) => t.id === selectedExercise)) {
    selectedExercise = trained[0]?.id ?? '';
  }

  const trendBox = h('div', {});
  wrap.append(h('div', { class: 'card' },
    h('div', { class: 'card-head' },
      h('h3', {}, 'Strength over time'),
      h('select', {
        'aria-label': 'Choose an exercise',
        style: 'width:auto;min-width:200px',
        onChange: (ev) => { selectedExercise = ev.target.value; drawTrend(trendBox, unit); },
      }, ...trained.map((t) => h('option', { value: t.id, selected: t.id === selectedExercise }, t.name))),
    ),
    trendBox,
  ));
  drawTrend(trendBox, unit);

  /* --- where the work has actually gone ---------------------------------- */
  wrap.append(heatmapCard(sessions));

  /* --- volume by week --------------------------------------------------- */
  const byWeek = new Map();
  for (const s of sessions) {
    const key = `${s.mesoId}:${s.week}`;
    if (!byWeek.has(key)) byWeek.set(key, []);
    byWeek.get(key).push(s);
  }
  const latestWeek = [...byWeek.entries()].sort((a, b) =>
    Math.max(...b[1].map((s) => s.date)) - Math.max(...a[1].map((s) => s.date)))[0];

  if (latestWeek) {
    const report = volumeReport(setsByMuscle(latestWeek[1])).filter((r) => r.sets > 0);
    wrap.append(h('div', { class: 'card' },
      h('div', { class: 'card-head' },
        h('h3', {}, 'Volume in your most recent week'),
        h('span', { class: 'small muted' }, `${latestWeek[1].length} sessions`),
      ),
      volumeChart(report),
    ));
  }

  /* --- session log ------------------------------------------------------ */
  wrap.append(h('div', { class: 'card' },
    h('div', { class: 'card-head' }, h('h3', {}, 'Session log')),
    h('div', { class: 'stack', style: 'gap:8px' }, ...sessions.map((s) => {
      const row = sessionRow(s, unit, s.id === focusId);
      if (s.id === focusId) focusRow = row;
      return row;
    })),
  ));

  container.append(wrap);

  if (focusRow) {
    // After layout, or it scrolls to where the row was before the charts drew.
    requestAnimationFrame(() => focusRow.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }
}

/**
 * Reads the session the caller asked for and drops it from the URL, so a
 * refresh or a later visit shows the plain History screen.
 */
function takeFocusedSession() {
  const id = routeParams().get('session');
  if (id) clearRouteParams();
  return id;
}

/**
 * A body, coloured by what each muscle has actually been getting.
 *
 * Thirty rows of numbers tell you the facts; a body with one cold leg tells you
 * the story. The window matters as much as the picture: a week is what you just
 * did, three months is what you have become, and the gap between those two
 * views is usually where somebody finds the muscle they have been quietly
 * skipping since March.
 */
function heatmapCard(sessions) {
  const body = h('div', {});
  let days = heatmapDays;

  const draw = () => {
    clear(body);
    const report = windowReport(sessions, { days });

    if (!report.sessions) {
      body.append(h('p', { class: 'small muted' }, 'Nothing logged in this window.'));
      return;
    }

    body.append(h('div', { class: 'heat-body' },
      muscleHeatmap(report.rows, {
        height: 220,
        onPick: (row) => alertSheet({
          title: row.name,
          body: `${Math.round(row.sets * 10) / 10} sets a week over the last ${days} days.\n\n`
            + `${row.status.label}. ${row.status.advice}`,
        }),
      }),
    ));
    body.append(heatLegend());

    const cold = report.rows.filter((r) => r.status.zone === 'none' || r.status.zone === 'below-mev');
    const hot = report.rows.filter((r) => r.status.zone === 'over-mrv');
    body.append(h('p', { class: 'heat-note' },
      hot.length
        ? [h('b', {}, 'Over the ceiling: '), hot.map((r) => r.name).join(', '),
           ' — more than most people recover from, sustained.']
        : cold.length
          ? [h('b', {}, 'Getting the least: '), cold.map((r) => r.name).join(', '),
             ' — under the weekly work that reliably grows them.']
          : ['Every muscle you train is inside its productive range over this window.'],
    ));
    body.append(h('p', { class: 'tiny muted' },
      `${report.sessions} session${report.sessions === 1 ? '' : 's'}, averaged per week. `
      + 'Measured back from your last session, so time off does not read as neglect.'));
  };

  const card = h('div', { class: 'card' },
    h('div', { class: 'heat-head' },
      h('h3', {}, 'Where the work went'),
      h('div', { class: 'heat-windows' }, ...HEATMAP_WINDOWS.map((w) => h('button', {
        class: 'week-pill', 'aria-pressed': String(w.days === days),
        onClick: (ev) => {
          days = w.days;
          heatmapDays = w.days;
          for (const pill of ev.currentTarget.parentElement.children) {
            pill.setAttribute('aria-pressed', String(pill === ev.currentTarget));
          }
          draw();
        },
      }, w.label))),
    ),
    body,
  );
  draw();
  return card;
}

function drawTrend(box, unit) {
  clear(box);
  if (!selectedExercise) return;
  const entries = store.state.sessions
    .filter((s) => s.entries?.some((e) => e.exerciseId === selectedExercise))
    .sort((a, b) => a.date - b.date)
    .map((s) => ({ date: s.date, ...s.entries.find((e) => e.exerciseId === selectedExercise) }));

  const trend = strengthTrend(entries);
  if (!trend.points.length) return;

  const direction = trend.direction === 'up' ? 'climbing' : trend.direction === 'down' ? 'falling' : 'flat';
  box.append(
    h('p', { class: 'small secondary' },
      `${trend.points.length} sessions · estimated max ${direction}` +
      (trend.points.length > 1 ? ` ${trend.changePct >= 0 ? '+' : ''}${trend.changePct.toFixed(1)}% overall` : '') +
      '. Estimates come from your logged reps and RIR, so they move with effort as well as load.'),
    trendChart(trend.points.map((p) => ({
      value: Math.round(p.e1rm),
      label: relativeDay(p.date),
      detail: new Date(p.date).toLocaleDateString(),
    })), { unit }),
  );
}

function sessionRow(session, unit, focused = false) {
  const program = getProgram(session.programId);
  const day = program?.days.find((d) => d.id === session.dayId);
  const sets = session.entries.reduce((n, e) => n + e.sets.length, 0);
  const volume = session.entries.reduce((n, e) => n + tonnage(e.sets), 0);

  const body = h('div', { style: 'margin-top:10px' });
  let built = false;

  const build = () => {
    if (built) return;
    built = true;
    // Filtered because this is the native append, which turns a null child into
    // the text "null" rather than dropping it the way the h() helper does.
    body.append(...[
      h('div', { class: 'table-scroll' }, h('table', {},
        h('thead', {}, h('tr', {},
          h('th', {}, 'Exercise'), h('th', {}, 'Sets'), h('th', {}, 'Best set'), h('th', {}, 'Est. 1RM'),
        )),
        h('tbody', {}, ...session.entries.map((e) => {
          const best = bestSet(e.sets);
          const est = best ? e1rm(best.weight, best.reps, best.rir ?? 0) : 0;
          const dropped = (e.sets ?? []).filter(hasDrops);
          return h('tr', {},
            h('td', {}, getExercise(e.exerciseId)?.name ?? e.exerciseId,
              e.swappedFrom && h('span', { class: 'muted tiny' }, ' · swapped in'),
              // Drops are not extra sets, so they are noted on the row rather
              // than inflating the count beside it.
              dropped.length ? h('div', { class: 'muted tiny' },
                dropped.map((set) => describeDrops(set, unit)).join(' · ')) : null),
            h('td', {}, String(e.sets.length)),
            h('td', {}, best ? `${fmtWeight(best.weight, unit)} × ${best.reps} @ ${best.rir ?? '—'} RIR` : '—'),
            h('td', {}, est ? fmtWeight(Math.round(est), unit) : '—'),
          );
        })),
      )),
      Object.keys(session.feedback ?? {}).length
        ? h('div', { class: 'small secondary', style: 'margin-top:10px' },
            h('b', {}, 'Recovery reported: '),
            Object.entries(session.feedback).map(([m, f]) =>
              `${muscleName(m)} (soreness ${f.soreness ?? '—'}, pump ${f.pump ?? '—'}, joints ${f.joint ?? '—'})`).join(' · '))
        : null,
      h('button', {
        class: 'btn-danger btn-sm', style: 'margin-top:12px',
        onClick: async () => {
          const ok = await confirmSheet({
            title: 'Delete this session?',
            body: 'The day it completed becomes available to train again. This cannot be undone.',
            confirmLabel: 'Delete', danger: true,
          });
          if (ok) { store.deleteSession(session.id); location.reload(); }
        },
      }, 'Delete session'),
    ].filter(Boolean));
  };

  const details = h('details', {
    class: `day-card${focused ? ' is-focused' : ''}`,
    open: focused,
    onToggle: (ev) => { if (ev.currentTarget.open) build(); },
  },
    h('summary', { style: 'cursor:pointer' },
      h('span', { class: 'strong' }, day?.name ?? session.dayId),
      h('span', { class: 'muted small' },
        ` · week ${session.week + 1} · ${fmtDateLong(session.date)} · ${sets} sets · ` +
        `${fmtNumber(Math.round(volume))}${unit}`),
    ),
    body,
  );
  if (focused) build();
  return details;
}

function stat(label, value, sub) {
  return h('div', { class: 'stat' },
    h('span', { class: 'label' }, label),
    h('span', { class: 'value num' }, value),
    h('span', { class: 'sub' }, sub),
  );
}
