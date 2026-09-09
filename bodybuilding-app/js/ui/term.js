/**
 * Tappable jargon.
 *
 * Wherever a technical word is unavoidable it gets wrapped in one of these: a
 * dotted underline that opens the plain-English definition. Nobody has to go
 * and look anything up, and nobody has to already know.
 */

import { h } from './dom.js';
import { lookup, GLOSSARY_ORDER } from '../data/glossary.js';
import { alertSheet } from './sheet.js';

export function showTerm(key) {
  const entry = lookup(key);
  if (!entry) return;
  return alertSheet({
    title: `${entry.term}${entry.plain && entry.plain !== entry.term.toLowerCase() ? ` · ${entry.plain}` : ''}`,
    body: [entry.short, entry.full, entry.why].filter(Boolean).join('\n\n'),
    dismissLabel: 'Makes sense',
  });
}

/** `term('rir')` renders the plain wording; `term('rir', 'RIR')` renders given text. */
export function term(key, text) {
  const entry = lookup(key);
  const label = text ?? entry?.plain ?? key;
  if (!entry) return document.createTextNode(label);
  return h('button', {
    class: 'term',
    type: 'button',
    title: `What is ${entry.term.toLowerCase()}?`,
    'aria-label': `${label} — tap for an explanation`,
    onClick: (ev) => { ev.preventDefault(); ev.stopPropagation(); showTerm(key); },
  }, label);
}

export { GLOSSARY_ORDER };
