/**
 * The README quotes the time cost of every program. Those numbers came from
 * the engine once; without this they quietly go stale the first time a
 * template changes, and the app ends up advertising a program that no longer
 * exists. Same lesson as dropping the hand-written sessionMinutes field.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PROGRAMS } from '../js/data/programs.js';
import { programTimeProfile } from '../js/engine/mesocycle.js';

const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');

test('the README quotes the weekly hours the engine actually computes', () => {
  for (const program of PROGRAMS) {
    const t = programTimeProfile(program);
    const expected = `${(t.weeklyStart / 60).toFixed(1)}–${(t.weeklyPeak / 60).toFixed(1)} h`;
    assert.ok(readme.includes(`**${program.name}**`), `README does not list ${program.name}`);
    assert.ok(readme.includes(expected),
      `README is stale for ${program.name}: it should say "${expected}"`);
  }
});

test('the README quotes the real test count', () => {
  const claimed = readme.match(/(\d+) tests/)?.[1];
  assert.ok(claimed, 'README should say how many tests there are');
});
