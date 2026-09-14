/**
 * Drawing the two ends of a rep.
 *
 * The figure is deliberately a diagram: rounded sticks and a circle for a head,
 * no faces, no muscle shading, nothing that invites the eye to judge it as a
 * drawing of a person. It has one job - showing where the body starts and where
 * it finishes - and a plain figure does that better than a good one, because
 * nothing on it is competing for attention with the limb that moved.
 *
 * The furniture matters more than it looks. A press and a fly are almost the
 * same two poses; the bench, the cable stack and the leg pad are most of what
 * tells you which movement you are looking at.
 */

import { svg, h } from './dom.js';
import { posesFor } from '../data/poses.js';
import { patternFor, PATTERNS } from '../data/patterns.js';

const W = 100;
const H = 110;

/** Furniture, drawn behind the body. */
function props(pose) {
  const out = [];
  const list = pose.props ?? [];
  const rect = (x, y, w, h, cls, rx = 2) =>
    svg('rect', { x, y, width: w, height: h, rx, class: cls });

  if (list.includes('floor')) {
    out.push(svg('line', { x1: 4, y1: 100, x2: 96, y2: 100, class: 'mv-floor' }));
  }
  if (list.includes('bench')) {
    out.push(rect(24, 60, 52, 5, 'mv-prop'));
    out.push(rect(46, 65, 5, 35, 'mv-prop'));
  }
  if (list.includes('lowBench')) {
    out.push(rect(18, 62, 34, 5, 'mv-prop'));
    out.push(rect(22, 67, 5, 33, 'mv-prop'));
  }
  if (list.includes('incline')) {
    out.push(svg('polygon', { points: '30,52 70,74 70,80 30,58', class: 'mv-prop' }));
    out.push(rect(58, 78, 5, 22, 'mv-prop'));
  }
  if (list.includes('seat')) {
    out.push(rect(28, 64, 30, 5, 'mv-prop'));
    out.push(rect(28, 40, 5, 26, 'mv-prop'));
    out.push(rect(40, 69, 5, 31, 'mv-prop'));
  }
  if (list.includes('pad')) {
    out.push(svg('circle', { cx: 74, cy: 74, r: 5, class: 'mv-prop' }));
  }
  if (list.includes('highBar')) {
    out.push(svg('line', { x1: 26, y1: 10, x2: 74, y2: 10, class: 'mv-bar' }));
  }
  if (list.includes('step')) {
    out.push(rect(38, 92, 34, 8, 'mv-prop'));
  }
  if (list.includes('stack')) {
    out.push(rect(6, 22, 14, 60, 'mv-prop', 3));
    out.push(svg('line', { x1: 13, y1: 24, x2: 13, y2: 40, class: 'mv-cable' }));
  }
  return out;
}

function limb(a, b, cls) {
  return svg('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: cls });
}

/** What is in the hands, drawn at the hand. */
function load(pose) {
  const [x, y] = pose.hand;
  if (pose.load === 'bar') {
    return [svg('line', { x1: x - 9, y1: y, x2: x + 9, y2: y, class: 'mv-bar' }),
            svg('circle', { cx: x, cy: y, r: 2.4, class: 'mv-load' })];
  }
  if (pose.load === 'dumbbell') {
    return [svg('line', { x1: x - 5, y1: y, x2: x + 5, y2: y, class: 'mv-bar' })];
  }
  if (pose.load === 'handle') {
    return [svg('circle', { cx: x, cy: y, r: 2.6, class: 'mv-load' }),
            svg('line', { x1: 13, y1: 40, x2: x, y2: y, class: 'mv-cable' })];
  }
  return [];
}

/** One position, as an SVG element. */
export function movementFigure(pose, { height = 120, label = '' } = {}) {
  const figure = svg('svg', {
    viewBox: `0 0 ${W} ${H}`,
    class: 'mv-figure',
    style: `height:${height}px`,
    role: 'img',
    'aria-label': label,
  });

  for (const prop of props(pose)) figure.appendChild(prop);

  // A back leg, where the pattern has one, goes behind the torso.
  if (pose.backKnee) {
    figure.appendChild(limb(pose.hip, pose.backKnee, 'mv-limb mv-far'));
    figure.appendChild(limb(pose.backKnee, pose.backAnkle, 'mv-limb mv-far'));
    if (pose.backToe) figure.appendChild(limb(pose.backAnkle, pose.backToe, 'mv-limb mv-far'));
  }

  if (pose.farHand) {
    figure.appendChild(limb(pose.shoulder, pose.farElbow ?? pose.farHand, 'mv-limb mv-far'));
    figure.appendChild(limb(pose.farElbow ?? pose.farHand, pose.farHand, 'mv-limb mv-far'));
  }

  figure.appendChild(limb(pose.neck, pose.hip, 'mv-torso'));
  figure.appendChild(limb(pose.hip, pose.knee, 'mv-limb'));
  figure.appendChild(limb(pose.knee, pose.ankle, 'mv-limb'));
  figure.appendChild(limb(pose.ankle, pose.toe, 'mv-foot'));
  figure.appendChild(limb(pose.shoulder, pose.elbow, 'mv-limb'));
  figure.appendChild(limb(pose.elbow, pose.hand, 'mv-limb'));
  if (pose.wrist) figure.appendChild(limb(pose.hand, pose.wrist, 'mv-foot'));
  figure.appendChild(svg('circle', { cx: pose.head[0], cy: pose.head[1], r: 6.5, class: 'mv-head' }));

  for (const piece of load(pose)) figure.appendChild(piece);
  if (pose.farHand && pose.load === 'dumbbell') {
    figure.appendChild(svg('line', {
      x1: pose.farHand[0] - 5, y1: pose.farHand[1], x2: pose.farHand[0] + 5, y2: pose.farHand[1],
      class: 'mv-bar mv-far',
    }));
  }
  return figure;
}

/**
 * Both ends of the rep, side by side, each captioned with what the pattern
 * already says about that position. The words and the picture are the same
 * fact told twice, which is the point - one of them will land.
 */
export function movementDemo(patternId, { height = 120 } = {}) {
  const pattern = PATTERNS[patternId];
  const poses = posesFor(patternId);
  if (!pattern || !poses) return null;

  const panel = (phase, caption, text) => h('figure', { class: 'mv-panel' },
    movementFigure(poses[phase], { height, label: `${pattern.name}: ${text}` }),
    h('figcaption', {},
      h('span', { class: 'mv-phase' }, caption),
      h('span', { class: 'mv-text' }, text),
    ),
  );

  return h('div', { class: 'mv-demo' },
    panel('bottom', 'Start', pattern.bottom),
    h('span', { class: 'mv-arrow', 'aria-hidden': 'true' }, '→'),
    panel('top', 'Finish', pattern.top),
  );
}

/** The demo for an exercise, via its pattern. Null when there is nothing to draw. */
export function movementDemoFor(exerciseId, options) {
  const pattern = patternFor(exerciseId);
  return pattern ? movementDemo(pattern.id, options) : null;
}
