/** Settings, and the data escape hatch. */

import { h, clear } from '../dom.js';
import { store } from '../../store.js';
import { getProgram } from '../../data/programs.js';
import { confirmSheet, alertSheet } from '../sheet.js';
import { EQUIPMENT_PROFILES } from '../../engine/equipment.js';
import { canInstall, promptInstall, isStandalone, isIos } from '../install.js';
import { term } from '../term.js';

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

  /* --- add to home screen --------------------------------------------- */
  if (!isStandalone()) {
    wrap.append(h('div', { class: 'card' },
      h('h3', {}, 'Put it on your phone'),
      h('p', { class: 'secondary small' },
        'Installed, it opens like any other app - full screen, its own icon, and it works ' +
        'with no signal, which matters in most basements that contain a squat rack.'),
      canInstall() && !isIos()
        ? h('button', {
            class: 'btn-primary',
            onClick: async () => {
              const installed = await promptInstall();
              if (installed) render(container);
            },
          }, 'Add to home screen')
        : h('div', { class: 'stack small secondary', style: 'gap:8px' },
            h('div', {}, h('b', {}, 'iPhone / iPad: '),
              'tap the Share button, then ', h('b', {}, 'Add to Home Screen'), '.'),
            h('div', {}, h('b', {}, 'Android: '),
              'tap the menu (⋮), then ', h('b', {}, 'Install app'), ' or ', h('b', {}, 'Add to Home screen'), '.'),
            h('div', { class: 'tiny muted' },
              'Your training data stays on the device either way - installing does not move it anywhere.'),
          ),
    ));
  }

  /* --- experience ------------------------------------------------------ */
  wrap.append(h('div', { class: 'card' },
    h('h3', {}, 'How much should the app explain?'),
    h('p', { class: 'secondary small' },
      'This changes the wording, not the training. The same plan runs underneath either way.'),
    h('div', { class: 'choice-list', style: 'margin-top:12px' },
      ...[
        { value: 'new', label: 'Explain things',
          detail: 'Plain English, effort asked in words, warm-up guidance on every exercise.' },
        { value: 'experienced', label: 'Just the numbers',
          detail: 'RIR fields, compact prescriptions, the technical reasoning.' },
      ].map((option) => h('button', {
        class: 'choice',
        'aria-pressed': String((s.experience === 'new') === (option.value === 'new')),
        style: (s.experience === 'new') === (option.value === 'new')
          ? 'border-color:var(--accent);background:var(--accent-wash)' : '',
        onClick: () => { store.setSetting('experience', option.value); render(container); },
      },
        h('span', { class: 'choice-label' }, option.label),
        h('span', { class: 'choice-detail' }, option.detail),
      )),
    ),
  ));

  /* --- equipment ------------------------------------------------------- */
  wrap.append(h('div', { class: 'card' },
    h('h3', {}, 'What you can train with'),
    h('p', { class: 'secondary small' },
      'Exercises you cannot do are swapped for ones that train the same muscle. This applies ' +
      'to blocks you start from now on - a block already running keeps the equipment it began with.'),
    h('div', { class: 'choice-list', style: 'margin-top:12px' },
      ...Object.values(EQUIPMENT_PROFILES).map((profile) => h('button', {
        class: 'choice',
        style: s.equipment === profile.id ? 'border-color:var(--accent);background:var(--accent-wash)' : '',
        onClick: () => { store.setSetting('equipment', profile.id); render(container); },
      },
        h('span', { class: 'choice-label' }, profile.name),
        h('span', { class: 'choice-detail' }, profile.detail),
      )),
    ),
  ));

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
              onClick: async () => {
                const ok = await confirmSheet({
                  title: `Delete "${m.name}"?`,
                  body: 'Every session logged in this block goes with it. This cannot be undone.',
                  confirmLabel: 'Delete it', danger: true,
                });
                if (ok) { store.deleteMesocycle(m.id); render(container); }
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
        onClick: async () => {
          const ok = await confirmSheet({
            title: 'Replace everything?',
            body: 'Importing overwrites the blocks and sessions currently on this device.',
            confirmLabel: 'Import', danger: true,
          });
          if (!ok) return;
          try {
            store.importJson(importBox.value);
            await alertSheet({ title: 'Imported', body: 'Your training history is back.' });
            render(container);
          } catch (err) {
            await alertSheet({ title: 'That did not work', body: `Could not read that as an export: ${err.message}` });
          }
        },
      }, 'Import and replace'),
    ),
    h('hr', { style: 'border:0;border-top:1px solid var(--border);margin:18px 0' }),
    h('button', {
      style: 'margin-bottom:12px',
      onClick: () => {
        store.setSetting('onboarded', false);
        location.hash = '#/welcome';
        location.reload();
      },
    }, 'Run the setup questions again'),
    h('br'),
    h('button', {
      class: 'btn-danger',
      onClick: async () => {
        const ok = await confirmSheet({
          title: 'Erase everything?',
          body: 'Every block, every session and every setting on this device. There is no undo, ' +
                'and no copy anywhere else. Export first if you are not certain.',
          confirmLabel: 'Erase it all', danger: true,
        });
        if (ok) { store.reset(); location.hash = '#/'; location.reload(); }
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
    h('p', { class: 'small secondary', style: 'margin-top:14px;margin-bottom:0' },
      'Every one of those words is explained in plain English under ',
      h('a', { href: '#/learn' }, 'Learn'),
      ' — or tap any ', term('rir', 'underlined word'), ' anywhere in the app.'),
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
