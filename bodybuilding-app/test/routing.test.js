/**
 * Routing helpers. These carry one screen's intent to another, so the parsing
 * has to survive the messy cases: no hash at all, a query with no path, an
 * exercise id that needs escaping.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { splitHash, hashPath, hashParams, routeTo, routeParams, clearRouteParams } from '../js/util/route.js';

test('splitHash separates the screen from the intent', () => {
  assert.deepEqual(splitHash('#/train?week=1&day=upper-a'), { path: '/train', query: 'week=1&day=upper-a' });
  assert.deepEqual(splitHash('#/history'), { path: '/history', query: '' });
  assert.deepEqual(splitHash('/history'), { path: '/history', query: '' });
  assert.deepEqual(splitHash(''), { path: '/', query: '' });
  assert.deepEqual(splitHash('#'), { path: '/', query: '' });
});

test('a query with an empty path still lands on the default screen', () => {
  assert.equal(hashPath('#?session=abc'), '/');
  assert.equal(hashParams('#?session=abc').get('session'), 'abc');
});

test('hashParams reads what the linking screen asked for', () => {
  const params = hashParams('#/train?week=2&day=lower-b&at=bb-squat');
  assert.equal(params.get('week'), '2');
  assert.equal(params.get('day'), 'lower-b');
  assert.equal(params.get('at'), 'bb-squat');
  assert.equal(params.get('nothing'), null);
});

test('routeTo builds a link that carries the intent', () => {
  assert.equal(routeTo('/train', { week: 0, day: 'upper-a' }), '#/train?week=0&day=upper-a');
  assert.equal(routeTo('/history', { session: 's_1' }), '#/history?session=s_1');
});

test('routeTo drops values that say nothing', () => {
  // A missing exercise must not become `at=undefined`, which reads as a real
  // request to jump to an exercise called "undefined".
  assert.equal(routeTo('/train', { week: 1, day: 'upper-a', at: undefined }), '#/train?week=1&day=upper-a');
  assert.equal(routeTo('/train', { at: null }), '#/train');
  assert.equal(routeTo('/train', { at: '' }), '#/train');
  assert.equal(routeTo('/train'), '#/train');
});

test('routeTo escapes ids rather than trusting them', () => {
  const link = routeTo('/train', { day: 'push & pull', at: 'db/press' });
  assert.ok(!link.includes(' '));
  assert.equal(hashParams(link).get('day'), 'push & pull');
  assert.equal(hashParams(link).get('at'), 'db/press');
});

test('a round trip through a link preserves week zero', () => {
  // Week 0 is a real week, and the falsy check that drops empty values must not
  // eat it - dropping it silently sends you to the wrong week of the block.
  const params = hashParams(routeTo('/train', { week: 0, day: 'upper-a' }));
  assert.equal(params.get('week'), '0');
  assert.equal(Number(params.get('week')), 0);
});

/* --- the two that read the live URL ----------------------------------- */

function withLocation(hash, fn) {
  const replaced = [];
  const priorLocation = globalThis.location;
  const priorWindow = globalThis.window;
  globalThis.location = { hash };
  globalThis.window = { history: { replaceState: (_s, _t, url) => { replaced.push(url); globalThis.location.hash = url; } } };
  try { fn(replaced); } finally {
    if (priorLocation === undefined) delete globalThis.location; else globalThis.location = priorLocation;
    if (priorWindow === undefined) delete globalThis.window; else globalThis.window = priorWindow;
  }
}

test('routeParams reads the current URL', () => {
  withLocation('#/train?week=3&day=upper-b', () => {
    assert.equal(routeParams().get('week'), '3');
    assert.equal(routeParams().get('day'), 'upper-b');
  });
});

test('clearRouteParams drops the intent but keeps the screen', () => {
  withLocation('#/train?week=3&day=upper-b', (replaced) => {
    clearRouteParams();
    assert.deepEqual(replaced, ['#/train']);
    // Acting on it twice must not re-fire it: a refresh should not start a
    // second session.
    assert.equal(routeParams().get('day'), null);
  });
});

test('clearRouteParams leaves a plain URL alone', () => {
  withLocation('#/history', (replaced) => {
    clearRouteParams();
    assert.deepEqual(replaced, []);
  });
});
