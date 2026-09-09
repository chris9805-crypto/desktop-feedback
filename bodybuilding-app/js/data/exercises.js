/**
 * Exercise library.
 *
 * Each entry carries the information the progression engine needs to make a
 * decision without asking you: which muscles the set should be charged to,
 * what rep range the movement is actually good at, and how big the smallest
 * useful jump in load is.
 *
 *   type      'compound' | 'isolation' - drives default rest and rep ranges
 *   primary   muscles credited a full set
 *   secondary muscles credited a half set (fractional volume counting)
 *   reps      [min, max] - the double-progression window
 *   inc       smallest sane load jump in kg (converted for lb users)
 *   stability how tolerant the movement is of grinding near failure:
 *             'high' machines/cables - can be taken to 0 RIR safely
 *             'med'  dumbbell / supported free weight
 *             'low'  heavy axial compounds - stop short, RIR floor applies
 *   subs      swap-ins that train the same thing when equipment is taken
 */

const ex = (id, name, o) => ({
  id, name,
  type: o.type ?? 'isolation',
  primary: o.primary ?? [],
  secondary: o.secondary ?? [],
  equipment: o.equipment ?? 'barbell',
  reps: o.reps ?? (o.type === 'compound' ? [6, 10] : [10, 15]),
  inc: o.inc ?? (o.type === 'compound' ? 2.5 : 1.25),
  stability: o.stability ?? 'med',
  unilateral: o.unilateral ?? false,
  cues: o.cues ?? [],
  subs: o.subs ?? [],
});

export const EXERCISES = [
  // ---------------------------------------------------------------- chest
  ex('bb-bench', 'Barbell bench press', {
    type: 'compound', equipment: 'barbell', stability: 'low',
    primary: ['chest'], secondary: ['triceps', 'frontDelts'], reps: [5, 8], inc: 2.5,
    cues: ['Shoulder blades pinned down and back before the bar leaves the rack',
           'Touch at the base of the sternum, elbows ~45-60 degrees from the torso',
           'Drive the bar back over the shoulder joint, not straight up'],
    subs: ['db-bench', 'smith-bench', 'machine-press'],
  }),
  ex('smith-bench', 'Smith machine bench press', {
    type: 'compound', equipment: 'machine', stability: 'high',
    primary: ['chest'], secondary: ['triceps', 'frontDelts'], reps: [6, 10], inc: 2.5,
    cues: ['Fixed bar path lets you push closer to failure without a spotter'],
    subs: ['bb-bench', 'machine-press'],
  }),
  ex('incline-bb-bench', 'Incline barbell press', {
    type: 'compound', equipment: 'barbell', stability: 'low',
    primary: ['chest'], secondary: ['frontDelts', 'triceps'], reps: [6, 10], inc: 2.5,
    cues: ['30-45 degrees; steeper turns it into a shoulder press',
           'Keep the bar path over the clavicles at the top'],
    subs: ['incline-db-press', 'machine-incline'],
  }),
  ex('db-bench', 'Flat dumbbell press', {
    type: 'compound', equipment: 'dumbbell',
    primary: ['chest'], secondary: ['triceps', 'frontDelts'], reps: [8, 12], inc: 2,
    cues: ['Let the dumbbells travel slightly inward at the top without clanking',
           'Stretch under control - the bottom is where the growth stimulus is'],
    subs: ['bb-bench', 'machine-press'],
  }),
  ex('incline-db-press', 'Incline dumbbell press', {
    type: 'compound', equipment: 'dumbbell',
    primary: ['chest'], secondary: ['frontDelts', 'triceps'], reps: [8, 12], inc: 2,
    cues: ['Elbows under the wrists throughout', 'Full stretch, no bouncing off the chest'],
    subs: ['incline-bb-bench', 'machine-incline'],
  }),
  ex('machine-press', 'Chest press machine', {
    type: 'compound', equipment: 'machine', stability: 'high',
    primary: ['chest'], secondary: ['triceps', 'frontDelts'], reps: [8, 12], inc: 2.5,
    cues: ['Seat height so the handles line up with the lower chest',
           'Safe to take to 0 RIR - no bailout required'],
    subs: ['db-bench', 'bb-bench'],
  }),
  ex('machine-incline', 'Incline machine press', {
    type: 'compound', equipment: 'machine', stability: 'high',
    primary: ['chest'], secondary: ['frontDelts', 'triceps'], reps: [8, 12], inc: 2.5,
    subs: ['incline-db-press'],
  }),
  ex('cable-fly', 'Cable fly', {
    equipment: 'cable', stability: 'high',
    primary: ['chest'], reps: [12, 15], inc: 2.5,
    cues: ['Soft, fixed elbow angle - it is a fly, not a press',
           'Cross slightly past the midline for the full shortened contraction'],
    subs: ['pec-deck', 'db-fly'],
  }),
  ex('pec-deck', 'Pec deck', {
    equipment: 'machine', stability: 'high',
    primary: ['chest'], reps: [12, 15], inc: 2.5, subs: ['cable-fly'],
  }),
  ex('db-fly', 'Dumbbell fly', {
    equipment: 'dumbbell', primary: ['chest'], reps: [12, 15], inc: 1.5, subs: ['cable-fly'],
  }),
  ex('dips', 'Weighted chest dip', {
    type: 'compound', equipment: 'bodyweight',
    primary: ['chest'], secondary: ['triceps', 'frontDelts'], reps: [6, 10], inc: 2.5,
    cues: ['Lean the torso forward ~30 degrees to bias the chest',
           'Stop when the upper arm is just past parallel'],
    subs: ['db-bench'],
  }),

  // ----------------------------------------------------------------- back
  ex('pullup', 'Weighted pull-up', {
    type: 'compound', equipment: 'bodyweight',
    primary: ['lats'], secondary: ['biceps', 'upperBack', 'forearms'], reps: [5, 9], inc: 2.5,
    cues: ['Start from a full hang with the shoulder blades relaxed, then depress',
           'Drive the elbows down and back toward the hips'],
    subs: ['lat-pulldown', 'assisted-pullup'],
  }),
  ex('lat-pulldown', 'Lat pulldown', {
    type: 'compound', equipment: 'machine', stability: 'high',
    primary: ['lats'], secondary: ['biceps', 'upperBack'], reps: [8, 12], inc: 2.5,
    cues: ['Lean back no more than 15 degrees and hold it - a rowing motion is a different exercise',
           'Pull to the collarbone, pause for a beat'],
    subs: ['pullup'],
  }),
  ex('assisted-pullup', 'Assisted pull-up', {
    type: 'compound', equipment: 'machine', stability: 'high',
    primary: ['lats'], secondary: ['biceps', 'upperBack'], reps: [8, 12], inc: 2.5,
    subs: ['lat-pulldown'],
  }),
  ex('bb-row', 'Barbell row', {
    type: 'compound', equipment: 'barbell', stability: 'low',
    primary: ['upperBack', 'lats'], secondary: ['rearDelts', 'biceps', 'lowerBack', 'traps'], reps: [6, 10], inc: 2.5,
    cues: ['Torso ~45 degrees and frozen there - if the torso rises, the set is over',
           'Pull to the lower ribcage'],
    subs: ['chest-supported-row', 'db-row'],
  }),
  ex('chest-supported-row', 'Chest-supported row', {
    type: 'compound', equipment: 'machine', stability: 'high',
    primary: ['upperBack'], secondary: ['lats', 'rearDelts', 'biceps', 'traps'], reps: [8, 12], inc: 2.5,
    cues: ['The pad removes the lower back from the equation - push effort accordingly',
           'Squeeze the shoulder blades at the end range'],
    subs: ['bb-row', 'cable-row'],
  }),
  ex('cable-row', 'Seated cable row', {
    type: 'compound', equipment: 'cable', stability: 'high',
    primary: ['upperBack', 'lats'], secondary: ['biceps', 'rearDelts', 'traps'], reps: [8, 12], inc: 2.5,
    subs: ['chest-supported-row'],
  }),
  ex('db-row', 'Single-arm dumbbell row', {
    type: 'compound', equipment: 'dumbbell', unilateral: true,
    primary: ['lats', 'upperBack'], secondary: ['biceps', 'rearDelts'], reps: [8, 12], inc: 2,
    cues: ['Let the shoulder blade travel - protraction at the bottom, retraction at the top'],
    subs: ['cable-row', 'chest-supported-row'],
  }),
  ex('pullover', 'Cable / machine pullover', {
    equipment: 'cable', stability: 'high',
    primary: ['lats'], reps: [10, 15], inc: 2.5,
    cues: ['Elbows locked at a fixed angle; the movement happens at the shoulder'],
    subs: ['lat-pulldown'],
  }),
  ex('deadlift', 'Conventional deadlift', {
    type: 'compound', equipment: 'barbell', stability: 'low',
    primary: ['hamstrings', 'glutes', 'lowerBack'], secondary: ['upperBack', 'traps', 'quads', 'forearms'],
    reps: [3, 6], inc: 5,
    cues: ['Take the slack out of the bar before you pull',
           'Hips and shoulders rise together',
           'Expensive to recover from - keep 1-2 RIR even in peak weeks'],
    subs: ['rdl', 'trap-bar-dl'],
  }),
  ex('trap-bar-dl', 'Trap bar deadlift', {
    type: 'compound', equipment: 'barbell', stability: 'low',
    primary: ['quads', 'glutes'], secondary: ['hamstrings', 'lowerBack', 'traps'], reps: [5, 8], inc: 5,
    subs: ['deadlift'],
  }),
  ex('shrug', 'Dumbbell shrug', {
    equipment: 'dumbbell', primary: ['traps'], reps: [10, 15], inc: 2,
    cues: ['Straight up, no rolling; pause a full second at the top'],
    subs: [],
  }),

  // --------------------------------------------------------------- delts
  ex('ohp', 'Standing overhead press', {
    type: 'compound', equipment: 'barbell', stability: 'low',
    primary: ['frontDelts'], secondary: ['triceps', 'sideDelts'], reps: [5, 8], inc: 2.5,
    cues: ['Squeeze the glutes to stop the ribcage flaring',
           'Move the head back, then push it through as the bar passes the forehead'],
    subs: ['db-shoulder-press', 'machine-shoulder-press'],
  }),
  ex('db-shoulder-press', 'Seated dumbbell press', {
    type: 'compound', equipment: 'dumbbell',
    primary: ['frontDelts'], secondary: ['triceps', 'sideDelts'], reps: [8, 12], inc: 2,
    subs: ['ohp', 'machine-shoulder-press'],
  }),
  ex('machine-shoulder-press', 'Machine shoulder press', {
    type: 'compound', equipment: 'machine', stability: 'high',
    primary: ['frontDelts'], secondary: ['triceps'], reps: [8, 12], inc: 2.5,
    subs: ['db-shoulder-press'],
  }),
  ex('lateral-raise', 'Dumbbell lateral raise', {
    equipment: 'dumbbell', primary: ['sideDelts'], reps: [12, 20], inc: 1,
    cues: ['Lead with the elbow, wrist below elbow height',
           'Side delts recover fast - this is a high-frequency, high-volume muscle',
           'Stop the momentum: if the torso swings, drop the weight'],
    subs: ['cable-lateral', 'machine-lateral'],
  }),
  ex('cable-lateral', 'Cable lateral raise', {
    equipment: 'cable', stability: 'high', unilateral: true,
    primary: ['sideDelts'], reps: [12, 20], inc: 1.25,
    cues: ['Cable keeps tension at the bottom where dumbbells lose it'],
    subs: ['lateral-raise'],
  }),
  ex('machine-lateral', 'Machine lateral raise', {
    equipment: 'machine', stability: 'high', primary: ['sideDelts'], reps: [12, 20], inc: 2.5,
    subs: ['lateral-raise'],
  }),
  ex('rear-delt-fly', 'Reverse pec deck', {
    equipment: 'machine', stability: 'high',
    primary: ['rearDelts'], secondary: ['upperBack'], reps: [12, 20], inc: 2.5,
    cues: ['Think about pulling the hands apart, not back'],
    subs: ['cable-rear-delt', 'face-pull'],
  }),
  ex('cable-rear-delt', 'Cable rear delt fly', {
    equipment: 'cable', stability: 'high', primary: ['rearDelts'], secondary: ['upperBack'],
    reps: [12, 20], inc: 1.25, subs: ['rear-delt-fly'],
  }),
  ex('face-pull', 'Face pull', {
    equipment: 'cable', stability: 'high',
    primary: ['rearDelts'], secondary: ['upperBack', 'traps'], reps: [12, 20], inc: 2.5,
    cues: ['Pull to the eyebrows and externally rotate at the end'],
    subs: ['rear-delt-fly'],
  }),

  // --------------------------------------------------------------- arms
  ex('close-grip-bench', 'Close-grip bench press', {
    type: 'compound', equipment: 'barbell', stability: 'low',
    primary: ['triceps'], secondary: ['chest', 'frontDelts'], reps: [6, 10], inc: 2.5,
    cues: ['Grip just inside shoulder width - narrower wrecks wrists, not triceps'],
    subs: ['dips', 'skullcrusher'],
  }),
  ex('skullcrusher', 'EZ-bar skullcrusher', {
    equipment: 'barbell', primary: ['triceps'], reps: [10, 14], inc: 1.25,
    cues: ['Lower behind the head, not to the forehead - keeps the long head loaded'],
    subs: ['overhead-ext', 'pushdown'],
  }),
  ex('overhead-ext', 'Overhead cable extension', {
    equipment: 'cable', stability: 'high', primary: ['triceps'], reps: [10, 15], inc: 1.25,
    cues: ['The long head only gets a real stretch overhead - do not skip this pattern'],
    subs: ['skullcrusher'],
  }),
  ex('pushdown', 'Cable pushdown', {
    equipment: 'cable', stability: 'high', primary: ['triceps'], reps: [12, 15], inc: 1.25,
    subs: ['overhead-ext'],
  }),
  ex('bb-curl', 'Barbell curl', {
    equipment: 'barbell', primary: ['biceps'], secondary: ['forearms'], reps: [8, 12], inc: 1.25,
    cues: ['Elbows pinned to the ribs; if they drift forward the set is done'],
    subs: ['db-curl', 'cable-curl'],
  }),
  ex('incline-db-curl', 'Incline dumbbell curl', {
    equipment: 'dumbbell', primary: ['biceps'], reps: [10, 14], inc: 1,
    cues: ['Arm behind the torso puts the long head on stretch - the point of the exercise'],
    subs: ['db-curl'],
  }),
  ex('db-curl', 'Dumbbell curl', {
    equipment: 'dumbbell', primary: ['biceps'], secondary: ['forearms'], reps: [10, 14], inc: 1,
    subs: ['bb-curl', 'cable-curl'],
  }),
  ex('hammer-curl', 'Hammer curl', {
    equipment: 'dumbbell', primary: ['biceps', 'forearms'], reps: [10, 14], inc: 1,
    cues: ['Trains brachialis and brachioradialis - adds width to the arm from the side'],
    subs: ['db-curl'],
  }),
  ex('cable-curl', 'Cable curl', {
    equipment: 'cable', stability: 'high', primary: ['biceps'], reps: [10, 15], inc: 1.25,
    subs: ['bb-curl'],
  }),
  ex('preacher-curl', 'Preacher curl', {
    equipment: 'machine', stability: 'high', primary: ['biceps'], reps: [10, 14], inc: 1.25,
    subs: ['incline-db-curl'],
  }),
  ex('wrist-curl', 'Wrist curl', {
    equipment: 'dumbbell', primary: ['forearms'], reps: [15, 20], inc: 1, subs: [],
  }),

  // --------------------------------------------------------------- legs
  ex('back-squat', 'Back squat', {
    type: 'compound', equipment: 'barbell', stability: 'low',
    primary: ['quads'], secondary: ['glutes', 'hamstrings', 'lowerBack'], reps: [5, 8], inc: 5,
    cues: ['Brace against the belt line before you unrack, not after',
           'Break at the hips and knees together; knees travel over the toes',
           'Depth to at least parallel or the quad stimulus drops sharply'],
    subs: ['hack-squat', 'front-squat', 'leg-press'],
  }),
  ex('front-squat', 'Front squat', {
    type: 'compound', equipment: 'barbell', stability: 'low',
    primary: ['quads'], secondary: ['glutes', 'upperBack'], reps: [5, 8], inc: 2.5,
    subs: ['back-squat', 'hack-squat'],
  }),
  ex('hack-squat', 'Hack squat', {
    type: 'compound', equipment: 'machine', stability: 'high',
    primary: ['quads'], secondary: ['glutes'], reps: [8, 12], inc: 5,
    cues: ['Fixed path means you can push far closer to failure than a back squat'],
    subs: ['leg-press', 'back-squat'],
  }),
  ex('leg-press', 'Leg press', {
    type: 'compound', equipment: 'machine', stability: 'high',
    primary: ['quads'], secondary: ['glutes', 'hamstrings'], reps: [10, 15], inc: 5,
    cues: ['Do not let the lower back round off the pad at the bottom'],
    subs: ['hack-squat'],
  }),
  ex('bulgarian-split-squat', 'Bulgarian split squat', {
    type: 'compound', equipment: 'dumbbell', unilateral: true,
    primary: ['quads', 'glutes'], secondary: ['hamstrings'], reps: [8, 12], inc: 2,
    cues: ['Long stride biases glutes; short stride biases quads - pick one and keep it'],
    subs: ['walking-lunge', 'leg-press'],
  }),
  ex('walking-lunge', 'Walking lunge', {
    type: 'compound', equipment: 'dumbbell', unilateral: true,
    primary: ['quads', 'glutes'], secondary: ['hamstrings'], reps: [10, 14], inc: 2,
    subs: ['bulgarian-split-squat'],
  }),
  ex('rdl', 'Romanian deadlift', {
    type: 'compound', equipment: 'barbell', stability: 'low',
    primary: ['hamstrings'], secondary: ['glutes', 'lowerBack'], reps: [6, 10], inc: 2.5,
    cues: ['Push the hips back, shins vertical, bar dragging the thighs',
           'Stop where the hamstring stretch ends - not where the floor is'],
    subs: ['db-rdl', 'good-morning'],
  }),
  ex('db-rdl', 'Dumbbell RDL', {
    type: 'compound', equipment: 'dumbbell',
    primary: ['hamstrings'], secondary: ['glutes'], reps: [8, 12], inc: 2, subs: ['rdl'],
  }),
  ex('good-morning', 'Good morning', {
    type: 'compound', equipment: 'barbell', stability: 'low',
    primary: ['hamstrings'], secondary: ['lowerBack', 'glutes'], reps: [8, 12], inc: 2.5, subs: ['rdl'],
  }),
  ex('lying-leg-curl', 'Lying leg curl', {
    equipment: 'machine', stability: 'high', primary: ['hamstrings'], reps: [10, 15], inc: 2.5,
    cues: ['Hips down on the pad; let them rise and the glutes take over'],
    subs: ['seated-leg-curl', 'nordic-curl'],
  }),
  ex('seated-leg-curl', 'Seated leg curl', {
    equipment: 'machine', stability: 'high', primary: ['hamstrings'], reps: [10, 15], inc: 2.5,
    cues: ['Hip flexed position puts the hamstring on stretch - slightly better growth data than lying'],
    subs: ['lying-leg-curl'],
  }),
  ex('nordic-curl', 'Nordic ham curl', {
    equipment: 'bodyweight', primary: ['hamstrings'], reps: [5, 10], inc: 2.5, subs: ['lying-leg-curl'],
  }),
  ex('leg-extension', 'Leg extension', {
    equipment: 'machine', stability: 'high', primary: ['quads'], reps: [12, 15], inc: 2.5,
    cues: ['Pause at full extension for a count - the shortened position is where this earns its place'],
    subs: ['hack-squat'],
  }),
  ex('hip-thrust', 'Barbell hip thrust', {
    type: 'compound', equipment: 'barbell', stability: 'high',
    primary: ['glutes'], secondary: ['hamstrings'], reps: [8, 12], inc: 5,
    cues: ['Chin tucked, ribs down; finish with a hard squeeze at lockout'],
    subs: ['glute-kickback'],
  }),
  ex('glute-kickback', 'Cable glute kickback', {
    equipment: 'cable', stability: 'high', unilateral: true,
    primary: ['glutes'], reps: [12, 15], inc: 1.25, subs: ['hip-thrust'],
  }),
  ex('standing-calf', 'Standing calf raise', {
    equipment: 'machine', stability: 'high', primary: ['calves'], reps: [8, 12], inc: 2.5,
    cues: ['Two seconds in the stretched bottom position, no bouncing off the achilles'],
    subs: ['seated-calf'],
  }),
  ex('seated-calf', 'Seated calf raise', {
    equipment: 'machine', stability: 'high', primary: ['calves'], reps: [12, 20], inc: 2.5,
    cues: ['Bent knee biases the soleus - complements the standing version'],
    subs: ['standing-calf'],
  }),

  // ---------------------------------------------------------------- core
  ex('cable-crunch', 'Cable crunch', {
    equipment: 'cable', stability: 'high', primary: ['abs'], reps: [12, 15], inc: 2.5,
    cues: ['Flex the spine - hips stay put, this is not a hip hinge'],
    subs: ['weighted-decline-crunch'],
  }),
  ex('weighted-decline-crunch', 'Weighted decline crunch', {
    equipment: 'bodyweight', primary: ['abs'], reps: [10, 15], inc: 2.5, subs: ['cable-crunch'],
  }),
  ex('hanging-leg-raise', 'Hanging leg raise', {
    equipment: 'bodyweight', primary: ['abs'], secondary: ['forearms'], reps: [8, 15], inc: 2.5,
    cues: ['Posteriorly tilt the pelvis at the top or it is just a hip flexor exercise'],
    subs: ['cable-crunch'],
  }),
  ex('back-extension', 'Weighted back extension', {
    equipment: 'bodyweight', primary: ['lowerBack'], secondary: ['glutes', 'hamstrings'],
    reps: [10, 15], inc: 2.5, subs: [],
  }),
];

export const EXERCISE_BY_ID = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));

export function getExercise(id) {
  return EXERCISE_BY_ID[id];
}

/** Every muscle an exercise touches, with its volume weighting. */
export function volumeContribution(exercise) {
  const out = {};
  for (const m of exercise.primary) out[m] = (out[m] ?? 0) + 1;
  for (const m of exercise.secondary) out[m] = (out[m] ?? 0) + 0.5;
  return out;
}
