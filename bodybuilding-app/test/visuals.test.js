/**
 * Exercise visuals.
 *
 * The diagrams are generated from the exercise data rather than drawn by hand,
 * which is the whole reason they can be trusted: they cannot disagree with the
 * volume engine, and a new exercise gets a correct picture with no artwork.
 * These tests guard that property - that every exercise has a pattern, that
 * every muscle can actually be drawn, and that a map never silently omits a
 * muscle the app is counting sets for.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { EXERCISES, getExercise, volumeContribution } from '../js/data/exercises.js';
import { MUSCLES } from '../js/data/muscles.js';
import { PATTERNS, EXERCISE_PATTERN, patternFor } from '../js/data/patterns.js';
import { DRAWN_MUSCLES } from '../js/ui/muscle-map.js';

test('every exercise has a movement pattern', () => {
  const missing = EXERCISES.filter((e) => !patternFor(e.id)).map((e) => e.id);
  assert.deepEqual(missing, [], 'an exercise with no pattern shows no diagram at all');
});

test('the pattern map has no entries for exercises that do not exist', () => {
  const stale = Object.keys(EXERCISE_PATTERN).filter((id) => !getExercise(id));
  assert.deepEqual(stale, [], 'a renamed exercise would leave a dead mapping behind');
  const unknown = Object.values(EXERCISE_PATTERN).filter((p) => !PATTERNS[p]);
  assert.deepEqual([...new Set(unknown)], []);
});

test('every pattern is used by at least one exercise', () => {
  const used = new Set(Object.values(EXERCISE_PATTERN));
  const orphans = Object.keys(PATTERNS).filter((p) => !used.has(p));
  assert.deepEqual(orphans, [], 'a pattern nobody points at is dead weight');
});

test('every pattern describes both ends of the rep and what to watch', () => {
  for (const [id, pattern] of Object.entries(PATTERNS)) {
    assert.ok(pattern.name && pattern.summary, `${id} is missing its description`);
    assert.ok(pattern.bottom.length > 12, `${id} does not describe the start position`);
    assert.ok(pattern.top.length > 12, `${id} does not describe the finish position`);
    assert.ok(pattern.watch.length > 20, `${id} does not say what goes wrong`);
  }
});

test('a pattern is plausible for the exercises assigned to it', () => {
  // A press mapped to the hinge pattern would show someone the wrong picture
  // and the wrong cue, which is worse than showing nothing.
  const expectations = {
    squat: 'quads', hinge: 'hamstrings', legCurl: 'hamstrings', legExtension: 'quads',
    curl: 'biceps', tricepsExtension: 'triceps', calfRaise: 'calves', crunch: 'abs',
    hipExtension: 'glutes', wristCurl: 'forearms', raise: 'sideDelts',
    verticalPull: 'lats', horizontalPull: 'upperBack', horizontalPress: 'chest',
    verticalPress: 'frontDelts', inclinePress: 'chest', lunge: 'quads',
    shrug: 'traps', deadlift: 'hamstrings', fly: 'chest', reverseFly: 'rearDelts',
  };
  for (const [id, pattern] of Object.entries(EXERCISE_PATTERN)) {
    const expected = expectations[pattern];
    if (!expected) continue;
    const exercise = getExercise(id);
    const trains = [...exercise.primary, ...exercise.secondary];
    assert.ok(trains.includes(expected),
      `${id} is filed under "${pattern}" but does not train ${expected}`);
  }
});

test('every muscle the app counts can be drawn', () => {
  // A muscle with no shape would be silently missing from every diagram while
  // still appearing in the volume chart.
  const undrawable = Object.keys(MUSCLES).filter((m) => !DRAWN_MUSCLES.has(m));
  assert.deepEqual(undrawable, []);
});

test('every muscle an exercise trains appears on its map', () => {
  for (const exercise of EXERCISES) {
    for (const muscle of Object.keys(volumeContribution(exercise))) {
      assert.ok(DRAWN_MUSCLES.has(muscle),
        `${exercise.id} trains ${muscle}, which the map cannot show`);
    }
  }
});

test('no exercise produces a blank map', () => {
  for (const exercise of EXERCISES) {
    const lit = Object.keys(volumeContribution(exercise));
    assert.ok(lit.length > 0, `${exercise.id} would render an empty figure`);
  }
});
