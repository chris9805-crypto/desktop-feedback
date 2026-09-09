/**
 * Crew.
 *
 * What this is: a standings table built from codes you and people you know
 * swap by hand. What it is not, and does not pretend to be: a live leaderboard
 * or a forum. Both need a server, accounts and moderation, and this app has
 * none of those by design - your log never leaves the device.
 *
 * The screen says so plainly rather than showing an empty "coming soon" feed,
 * because a fake social feature is worse than an honest small one.
 */

import { h, clear, fmtNumber, relativeDay } from '../dom.js';
import { store } from '../../store.js';
import { encodeCard, standings } from '../../engine/crew.js';
import { levelTitle } from '../../engine/progress.js';
import { promptSheet, confirmSheet, alertSheet } from '../sheet.js';

export function render(container) {
  clear(container);
  const wrap = h('div', { class: 'stack' });
  const profile = store.profile();
  const crew = store.state.settings.crew ?? [];
  const progress = store.progress();

  wrap.append(h('div', { class: 'page-head' },
    h('h1', {}, 'Crew'),
    h('p', {}, 'Swap a code with people you train with. No account, no server.'),
  ));

  /* --- your card -------------------------------------------------------- */
  if (!profile) {
    wrap.append(h('div', { class: 'panel' },
      h('h3', {}, 'Pick a name'),
      h('p', { class: 'secondary small' },
        'Only for your crew to recognise you. It is the only thing in a code you type yourself.'),
      h('button', {
        class: 'btn-primary', style: 'margin-top:12px',
        onClick: async () => {
          const name = await promptSheet({
            title: 'What should your crew call you?',
            label: 'Name', value: '', confirmLabel: 'Save',
          });
          if (name) { store.setProfileName(name); render(container); }
        },
      }, 'Set my name'),
    ));
  } else {
    const card = store.myCard();
    wrap.append(h('div', { class: 'panel you-card' },
      h('div', { class: 'panel-head' },
        h('h3', {}, profile.name),
        h('span', { class: 'badge badge-accent' }, `Level ${card.level}`),
      ),
      h('div', { class: 'crew-stats' },
        stat(String(card.streak), 'streak'),
        stat(String(card.sessions), 'sessions this week'),
        stat(fmtNumber(card.sets), 'sets this week'),
      ),
      h('div', { class: 'row', style: 'margin-top:14px' },
        h('button', {
          class: 'btn-primary',
          onClick: (ev) => {
            const code = encodeCard(store.myCard());
            navigator.clipboard?.writeText(code)
              .then(() => {
                ev.target.textContent = 'Copied — paste it to them';
                setTimeout(() => { ev.target.textContent = 'Copy my code'; }, 2500);
              })
              .catch(() => alertSheet({ title: 'Your code', body: code }));
          },
        }, 'Copy my code'),
        h('button', {
          onClick: async () => {
            const name = await promptSheet({
              title: 'Change your name', label: 'Name', value: profile.name, confirmLabel: 'Save',
            });
            if (name != null) { store.setProfileName(name); render(container); }
          },
        }, 'Rename'),
      ),
      h('p', { class: 'tiny muted', style: 'margin:10px 0 0' },
        'A code holds your name, level, streak and this week’s totals. Nothing else — ' +
        'not your log, not your weights, not your bodyweight.'),
    ));
  }

  /* --- add someone ------------------------------------------------------ */
  wrap.append(h('div', { class: 'panel' },
    h('h3', {}, 'Add someone'),
    h('p', { class: 'secondary small' }, 'Paste the code they sent you.'),
    h('div', { class: 'row', style: 'margin-top:12px' },
      h('button', {
        class: 'btn-primary',
        onClick: async () => {
          const code = await promptSheet({
            title: 'Paste their code',
            body: 'It starts with IB1- and is one long line.',
            label: 'Crew code', confirmLabel: 'Add', multiline: true,
          });
          if (!code) return;
          try {
            const added = store.addCrewCode(code);
            render(container);
            await alertSheet({ title: `${added.name} added`, body: 'Their standing updates when they send you a newer code.' });
          } catch (err) {
            await alertSheet({ title: 'Could not read that', body: err.message });
          }
        },
      }, 'Paste a code'),
    ),
  ));

  /* --- standings -------------------------------------------------------- */
  if (profile && crew.length) {
    const rows = standings(store.myCard(), crew);
    wrap.append(h('div', { class: 'panel' },
      h('div', { class: 'panel-head' },
        h('h3', {}, 'Standings'),
        h('span', { class: 'muted small' }, 'By streak, then sessions'),
      ),
      h('div', { class: 'standings' }, ...rows.map((row) => h('div', {
        class: `standing${row.isYou ? ' is-you' : ''}${row.stale ? ' is-stale' : ''}`,
      },
        h('span', { class: 'standing-rank num' }, String(row.rank)),
        h('div', { class: 'standing-who' },
          h('span', { class: 'standing-name' }, row.name, row.isYou && h('span', { class: 'chip' }, 'you')),
          h('span', { class: 'tiny muted' },
            row.stale
              ? `Their code is ${row.daysOld} days old — ask for a fresh one`
              : `Level ${row.level} · ${levelTitle(row.level)}`),
        ),
        h('div', { class: 'standing-figures' },
          h('span', { class: 'num' }, `${row.streak}`),
          h('span', { class: 'tiny muted' }, 'streak'),
        ),
        h('div', { class: 'standing-figures' },
          h('span', { class: 'num' }, `${row.sessions}`),
          h('span', { class: 'tiny muted' }, 'sessions'),
        ),
        !row.isYou && h('button', {
          class: 'btn-ghost btn-sm',
          'aria-label': `Remove ${row.name}`,
          onClick: async () => {
            const ok = await confirmSheet({
              title: `Remove ${row.name}?`, body: 'You can add them again from a code.',
              confirmLabel: 'Remove', danger: true,
            });
            if (ok) { store.removeCrew(row.id); render(container); }
          },
        }, '×'),
      ))),
      h('p', { class: 'tiny muted', style: 'margin:12px 0 0' },
        'Ranked by streak rather than by weight lifted, so it is a competition about ' +
        'showing up — one anyone can be in on their first day.'),
    ));
  }

  /* --- what is honestly not here ---------------------------------------- */
  wrap.append(h('div', { class: 'panel' },
    h('h3', {}, 'Why there is no forum'),
    h('p', { class: 'secondary small', style: 'margin-bottom:0' },
      'Live leaderboards, following people and discussion threads all need a server ' +
      'holding everybody’s account and data, plus somebody moderating it. This app has ' +
      'none of that, which is why your training log has never left your phone. Codes are ' +
      'the honest version: real people you actually know, no account, nothing uploaded.'),
  ));

  container.append(wrap);
}

function stat(value, label) {
  return h('div', { class: 'crew-stat' },
    h('span', { class: 'num' }, value),
    h('span', { class: 'tiny muted' }, label),
  );
}
