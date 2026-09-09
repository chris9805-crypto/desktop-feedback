/**
 * History - the record, and what it says about whether the training worked.
 *
 * The per-exercise view is the important one: estimated 1RM over time on a
 * single lift is the clearest signal that a block did its job.
 */

import { h, clear, fmtWeight, fmtNumber, fmtDate, fmtDateLong, fmtDuration, relativeDay } from '../dom.js';
import { store } from '../../store.js';
import { getProgram } from '../../data/programs.js';
import { getExercise, EXERCISES } from '../../data/exercises.js';
import { muscleName } from '../../data/muscles.js';
import { setsByMuscle, volumeReport } from '../../engine/volume.js';
import { e1rm, tonnage } from '../../engine/onerm.js';
import { bestSet, strengthTrend } from '../../engine/progression.js';
import { trendChart, volumeChart } from '../charts.js';
import { confirmSheet } from '../sheet.js';

let selectedExercise = '';

export function render(container) {
  clear(container);
  const sessions = [...store.state.sessions].sort((a, b) => b.date - a.date);
  const unit = store.state.settings.unit;

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
    h('div', { class: 'stack', style: 'gap:8px' }, ...sessions.map((s) => sessionRow(s, unit))),
  ));

  container.append(wrap);
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

function sessionRow(session, unit) {
  const program = getProgram(session.programId);
  const day = program?.days.find((d) => d.id === session.dayId);
  const sets = session.entries.reduce((n, e) => n + e.sets.length, 0);
  const volume = session.entries.reduce((n, e) => n + tonnage(e.sets), 0);

  const body = h('div', { style: 'margin-top:10px' });
  let built = false;

  const details = h('details', {
    class: 'day-card',
    onToggle: (ev) => {
      if (!ev.currentTarget.open || built) return;
      built = true;
      body.append(
        h('div', { class: 'table-scroll' }, h('table', {},
          h('thead', {}, h('tr', {},
            h('th', {}, 'Exercise'), h('th', {}, 'Sets'), h('th', {}, 'Best set'), h('th', {}, 'Est. 1RM'),
          )),
          h('tbody', {}, ...session.entries.map((e) => {
            const best = bestSet(e.sets);
            const est = best ? e1rm(best.weight, best.reps, best.rir ?? 0) : 0;
            return h('tr', {},
              h('td', {}, getExercise(e.exerciseId)?.name ?? e.exerciseId,
                e.swappedFrom && h('span', { class: 'muted tiny' }, ' · swapped in')),
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
      );
    },
  },
    h('summary', { style: 'cursor:pointer' },
      h('span', { class: 'strong' }, day?.name ?? session.dayId),
      h('span', { class: 'muted small' },
        ` · week ${session.week + 1} · ${fmtDateLong(session.date)} · ${sets} sets · ` +
        `${fmtNumber(Math.round(volume))}${unit}`),
    ),
    body,
  );
  return details;
}

function stat(label, value, sub) {
  return h('div', { class: 'stat' },
    h('span', { class: 'label' }, label),
    h('span', { class: 'value num' }, value),
    h('span', { class: 'sub' }, sub),
  );
}
