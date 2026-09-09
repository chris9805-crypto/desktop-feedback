/**
 * Learn - the glossary as a browsable page.
 *
 * Terms are also tappable wherever they appear in the app; this is for the
 * person who wants to sit down and read the whole vocabulary once.
 */

import { h, clear } from '../dom.js';
import { GLOSSARY, GLOSSARY_ORDER } from '../../data/glossary.js';
import { store } from '../../store.js';

export function render(container) {
  clear(container);
  const wrap = h('div', { class: 'stack' });

  wrap.append(h('div', { class: 'page-head' },
    h('h1', {}, 'What the words mean'),
    h('p', {},
      'Lifting has a lot of jargon and most of it is hiding a simple idea. Everything ' +
      'the app says is explained here, and you can tap any underlined word anywhere in ' +
      'the app to get the same explanation where you stand.'),
  ));

  wrap.append(h('div', { class: 'card' },
    h('h3', {}, 'If you read one thing'),
    h('p', { class: 'secondary', style: 'margin-top:8px' },
      'Muscle grows when you give it a bit more than it is used to, then let it recover. ' +
      'That is the whole science. Everything else in this app is machinery for doing that ' +
      'steadily instead of in bursts: a little more each week, a lighter week every fifth ' +
      'week, and honest answers about how hard things felt so the numbers stay right.'),
    h('p', { class: 'secondary', style: 'margin-bottom:0' },
      h('b', {}, 'The two habits that matter most: '),
      'turn up, and write down what you actually did. Everything else the app handles.'),
  ));

  const search = h('input', {
    type: 'search', placeholder: 'Search the words…', 'aria-label': 'Search terms',
    onInput: (ev) => draw(list, ev.target.value),
  });
  const list = h('div', { class: 'stack' });
  wrap.append(h('div', { class: 'filter-row' }, search), list);
  draw(list, '');

  wrap.append(h('div', { class: 'card' },
    h('h3', {}, 'A few things nobody tells you'),
    h('div', { class: 'stack small secondary', style: 'gap:10px;margin-top:10px' },
      tip('Soreness is not the score.',
        'Being wrecked for three days is not proof a session worked, and feeling fine is ' +
        'not proof it did not. Whether the weights go up over months is the score.'),
      tip('Your first few weeks are about technique, not weight.',
        'Everyone loads the bar too early. Getting the movement right first is what lets ' +
        'you add weight for years instead of months.'),
      tip('You will not grow without eating enough.',
        'Training is the signal; food is the material. If your bodyweight has not moved in ' +
        'two months and neither have your lifts, this is usually why.'),
      tip('Sleep does more than any supplement.',
        'Recovery is when muscle is actually built. Short sleep shows up as stalled lifts ' +
        'and joints that ache before anything else.'),
      tip('Missing a session is not failure.',
        'Log the next one. A program run at 80% for a year beats a perfect month.'),
    ),
  ));

  container.append(wrap);
}

function draw(list, query) {
  clear(list);
  const q = query.trim().toLowerCase();
  const matches = GLOSSARY_ORDER.filter((key) => {
    const e = GLOSSARY[key];
    return !q || `${e.term} ${e.plain} ${e.short}`.toLowerCase().includes(q);
  });

  if (!matches.length) {
    list.append(h('div', { class: 'empty' }, h('h3', {}, 'No match'), h('p', {}, 'Try a different word.')));
    return;
  }

  for (const key of matches) {
    const e = GLOSSARY[key];
    list.append(h('div', { class: 'card' },
      h('div', { class: 'card-head' },
        h('h3', {}, e.plain.charAt(0).toUpperCase() + e.plain.slice(1)),
        e.term.toLowerCase() !== e.plain.toLowerCase() && h('span', { class: 'badge' }, e.term),
      ),
      h('p', { class: 'strong', style: 'margin-bottom:8px' }, e.short),
      e.full && h('p', { class: 'secondary' }, e.full),
      e.why && h('p', { class: 'secondary', style: 'margin-bottom:0' },
        h('b', {}, 'Why it matters: '), e.why),
    ));
  }
}

function tip(title, body) {
  return h('div', {}, h('b', { style: 'color:var(--text-primary)' }, title), ' ', body);
}
