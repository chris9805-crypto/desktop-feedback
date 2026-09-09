/** Router and shell. Hash routing so the whole thing runs from a file:// URL too. */

import { h, clear } from './ui/dom.js';
import { store } from './store.js';
import * as dashboard from './ui/views/dashboard.js';
import * as programs from './ui/views/programs.js';
import * as train from './ui/views/train.js';
import * as history from './ui/views/history.js';
import * as exercises from './ui/views/exercises.js';
import * as settings from './ui/views/settings.js';
import * as learn from './ui/views/learn.js';
import * as onboarding from './ui/views/onboarding.js';
import * as crew from './ui/views/crew.js';
import { listen as listenForInstall } from './ui/install.js';

/**
 * `tab` marks the five routes that get a slot in the phone's bottom bar.
 * Everything else is reachable from within a page or from Settings - a bottom
 * bar with eight items is a bottom bar nobody can hit.
 */
const ROUTES = [
  { path: '/', label: 'Today', view: dashboard, tab: true, icon: 'home' },
  { path: '/train', label: 'Train', view: train, tab: true, icon: 'dumbbell' },
  { path: '/programs', label: 'Programs', view: programs, tab: true, icon: 'calendar' },
  { path: '/history', label: 'Progress', view: history, tab: true, icon: 'chart' },
  { path: '/crew', label: 'Crew', view: crew, tab: true, icon: 'people' },
  { path: '/learn', label: 'Learn', view: learn },
  { path: '/exercises', label: 'Exercises', view: exercises },
  { path: '/settings', label: 'Settings', view: settings },
  { path: '/welcome', label: 'Welcome', view: onboarding },
];

const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
  dumbbell: 'M2 9h2v6H2zm3-2h3v10H5zm4 4h6v2H9zm7-4h3v10h-3zm4 2h2v6h-2z',
  calendar: 'M4 5h16v16H4zm0 5h16M8 3v4m8-4v4',
  chart: 'M4 20V10m5 10V4m5 16v-7m5 7V8',
  book: 'M4 4h7a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zm16 0h-7a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h7z',
  people: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1m3-6h1a5 5 0 0 1 5 5v1',
};

function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'tab-icon');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', ICONS[name] ?? ICONS.home);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.8');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('stroke-linecap', 'round');
  svg.appendChild(path);
  return svg;
}

function currentPath() {
  const raw = location.hash.replace(/^#/, '') || '/';
  return ROUTES.some((r) => r.path === raw) ? raw : '/';
}

function shell() {
  return h('div', { class: 'app' },
    h('header', { class: 'topbar' },
      h('a', { class: 'brand', href: '#/' }, 'IRONBLOCK', h('span', {}, 'lift with a plan')),
      h('nav', { class: 'nav' },
        ...ROUTES.filter((r) => r.path !== '/welcome')
          .map((r) => h('a', { href: `#${r.path}`, dataset: { path: r.path } }, r.label)),
      ),
      h('a', { class: 'icon-button', href: '#/settings', 'aria-label': 'Settings', title: 'Settings' }, '⚙'),
    ),
    h('main', { id: 'view' }),
    // Phone navigation. Hidden on wide screens, where the header nav is better.
    h('nav', { class: 'tabbar', 'aria-label': 'Main' },
      ...ROUTES.filter((r) => r.tab).map((r) => h('a', {
        href: `#${r.path}`, dataset: { path: r.path }, class: 'tab',
      }, icon(r.icon), h('span', {}, r.label))),
    ),
  );
}

function route() {
  const path = currentPath();
  const view = ROUTES.find((r) => r.path === path).view;
  const main = document.getElementById('view');
  clear(main);
  view.render(main);
  for (const link of document.querySelectorAll('[data-path]')) {
    if (link.dataset.path === path) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  const label = ROUTES.find((r) => r.path === path).label;
  document.title = path === '/' ? 'IronBlock' : `IronBlock · ${label}`;
  window.scrollTo(0, 0);
}

/* ------------------------------------------------------------------ boot */

function boot() {
  document.body.append(shell());
  settings.applyTheme();
  listenForInstall();
  window.addEventListener('hashchange', route);

  // First run goes to the walkthrough rather than dropping someone into a
  // dashboard full of words they have not met yet.
  if (!store.state.settings.onboarded && !store.state.mesocycles.length && currentPath() === '/') {
    location.hash = '#/welcome';
  } else if (store.state.active && currentPath() === '/') {
    // A session in progress should survive a refresh and land you back in it.
    location.hash = '#/train';
  }
  route();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // Offline support is a bonus; the app is fully usable without it.
    });
  }

  window.addEventListener('beforeunload', (ev) => {
    if (!store.state.active) return;
    const logged = store.state.active.entries.some((e) => e.sets.some((s) => s.done));
    if (logged && store.persistFailed) { ev.preventDefault(); ev.returnValue = ''; }
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
