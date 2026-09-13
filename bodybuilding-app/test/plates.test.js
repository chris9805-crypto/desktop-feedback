/**
 * Plate maths. The only thing that matters here is never telling someone a
 * loadout that is not what they asked for without saying so.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  loadout, shorthand, plateCount, nearestLoadable, DEFAULT_PLATES, DEFAULT_BAR, plateColour,
} from '../js/engine/plates.js';

const kg = { bar: 20, plates: DEFAULT_PLATES.kg };
const lb = { bar: 45, plates: DEFAULT_PLATES.lb };

test('the usual numbers come out right', () => {
  assert.equal(shorthand(loadout(100, kg)), '25 · 15');
  assert.equal(shorthand(loadout(60, kg)), '20');
  assert.equal(shorthand(loadout(140, kg)), '25 · 25 · 10');
  assert.equal(shorthand(loadout(225, lb)), '45 · 45');
});

test('every loadout actually adds up to what it claims', () => {
  for (let total = 20; total <= 300; total += 2.5) {
    const result = loadout(total, kg);
    const sum = result.bar + result.perSide.reduce((n, p) => n + p.weight * p.count, 0) * 2;
    assert.ok(Math.abs(sum - result.achieved) < 0.001, `${total} claims ${result.achieved}, loads ${sum}`);
    assert.ok(result.achieved <= total + 0.001, `${total} loaded to ${result.achieved}`);
  }
});

test('1.25s survive the floating point', () => {
  const result = loadout(102.5, kg);
  assert.equal(result.achieved, 102.5);
  assert.ok(result.exact);
  assert.equal(shorthand(result), '25 · 15 · 1.25');
});

test('an unreachable number is reported, not silently rounded', () => {
  const result = loadout(61, kg);
  assert.ok(!result.exact);
  assert.equal(result.achieved, 60);
  assert.ok(result.short > 0);
});

test('the bar on its own is a valid answer', () => {
  const result = loadout(20, kg);
  assert.ok(result.exact);
  assert.deepEqual(result.perSide, []);
  assert.equal(shorthand(result), 'bar only');
  assert.equal(plateCount(result), 0);
});

test('a target under the bar says so rather than inventing negative plates', () => {
  const result = loadout(12, kg);
  assert.ok(result.tooLight);
  assert.deepEqual(result.perSide, []);
  assert.equal(result.achieved, 20);
});

test('a thinner rack still works, using what is there', () => {
  const sparse = { bar: 20, plates: [20, 10, 5] };
  const result = loadout(100, sparse);
  assert.equal(shorthand(result), '20 · 20');
  assert.equal(result.achieved, 100);
  const odd = loadout(102.5, sparse);
  assert.equal(odd.achieved, 100);
  assert.ok(!odd.exact);
});

test('nearest loadable picks the closer of the two neighbours', () => {
  assert.equal(nearestLoadable(101, kg), 100);
  assert.equal(nearestLoadable(102, kg), 102.5);
  assert.equal(nearestLoadable(100, kg), 100);
});

test('defaults exist for both units', () => {
  assert.equal(DEFAULT_BAR.kg, 20);
  assert.equal(DEFAULT_BAR.lb, 45);
  assert.ok(DEFAULT_PLATES.kg.includes(2.5));
  assert.ok(DEFAULT_PLATES.lb.includes(45));
});

test('plates have a colour, and unknown ones fall back rather than throw', () => {
  assert.equal(plateColour(20, 'kg'), '#2a63c0');
  assert.match(plateColour(3.75, 'kg'), /^#/);
});

test('rubbish in gives nothing out, not a crash', () => {
  assert.equal(loadout(null, kg), null);
  assert.equal(loadout(NaN, kg), null);
  assert.equal(shorthand(null), 'bar only');
});
