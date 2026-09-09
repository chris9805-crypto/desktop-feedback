/**
 * Home-screen install.
 *
 * Kept out of app.js so Settings can ask about install state without importing
 * the router that imports Settings - a cycle that happens to work because
 * function declarations hoist, right up until someone converts one to a const.
 *
 * The browser event is captured and held rather than acted on. An install
 * banner thrown over someone mid-set is how people learn to dismiss things
 * without reading them; the offer belongs in Settings, at a moment they chose.
 */

let deferred = null;

export function listen() {
  window.addEventListener('beforeinstallprompt', (ev) => {
    ev.preventDefault();
    deferred = ev;
    document.documentElement.classList.add('can-install');
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    document.documentElement.classList.remove('can-install');
  });
}

export function canInstall() {
  return deferred != null;
}

export async function promptInstall() {
  if (!deferred) return false;
  deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  document.documentElement.classList.remove('can-install');
  return outcome === 'accepted';
}

/** Already running as an installed app, so there is nothing to offer. */
export function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

/** iOS has no install event - Safari requires the Share-sheet route. */
export function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
