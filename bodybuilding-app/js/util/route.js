/**
 * Hash routing with a query string.
 *
 * One screen hands another an intention - "open Train on Lower A", "open
 * History at this session" - and it travels in the URL rather than in a shared
 * module variable, so it survives a refresh, can be linked to, and no screen
 * needs a reference to another screen's internals.
 *
 * Kept apart from the router itself so the parsing has no DOM in it and can be
 * tested directly.
 */

/** `#/train?week=1&day=upper-a` -> `{ path: '/train', query: 'week=1&day=upper-a' }`. */
export function splitHash(hash = '') {
  const raw = String(hash).replace(/^#/, '');
  const cut = raw.indexOf('?');
  if (cut === -1) return { path: raw || '/', query: '' };
  return { path: raw.slice(0, cut) || '/', query: raw.slice(cut + 1) };
}

export function hashPath(hash) {
  return splitHash(hash).path;
}

export function hashParams(hash) {
  return new URLSearchParams(splitHash(hash).query);
}

/**
 * Build a link that carries an intent. Empty and absent values are dropped so
 * `routeTo('/train', { at: undefined })` is just `#/train` rather than a link
 * that says something it does not mean.
 */
export function routeTo(path, params = {}) {
  const query = new URLSearchParams(
    Object.entries(params ?? {}).filter(([, v]) => v != null && v !== ''),
  ).toString();
  return `#${path}${query ? `?${query}` : ''}`;
}

/** What the screen that linked here asked for. */
export function routeParams() {
  return hashParams(location.hash);
}

/**
 * Drop the query once a screen has acted on it, without adding a history
 * entry. Otherwise a refresh re-fires the intent and starting a session
 * becomes something that happens to you twice.
 */
export function clearRouteParams() {
  if (!location.hash.includes('?')) return;
  window.history.replaceState(null, '', `#${splitHash(location.hash).path}`);
}
