/**
 * Muscle groups and weekly volume landmarks.
 *
 * Landmarks are *heuristics*, not laws. They come from the volume-landmark
 * framework popularised by Renaissance Periodization and are expressed in
 * "hard sets per week taken within ~0-4 reps of failure":
 *
 *   MV  - maintenance volume: enough to hold what you have
 *   MEV - minimum effective volume: the least that reliably grows the muscle
 *   MAV - maximum adaptive volume: the productive middle where most work lives
 *   MRV - maximum recoverable volume: past this you accumulate fatigue, not size
 *
 * Individual tolerance varies a lot. Treat these as a starting frame and let
 * the session feedback loop (see engine/progression.js) move your own numbers.
 *
 * One calibration note: published landmarks count *direct* sets, whereas this
 * app also credits assisting muscles half a set (see volume.js). Counting a
 * heavy row as half a set of biceps is more honest than pretending it is zero,
 * but it inflates totals against the published figures - so the numbers below
 * are shifted up to match how they are measured here. Compare them to this
 * app's own volume report, not to a table you read elsewhere.
 */

export const MUSCLES = {
  chest:      { name: 'Chest',        region: 'push', mv: 6,  mev: 10, mav: 20, mrv: 24 },
  frontDelts: { name: 'Front delts',  region: 'push', mv: 0,  mev: 0,  mav: 12, mrv: 16 },
  sideDelts:  { name: 'Side delts',   region: 'push', mv: 6,  mev: 8,  mav: 22, mrv: 26 },
  rearDelts:  { name: 'Rear delts',   region: 'pull', mv: 0,  mev: 6,  mav: 18, mrv: 24 },
  triceps:    { name: 'Triceps',      region: 'push', mv: 4,  mev: 8,  mav: 18, mrv: 24 },
  lats:       { name: 'Lats',         region: 'pull', mv: 6,  mev: 10, mav: 20, mrv: 26 },
  upperBack:  { name: 'Upper back',   region: 'pull', mv: 6,  mev: 10, mav: 22, mrv: 26 },
  traps:      { name: 'Traps',        region: 'pull', mv: 0,  mev: 4,  mav: 14, mrv: 20 },
  biceps:     { name: 'Biceps',       region: 'pull', mv: 4,  mev: 8,  mav: 18, mrv: 24 },
  forearms:   { name: 'Forearms',     region: 'pull', mv: 0,  mev: 4,  mav: 12, mrv: 20 },
  quads:      { name: 'Quads',        region: 'legs', mv: 6,  mev: 8,  mav: 18, mrv: 24 },
  hamstrings: { name: 'Hamstrings',   region: 'legs', mv: 4,  mev: 6,  mav: 16, mrv: 20 },
  glutes:     { name: 'Glutes',       region: 'legs', mv: 0,  mev: 4,  mav: 14, mrv: 18 },
  calves:     { name: 'Calves',       region: 'legs', mv: 6,  mev: 8,  mav: 16, mrv: 20 },
  abs:        { name: 'Abs',          region: 'core', mv: 0,  mev: 4,  mav: 16, mrv: 25 },
  lowerBack:  { name: 'Lower back',   region: 'core', mv: 0,  mev: 4,  mav: 12, mrv: 16 },
};

export const MUSCLE_IDS = Object.keys(MUSCLES);

/** Ordered for display: the groups people actually program around come first. */
export const MUSCLE_DISPLAY_ORDER = [
  'chest', 'lats', 'upperBack', 'sideDelts', 'rearDelts', 'frontDelts',
  'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves',
  'traps', 'forearms', 'abs', 'lowerBack',
];

export function muscleName(id) {
  return MUSCLES[id]?.name ?? id;
}
