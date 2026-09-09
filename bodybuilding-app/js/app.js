/** Router and shell. Hash routing so the whole thing runs from a file:// URL. */

import { h, clear } from './ui/dom.js';
import { store } from './store.js';
import * as dashboard from './ui/views/dashboard.js';
import * as programs from './ui/views/programs.js';
import * as train from './ui/views/train.js';
import * as history from './ui/views/history.js';
import * as exercises from './ui/views/exercises.js';
import * as settings from './ui/views/settings.js';

const ROUTES = [
  { path: '/', label: 'Today', view: dashboard },
  { path: '/train', label: 'Train', view: train },
  { path: '/programs', label: 'Programs', view: programs },
  { path: '/history', label: 'History', view: history },
  { path: '/exercises', label: 'Exercises', view: exercises },
  { path: '/settings', label: 'Settings', view: settings },
];

function currentPath() {
  const raw = location.hash.replace(/^#/, '') || '/';
  return ROUTES.some((r) => r.path === raw) ? raw : '/';
}

function shell() {
  const nav = h('nav', { class: 'nav' },
    ...ROUTES.map((r) => h('a', { href: `#${r.path}`, dataset: { path: r.path } }, r.label)),
  );
  return h('div', { class: 'app' },
    h('header', { class: 'topbar' },
      h('div', { class: 'brand' }, 'IRONBLOCK', h('span', {}, 'block periodisation')),
      nav,
    ),
    h('main', { id: 'view' }),
  );
}

function route() {
  const path = currentPath();
  const view = ROUTES.find((r) => r.path === path).view;
  const main = document.getElementById('view');
  clear(main);
  view.render(main);
  for (const link of document.querySelectorAll('.nav a')) {
    if (link.dataset.path === path) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  document.title = path === '/' ? 'IronBlock' : `IronBlock · ${ROUTES.find((r) => r.path === path).label}`;
  window.scrollTo(0, 0);
}

function boot() {
  document.body.append(shell());
  settings.applyTheme();
  window.addEventListener('hashchange', route);

  // A session in progress should survive a refresh and land you back in it.
  if (store.state.active && currentPath() === '/') location.hash = '#/train';
  route();

  // Warn before losing an in-progress session to a closed tab.
  window.addEventListener('beforeunload', (ev) => {
    if (!store.state.active) return;
    const logged = store.state.active.entries.some((e) => e.sets.some((s) => s.done));
    if (logged && store.persistFailed) { ev.preventDefault(); ev.returnValue = ''; }
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
