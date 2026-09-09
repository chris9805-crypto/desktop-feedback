/** Settings, and the data escape hatch. */

import { h, clear } from '../dom.js';
import { store } from '../../store.js';
import { getProgram } from '../../data/programs.js';

export function render(container) {
  clear(container);
  const s = store.state.settings;
  const wrap = h('div', { class: 'stack' });

  wrap.append(h('div', { class: 'page-head' },
    h('h1', {}, 'Settings'),
    h('p', {}, 'Everything is stored in this browser. No account, no server, no sync.'),
  ));

  if (store.persistFailed) {
    wrap.append(h('div', { class: 'notice is-critical' },
      h('b', {}, 'Storage is unavailable.'),
      ' This browser is refusing to save (private mode, or site data is blocked). The session ' +
      'in front of you still works, but it will be gone when you close the tab. Export your data ' +
      'before you leave.'));
  }

  wrap.append(h('div', { class: 'card' },
    h('h3', {}, 'Units and behaviour'),
    h('div', { class: 'field', style: 'margin-top:12px' },
      h('label', {}, 'Weight unit'),
      h('div', { class: 'seg' },
        ...['kg', 'lb'].map((u) => h('button', {
          'aria-pressed': String(s.unit === u),
          onClick: () => { store.setUnit(u); render(container); },
        }, u)),
      ),
      h('p', { class: 'tiny muted', style: 'margin-top:6px' },
        'Switching converts your whole history, so the log never ends up a mix of both.'),
    ),
    toggle('autoStartRest', 'Start the rest timer automatically', 'Fires the moment you log a working set.', container),
    h('div', { class: 'field' },
      h('label', {}, 'Theme'),
      h('div', { class: 'seg' },
        ...[['system', 'System'], ['light', 'Light'], ['dark', 'Dark']].map(([value, label]) => h('button', {
          'aria-pressed': String(s.theme === value),
          onClick: () => { store.setSetting('theme', value); applyTheme(); render(container); },
        }, label)),
      ),
    ),
    h('div', { class: 'field' },
      h('label', { for: 'bw' }, `Bodyweight (${s.unit}) — optional`),
      h('input', {
        id: 'bw', type: 'number', step: 'any', value: s.bodyweight ?? '',
        onChange: (ev) => store.setSetting('bodyweight', ev.target.value === '' ? null : Number(ev.target.value)),
      }),
    ),
  ));

  /* --- blocks ---------------------------------------------------------- */
  if (store.state.mesocycles.length) {
    wrap.append(h('div', { class: 'card' },
      h('h3', {}, 'Your blocks'),
      h('div', { class: 'table-scroll', style: 'margin-top:10px' }, h('table', {},
        h('thead', {}, h('tr', {}, h('th', {}, 'Block'), h('th', {}, 'Program'), h('th', {}, 'Sessions'), h('th', {}, ''))),
        h('tbody', {}, ...store.state.mesocycles.map((m) => h('tr', {},
          h('td', {}, m.name, m.status === 'active' && h('span', { class: 'badge badge-accent', style: 'margin-left:6px' }, 'active')),
          h('td', { class: 'muted' }, getProgram(m.programId)?.name ?? m.programId),
          h('td', {}, String(store.mesoSessions(m.id).length)),
          h('td', { style: 'text-align:right' },
            m.status !== 'active' && h('button', {
              class: 'btn-sm',
              onClick: () => { store.update((st) => ({ ...st, activeMesoId: m.id, mesocycles: st.mesocycles.map((x) => ({ ...x, status: x.id === m.id ? 'active' : 'archived' })) })); render(container); },
            }, 'Resume'),
            h('button', {
              class: 'btn-danger btn-sm', style: 'margin-left:6px',
              onClick: () => {
                if (confirm(`Delete "${m.name}" and every session logged in it? This cannot be undone.`)) {
                  store.deleteMesocycle(m.id); render(container);
                }
              },
            }, 'Delete'),
          ),
        ))),
      )),
    ));
  }

  /* --- data ------------------------------------------------------------ */
  const importBox = h('textarea', { rows: 4, placeholder: 'Paste an export here…', style: 'font-family:var(--mono);font-size:12px' });
  wrap.append(h('div', { class: 'card' },
    h('h3', {}, 'Your data'),
    h('p', { class: 'secondary small' },
      `${store.state.sessions.length} sessions stored locally. Export before clearing site data, ` +
      'changing browser, or anything else that would take it with it.'),
    h('div', { class: 'row' },
      h('button', {
        onClick: (ev) => {
          navigator.clipboard?.writeText(store.exportJson())
            .then(() => { ev.target.textContent = 'Copied to clipboard'; setTimeout(() => { ev.target.textContent = 'Copy export to clipboard'; }, 2000); })
            .catch(() => { importBox.value = store.exportJson(); });
        },
      }, 'Copy export to clipboard'),
      h('button', {
        onClick: () => { importBox.value = store.exportJson(); importBox.select?.(); },
      }, 'Show export'),
    ),
    h('div', { class: 'field', style: 'margin-top:14px' },
      h('label', {}, 'Import'),
      importBox,
      h('button', {
        style: 'margin-top:8px',
        onClick: () => {
          try {
            if (!confirm('Importing replaces everything currently stored. Continue?')) return;
            store.importJson(importBox.value);
            alert('Imported.');
            render(container);
          } catch (err) {
            alert(`Could not import that: ${err.message}`);
          }
        },
      }, 'Import and replace'),
    ),
    h('hr', { style: 'border:0;border-top:1px solid var(--border);margin:18px 0' }),
    h('button', {
      class: 'btn-danger',
      onClick: () => {
        if (confirm('Erase every block, session and setting? This cannot be undone.')) {
          store.reset(); location.hash = '#/'; location.reload();
        }
      },
    }, 'Erase everything'),
  ));

  /* --- how it works ---------------------------------------------------- */
  wrap.append(h('div', { class: 'card' },
    h('h3', {}, 'How the numbers are worked out'),
    h('div', { class: 'stack small secondary', style: 'gap:10px;margin-top:10px' },
      explain('Estimated 1RM',
        'RIR-adjusted Epley: a set of 8 with 2 in reserve is treated as a 10-rep effort. ' +
        'Reliable to about 12 reps to failure; past that it drifts and the app says so.'),
      explain('Load prescription',
        'Double progression. Reps climb inside the window until you fill it at the planned ' +
        'effort, then load goes up and reps reset. If your reported RIR says the load was ' +
        'badly wrong, it is corrected in one jump instead of creeping for a month.'),
      explain('Weekly volume',
        'Sets are counted fractionally - a full set for muscles doing the work, half for ' +
        'muscles assisting. Sets more than 4 reps from failure are not counted at all.'),
      explain('Set progression',
        'Your post-session soreness, pump and joint reports move next week\'s sets up or ' +
        'down, capped at each muscle\'s maximum recoverable volume. Joint pain always ' +
        'reduces volume, whatever else you report.'),
      explain('The landmarks',
        'MEV, MAV and MRV are population heuristics, not laws, and they are shifted up here ' +
        'to account for counting indirect work. Use your own trend over a few blocks in ' +
        'preference to any of them.'),
    ),
  ));

  container.append(wrap);
}

function explain(title, body) {
  return h('div', {}, h('b', { style: 'color:var(--text-primary)' }, title), ' — ', body);
}

function toggle(key, label, hint, container) {
  const on = store.state.settings[key];
  return h('div', { class: 'field' },
    h('div', { class: 'row' },
      h('button', {
        class: 'seg', 'aria-pressed': String(on),
        style: `padding:6px 12px;${on ? 'background:var(--accent);color:var(--accent-ink);border-color:var(--accent)' : ''}`,
        onClick: () => { store.setSetting(key, !on); render(container); },
      }, on ? 'On' : 'Off'),
      h('span', {}, label),
    ),
    h('p', { class: 'tiny muted', style: 'margin:4px 0 0' }, hint),
  );
}

export function applyTheme() {
  const theme = store.state.settings.theme;
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
}
