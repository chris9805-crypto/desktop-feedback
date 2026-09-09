/**
 * Bottom sheets, replacing window.prompt / confirm / alert.
 *
 * The browser dialogs are unusable on a phone: they cannot be styled, they
 * block the whole page, they look like a scam warning, and on iOS they can be
 * suppressed entirely - which would silently break renaming a block or
 * confirming a delete. These slide up from the bottom where a thumb is, and
 * return promises so calling code reads the same as before.
 */

import { h } from './dom.js';

function open(build) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      backdrop.classList.add('is-closing');
      setTimeout(() => backdrop.remove(), 150);
      document.removeEventListener('keydown', onKey);
      resolve(value);
    };
    const onKey = (ev) => { if (ev.key === 'Escape') finish(null); };

    const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' });
    const backdrop = h('div', { class: 'sheet-backdrop', onClick: (ev) => { if (ev.target === backdrop) finish(null); } }, panel);

    build(panel, finish);
    document.addEventListener('keydown', onKey);
    document.body.append(backdrop);
    requestAnimationFrame(() => backdrop.classList.add('is-open'));
    panel.querySelector('input, button')?.focus();
  });
}

function header(panel, title, body) {
  panel.append(h('div', { class: 'sheet-grip' }));
  panel.append(h('h2', { class: 'sheet-title' }, title));
  if (body) panel.append(h('p', { class: 'secondary', style: 'margin-bottom:14px' }, body));
}

export function confirmSheet({ title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false }) {
  return open((panel, finish) => {
    header(panel, title, body);
    panel.append(h('div', { class: 'sheet-actions' },
      h('button', { class: `btn-lg ${danger ? 'btn-danger' : 'btn-primary'}`, onClick: () => finish(true) }, confirmLabel),
      h('button', { class: 'btn-lg', onClick: () => finish(false) }, cancelLabel),
    ));
  });
}

export function alertSheet({ title, body, dismissLabel = 'Got it' }) {
  return open((panel, finish) => {
    header(panel, title, body);
    panel.append(h('div', { class: 'sheet-actions' },
      h('button', { class: 'btn-primary btn-lg', onClick: () => finish(true) }, dismissLabel),
    ));
  });
}

export function promptSheet({ title, body, label, value = '', confirmLabel = 'Save', multiline = false }) {
  return open((panel, finish) => {
    header(panel, title, body);
    const input = multiline
      ? h('textarea', { rows: 4, value })
      : h('input', { type: 'text', value, enterkeyhint: 'done' });
    if (!multiline) input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') finish(input.value); });
    panel.append(h('div', { class: 'field' }, label && h('label', {}, label), input));
    panel.append(h('div', { class: 'sheet-actions' },
      h('button', { class: 'btn-primary btn-lg', onClick: () => finish(input.value) }, confirmLabel),
      h('button', { class: 'btn-lg', onClick: () => finish(null) }, 'Cancel'),
    ));
    setTimeout(() => { input.focus(); input.select?.(); }, 60);
  });
}

/** A list of choices - what `prompt("enter a number")` was pretending to be. */
export function chooseSheet({ title, body, options, selected }) {
  return open((panel, finish) => {
    header(panel, title, body);
    const list = h('div', { class: 'sheet-list' });
    for (const option of options) {
      list.append(h('button', {
        class: 'sheet-option', 'aria-pressed': String(option.value === selected),
        onClick: () => finish(option.value),
      },
        h('span', { class: 'sheet-option-label' }, option.label),
        option.detail && h('span', { class: 'sheet-option-detail' }, option.detail),
      ));
    }
    panel.append(list);
    panel.append(h('div', { class: 'sheet-actions' },
      h('button', { class: 'btn-lg', onClick: () => finish(null) }, 'Cancel'),
    ));
  });
}
