/**
 * The muscle map.
 *
 * Photographs of someone performing a lift would be better than any drawing,
 * but there is no honest way to ship them here: no licensed source, and
 * anything fetched from the web would break the offline promise and put a
 * third party in the middle of your training log.
 *
 * A diagram generated from the app's own data is the thing that can be done
 * properly, and it answers a question a photo does not: not "what does this
 * look like" but "what does this actually train, and how much". Because it
 * reads the same `primary` / `secondary` arrays the volume engine counts, it
 * cannot drift out of date - add an exercise and its map is correct
 * immediately, with no artwork to commission.
 *
 * Drawn deliberately as a flat anatomical diagram rather than an attempt at
 * realism. A stylised shape that is clearly a diagram reads as intentional;
 * a not-quite-right drawing of a human body reads as a mistake.
 */

import { svg, h } from './dom.js';
import { getExercise, volumeContribution } from '../data/exercises.js';
import { muscleName } from '../data/muscles.js';

/**
 * The figure is assembled from separated geometric parts - head, torso,
 * pelvis, upper arms, forearms, thighs, shins - with visible gaps between
 * them. An attempt at a continuous human silhouette looks slightly wrong at
 * this size and reads as a bad drawing; clearly separated blocks read as a
 * deliberate diagram, which is what this is.
 *
 * Everything is laid out in a 120 x 250 box per view. Muscle shapes are
 * positioned to sit inside the body part they belong to.
 */
const r = (x, y, w, h, rx = 4) => ({ x, y, w, h, rx });

const BODY = [
  r(48, 6, 24, 26, 11),     // head
  r(54, 30, 12, 8, 3),      // neck
  r(40, 37, 40, 64, 9),     // torso
  r(43, 104, 34, 20, 7),    // pelvis
  r(23, 43, 14, 36, 6), r(83, 43, 14, 36, 6),      // upper arms
  r(24, 82, 12, 32, 5), r(84, 82, 12, 32, 5),      // forearms
  r(43, 127, 16, 44, 7), r(61, 127, 16, 44, 7),    // thighs
  r(45, 174, 13, 40, 5), r(62, 174, 13, 40, 5),    // shins
];

const FRONT = {
  traps: [r(43, 38, 34, 9, 4)],
  frontDelts: [r(24, 44, 12, 13, 5), r(84, 44, 12, 13, 5)],
  sideDelts: [r(21, 46, 6, 15, 3), r(93, 46, 6, 15, 3)],
  chest: [r(43, 49, 16, 21, 5), r(61, 49, 16, 21, 5)],
  abs: [r(50, 73, 20, 27, 5)],
  biceps: [r(25, 58, 10, 20, 4), r(85, 58, 10, 20, 4)],
  forearms: [r(26, 85, 8, 26, 4), r(86, 85, 8, 26, 4)],
  quads: [r(45, 130, 12, 38, 5), r(63, 130, 12, 38, 5)],
  calves: [r(47, 178, 9, 30, 4), r(64, 178, 9, 30, 4)],
};

const BACK = {
  traps: [r(45, 38, 30, 20, 5)],
  rearDelts: [r(23, 44, 13, 13, 5), r(84, 44, 13, 13, 5)],
  upperBack: [r(43, 60, 34, 16, 4)],
  lats: [r(41, 62, 11, 32, 5), r(68, 62, 11, 32, 5)],
  triceps: [r(25, 56, 10, 22, 4), r(85, 56, 10, 22, 4)],
  forearms: [r(26, 85, 8, 26, 4), r(86, 85, 8, 26, 4)],
  lowerBack: [r(52, 84, 16, 16, 4)],
  glutes: [r(45, 106, 15, 16, 6), r(60, 106, 15, 16, 6)],
  hamstrings: [r(45, 130, 12, 38, 5), r(63, 130, 12, 38, 5)],
  calves: [r(47, 178, 9, 30, 4), r(64, 178, 9, 30, 4)],
};

/**
 * @param {string} exerciseId
 * @param {object} [options]
 * @param {number} [options.height]  rendered height in px
 * @param {boolean} [options.legend] show which muscles are lit and how much
 */
export function muscleMap(exerciseId, { height = 150, legend = false } = {}) {
  const exercise = getExercise(exerciseId);
  if (!exercise) return h('div', {});
  const contribution = volumeContribution(exercise);

  const wrap = h('div', { class: 'musclemap' });
  const figure = svg('svg', {
    viewBox: '0 0 250 250',
    class: 'musclemap-svg',
    style: `height:${height}px`,
    role: 'img',
    'aria-label': `${exercise.name} trains ${exercise.primary.map(muscleName).join(' and ')}`
      + (exercise.secondary.length ? `, with help from ${exercise.secondary.map(muscleName).join(' and ')}` : ''),
  });

  const box = (shape, cls) => svg('rect', {
    x: shape.x, y: shape.y, width: shape.w, height: shape.h,
    rx: shape.rx, ry: shape.rx, class: cls,
  });

  for (const [view, shapes, offset] of [['front', FRONT, 0], ['back', BACK, 130]]) {
    const group = svg('g', { transform: `translate(${offset} 0)` });
    for (const part of BODY) group.appendChild(box(part, 'mm-body'));
    for (const [muscle, parts] of Object.entries(shapes)) {
      const weight = contribution[muscle] ?? 0;
      // Full set vs half set is the same distinction the volume engine makes,
      // so the picture and the numbers can never disagree.
      const cls = weight >= 1 ? 'mm-primary' : weight > 0 ? 'mm-secondary' : 'mm-idle';
      for (const part of parts) {
        const rect = box(part, `mm-muscle ${cls}`);
        if (weight > 0) {
          rect.appendChild(svg('title', {},
            `${muscleName(muscle)} - ${weight >= 1 ? 'main mover' : 'assisting'}`));
        }
        group.appendChild(rect);
      }
    }
    group.appendChild(svg('text', { x: 60, y: 244, class: 'mm-label', 'text-anchor': 'middle' },
      view === 'front' ? 'Front' : 'Back'));
    figure.appendChild(group);
  }

  wrap.append(figure);

  if (legend) {
    wrap.append(h('div', { class: 'mm-legend' },
      ...exercise.primary.map((m) => h('span', { class: 'mm-key primary' }, muscleName(m))),
      ...exercise.secondary.map((m) => h('span', { class: 'mm-key secondary' }, muscleName(m), ' ½')),
    ));
  }
  return wrap;
}

/** Which muscles this library can actually draw, for the coverage test. */
export const DRAWN_MUSCLES = new Set([...Object.keys(FRONT), ...Object.keys(BACK)]);
