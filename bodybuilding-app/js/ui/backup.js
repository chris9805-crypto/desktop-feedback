/**
 * Getting the log out of the browser and back in again.
 *
 * A textarea full of JSON is a backup only in the sense that a fire exit is a
 * door: technically correct, and nobody uses it. This hands over a real file
 * the phone will keep, and takes one back.
 *
 * Every path is guarded, because this is exactly where browsers differ: an
 * iPhone in a locked-down configuration can refuse the download, the clipboard
 * needs a permission, and a file picker can be cancelled. Failing quietly here
 * would tell someone their training is safe when it is not, so every failure
 * falls through to the next method and the timestamp is only recorded when
 * something actually left the app.
 */

import { h } from './dom.js';
import { store } from '../store.js';
import { alertSheet, confirmSheet } from './sheet.js';

/**
 * Hand the log over as a file. Resolves true only if the browser accepted it -
 * a refused download must not be recorded as a backup.
 */
export async function downloadBackup() {
  const text = store.exportJson();
  const name = store.backupFilename();

  try {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: name, style: 'display:none' });
    document.body.append(a);
    a.click();
    a.remove();
    // Revoking immediately can cancel the download on some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    store.noteBackup();
    return true;
  } catch {
    return copyBackup();
  }
}

/** The fallback: the clipboard, then the screen. */
export async function copyBackup() {
  const text = store.exportJson();
  try {
    await navigator.clipboard.writeText(text);
    store.noteBackup();
    return true;
  } catch {
    return false;
  }
}

/**
 * Read a backup file the person picked. The confirmation is deliberately blunt
 * - this replaces everything, and there is no undo.
 */
export async function importFromFile(file, { onDone } = {}) {
  if (!file) return false;
  let text;
  try {
    text = await file.text();
  } catch (err) {
    await alertSheet({ title: 'Could not read that file', body: String(err.message ?? err) });
    return false;
  }

  let preview;
  try {
    preview = describe(text);
  } catch (err) {
    await alertSheet({
      title: 'That is not an IronBlock backup',
      body: `${err.message}\n\nIt should be the .json file the app gave you, not a screenshot or a link.`,
    });
    return false;
  }

  const ok = await confirmSheet({
    title: 'Replace everything on this device?',
    body: `That file holds ${preview}.\n\nWhatever is on this device now goes, including anything logged since.`,
    confirmLabel: 'Replace it', cancelLabel: 'Keep what I have', danger: true,
  });
  if (!ok) return false;

  try {
    store.importJson(text);
  } catch (err) {
    await alertSheet({ title: 'That did not work', body: String(err.message ?? err) });
    return false;
  }
  store.noteBackup();
  onDone?.();
  await alertSheet({ title: 'Restored', body: `Your training history is back — ${preview}.` });
  return true;
}

/** What is in a backup file, in a sentence, before it overwrites anything. */
export function describe(text) {
  const parsed = JSON.parse(text);
  if (!parsed || !Array.isArray(parsed.sessions)) throw new Error('No sessions in that file.');
  const sessions = parsed.sessions.length;
  const dates = parsed.sessions.map((s) => s.date).filter(Number.isFinite);
  const span = dates.length
    ? ` from ${new Date(Math.min(...dates)).toLocaleDateString()} to ${new Date(Math.max(...dates)).toLocaleDateString()}`
    : '';
  const blocks = (parsed.mesocycles ?? []).length;
  return `${sessions} session${sessions === 1 ? '' : 's'}${span}`
    + (blocks ? ` across ${blocks} block${blocks === 1 ? '' : 's'}` : '');
}

/** A file input that does not look like one. */
export function importButton(label, { onDone } = {}) {
  const input = h('input', {
    type: 'file', accept: 'application/json,.json', style: 'display:none',
    onChange: async (ev) => {
      const file = ev.target.files?.[0];
      ev.target.value = '';           // so picking the same file twice still fires
      await importFromFile(file, { onDone });
    },
  });
  const button = h('button', { onClick: () => input.click() }, label);
  return h('span', {}, button, input);
}
