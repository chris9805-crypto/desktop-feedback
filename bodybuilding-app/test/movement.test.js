/**
 * Movement demos.
 *
 * Hand-tuned coordinates rot silently: a pattern gets added and has no figure,
 * or a joint gets nudged off-canvas and nobody notices because the rest of the
 * drawing still looks fine. These are the checks a human eye would not reliably
 * do 42 times.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { POSES, posesFor } from '../js/data/poses.js';
import { PATTERNS, patternFor } from '../js/data/patterns.js';
import { EXERCISES } from '../js/data/exercises.js';

const JOINTS = ['head', 'neck', 'shoulder', 'elbow', 'hand', 'hip', 'knee', 'ankle', 'toe'];
/** Drawn only where a pattern needs them - a wrist curl moves nothing else. */
const OPTIONAL = ['wrist', 'backKnee', 'backAnkle', 'backToe', 'farElbow', 'farHand'];
const point = (pose, joint) => pose[joint] ?? null;
const PROPS = ['floor', 'bench', 'lowBench', 'incline', 'seat', 'pad', 'highBar', 'stack', 'step'];
const LOADS = ['none', 'bar', 'dumbbell', 'handle'];

const everyPose = Object.entries(POSES).flatMap(([id, p]) =>
  [['bottom', p.bottom], ['top', p.top]].map(([phase, pose]) => ({ id, phase, pose })));

test('every movement pattern has both ends of the rep drawn', () => {
  const missing = Object.keys(PATTERNS).filter((id) => !posesFor(id));
  assert.deepEqual(missing, [], `no figure for: ${missing.join(', ')}`);
  for (const id of Object.keys(PATTERNS)) {
    assert.ok(POSES[id].bottom, `${id} has no start position`);
    assert.ok(POSES[id].top, `${id} has no finish position`);
  }
});

test('no figure is drawn for a pattern that does not exist', () => {
  const orphans = Object.keys(POSES).filter((id) => !PATTERNS[id]);
  assert.deepEqual(orphans, []);
});

test('every exercise reaches a figure through its pattern', () => {
  // This is the chain that actually matters: exercise -> pattern -> poses.
  const stranded = EXERCISES.filter((e) => {
    const pattern = patternFor(e.id);
    return !pattern || !posesFor(pattern.id);
  }).map((e) => e.id);
  assert.deepEqual(stranded, []);
});

test('every pose has every joint, as a pair of numbers', () => {
  for (const { id, phase, pose } of everyPose) {
    for (const joint of JOINTS) {
      const point = pose[joint];
      assert.ok(Array.isArray(point) && point.length === 2, `${id}.${phase}.${joint} is not a point`);
      assert.ok(point.every(Number.isFinite), `${id}.${phase}.${joint} has a non-number in it`);
    }
  }
});

test('nothing is drawn outside the canvas', () => {
  // A limb off the edge is invisible rather than wrong-looking, which is how
  // this kind of mistake survives a glance at the page.
  for (const { id, phase, pose } of everyPose) {
    for (const joint of [...JOINTS, 'backKnee', 'backAnkle', 'backToe', 'farElbow', 'farHand', 'wrist']) {
      const point = pose[joint];
      if (!point) continue;
      assert.ok(point[0] >= 0 && point[0] <= 100, `${id}.${phase}.${joint} x=${point[0]} is off-canvas`);
      assert.ok(point[1] >= 0 && point[1] <= 110, `${id}.${phase}.${joint} y=${point[1]} is off-canvas`);
    }
  }
});

test('nobody is standing underground', () => {
  for (const { id, phase, pose } of everyPose) {
    if (!(pose.props ?? []).includes('floor')) continue;
    assert.ok(pose.ankle[1] <= 100.5, `${id}.${phase} ankle is below the floor`);
    assert.ok(pose.head[1] < pose.hip[1], `${id}.${phase} is upside down`);
  }
});

test('the load and the furniture are things the renderer can draw', () => {
  for (const { id, phase, pose } of everyPose) {
    assert.ok(LOADS.includes(pose.load), `${id}.${phase} carries an unknown load "${pose.load}"`);
    for (const prop of pose.props ?? []) {
      assert.ok(PROPS.includes(prop), `${id}.${phase} wants an unknown prop "${prop}"`);
    }
  }
});

test('a split stance draws its back leg completely or not at all', () => {
  for (const { id, phase, pose } of everyPose) {
    if (!pose.backKnee) continue;
    assert.ok(pose.backAnkle, `${id}.${phase} has a back knee and no back ankle`);
  }
});

test('the two ends of every rep are actually different', () => {
  // A figure that does not move is worse than no figure: it says the movement
  // has no range, which is the opposite of the point.
  for (const [id, { bottom, top }] of Object.entries(POSES)) {
    const moved = [...JOINTS, ...OPTIONAL].some((j) => {
      const a = point(bottom, j);
      const b = point(top, j);
      return a && b && (a[0] !== b[0] || a[1] !== b[1]);
    });
    assert.ok(moved, `${id} draws the same position twice`);
  }
});

test('the moving end travels far enough to see', () => {
  // Every one of these is a limb moving a real distance. Under about eight
  // units the two panels read as a rendering glitch rather than a rep.
  for (const [id, { bottom, top }] of Object.entries(POSES)) {
    const travel = Math.max(...[...JOINTS, ...OPTIONAL].map((j) => {
      const a = point(bottom, j);
      const b = point(top, j);
      return a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : 0;
    }));
    assert.ok(travel >= 8, `${id} only moves ${travel.toFixed(1)} units between start and finish`);
  }
});

test('both positions of a pattern stand on the same furniture', () => {
  // A bench that appears halfway through the rep reads as two different lifts.
  for (const [id, { bottom, top }] of Object.entries(POSES)) {
    assert.deepEqual([...(bottom.props ?? [])].sort(), [...(top.props ?? [])].sort(),
      `${id} changes its furniture between start and finish`);
  }
});
