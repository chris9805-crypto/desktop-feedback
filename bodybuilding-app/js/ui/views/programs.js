/** Program library: what each block is for, what it costs, and what it trains. */

import { h, clear, fmtNumber } from '../dom.js';
import { store } from '../../store.js';
import { PROGRAMS, getProgram } from '../../data/programs.js';
import { getExercise } from '../../data/exercises.js';
import { MUSCLES, MUSCLE_DISPLAY_ORDER, muscleName } from '../../data/muscles.js';
import { newMesocycle, weekPlan, programTimeProfile, totalWeeks, estimateSessionMinutes } from '../../engine/mesocycle.js';
import { plannedSetsByMuscle } from '../../engine/volume.js';
import { volumeChart } from '../charts.js';
import { confirmSheet, promptSheet } from '../sheet.js';

export function render(container) {
  clear(container);
  const active = store.activeMeso();
  const wrap = h('div', { class: 'stack' });

  wrap.append(h('div', { class: 'page-head' },
    h('h1', {}, 'Programs'),
    h('p', {},
      'Five templates, each a five-week block: four weeks of accumulating volume and effort, ' +
      'then a deload. Pick the one that matches the days you can genuinely train, not the one ' +
      'that sounds hardest - a program you finish beats a program you admire.'),
  ));

  if (active) {
    const program = getProgram(active.programId);
    wrap.append(h('div', { class: 'notice' },
      h('b', {}, `${program.name} is running.`),
      ' Starting a new block archives this one - its history is kept, but the block ends where it is.'));
  }

  for (const program of PROGRAMS) wrap.append(programCard(program, active));
  container.append(wrap);
}

function programCard(program, active) {
  const time = programTimeProfile(program);
  const isActive = active?.programId === program.id;
  const meso = newMesocycle(program);
  const peakWeek = weekPlan(meso, [], program.accumulationWeeks - 1);
  const volume = plannedSetsByMuscle(peakWeek.days);
  const report = MUSCLE_DISPLAY_ORDER
    .map((id) => ({ id, name: MUSCLES[id].name, sets: Math.round((volume[id] ?? 0) * 10) / 10, ...MUSCLES[id], status: { label: '' } }))
    .filter((r) => r.sets > 0);

  const detail = h('div', { hidden: true, style: 'margin-top:16px' });
  let built = false;

  return h('div', { class: 'card' },
    h('div', { class: 'card-head' },
      h('div', {},
        h('h2', {}, program.name),
        h('div', { class: 'small muted' }, program.subtitle),
      ),
      isActive && h('span', { class: 'badge badge-accent' }, 'Running'),
    ),
    h('p', { class: 'secondary' }, program.summary),
    h('div', { class: 'grid grid-3', style: 'margin:16px 0' },
      stat('Days per week', String(program.daysPerWeek), program.level),
      stat('Per session', `${time.sessionMin}–${time.sessionMax} min`, 'week one to peak week'),
      stat('Per week', `${(time.weeklyStart / 60).toFixed(1)}–${(time.weeklyPeak / 60).toFixed(1)} h`, 'total time under the bar'),
    ),
    h('div', {},
      h('h4', {}, 'Best for'),
      h('ul', { class: 'cues', style: 'margin-top:6px' }, ...program.bestFor.map((b) => h('li', {}, b))),
    ),
    h('div', { class: 'row', style: 'margin-top:16px' },
      h('button', {
        class: 'btn-primary',
        onClick: async () => {
          if (active) {
            const ok = await confirmSheet({
              title: 'Start a new block?',
              body: `Your current block (${getProgram(active.programId).name}) gets archived where it is. ` +
                    'Everything you have logged is kept.',
              confirmLabel: 'Start the new one',
            });
            if (!ok) return;
          }
          const name = await promptSheet({
            title: 'Name this block',
            body: 'Just so you can tell it apart later. The default is fine.',
            label: 'Block name',
            value: `${program.name} · ${new Date().toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`,
            confirmLabel: 'Start training',
          });
          if (name === null) return;
          store.startMesocycle(program.id, name.trim() || undefined);
          location.hash = '#/train';
        },
      }, isActive ? 'Restart this block' : 'Start this block'),
      h('button', {
        onClick: (ev) => {
          detail.hidden = !detail.hidden;
          ev.currentTarget.textContent = detail.hidden ? 'See the full block' : 'Hide details';
          if (!built) { buildDetail(detail, program, report); built = true; }
        },
      }, 'See the full block'),
    ),
    detail,
  );
}

function buildDetail(node, program, report) {
  node.append(
    h('h4', {}, 'Peak-week volume by muscle'),
    h('p', { class: 'small muted', style: 'margin:4px 0 10px' },
      'Planned hard sets in the last accumulation week, counting assisting muscles as half a set. ' +
      'The shaded band is the range where each muscle grows.'),
    volumeChart(report),
  );

  const meso = newMesocycle(program);
  for (let w = 0; w < totalWeeks(program); w++) {
    const plan = weekPlan(meso, [], w);
    node.append(h('details', { style: 'margin-top:12px' },
      h('summary', { style: 'cursor:pointer;font-weight:600' },
        `${plan.label} — target ${plan.targetRir} RIR`,
        plan.deload ? ' · half the sets, ~12% off the bar' : ''),
      h('div', { class: 'grid grid-2', style: 'margin-top:10px' },
        ...plan.days.map((day) => h('div', { class: 'day-card' },
          h('h3', {}, day.name),
          h('div', { class: 'small muted' }, `${day.focus} · about ${estimateSessionMinutes(day)} min`),
          h('div', { class: 'table-scroll', style: 'margin-top:8px' }, h('table', {},
            h('tbody', {}, ...day.slots.map((s) => {
              const ex = getExercise(s.exerciseId);
              const reps = s.reps ?? ex.reps;
              return h('tr', {},
                h('td', {}, ex.name, s.superset && h('span', { class: 'muted tiny' }, ` · superset ${s.superset}`)),
                h('td', { style: 'text-align:right;white-space:nowrap' },
                  `${plan.deload ? Math.max(1, Math.ceil(s.sets / 2)) : s.sets} × ${reps[0]}-${reps[1]}`),
              );
            })),
          )),
        )),
      ),
    ));
  }
}

function stat(label, value, sub) {
  return h('div', { class: 'stat' },
    h('span', { class: 'label' }, label),
    h('span', { class: 'value num' }, value),
    h('span', { class: 'sub' }, sub),
  );
}
