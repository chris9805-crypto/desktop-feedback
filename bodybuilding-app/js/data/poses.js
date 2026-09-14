/**
 * Two positions per movement pattern.
 *
 * A still picture of a lift can usefully show one thing: the two ends of the
 * rep. Not the tempo, not the bracing, not what it feels like - just "start
 * here, finish there", which is exactly what somebody who has never seen the
 * movement needs and exactly what the written cues cannot convey.
 *
 * Drawn from the app's own data rather than photographed, for the same reasons
 * the muscle maps are: no licensed source exists, anything fetched from the web
 * breaks the offline promise, and a stylised diagram that is obviously a
 * diagram reads as deliberate where a not-quite-right drawing of a person reads
 * as a mistake.
 *
 * Every figure is a side view in a 100 x 110 box, y downwards, facing right,
 * floor at y=100. Joints are absolute coordinates rather than angles: angles
 * are tidier to write and far harder to eyeball, and these were tuned by
 * looking at them.
 */

/** Standing, arms hanging. Every pose is this with parts moved. */
const STAND = {
  head: [50, 17], neck: [50, 26], shoulder: [50, 30],
  elbow: [50, 44], hand: [50, 58],
  hip: [50, 54], knee: [50, 76], ankle: [50, 97], toe: [60, 99],
  load: 'none', props: ['floor'],
};

const pose = (o) => ({ ...STAND, ...o });

/**
 * `load` is what is in the hands, drawn at the hand position:
 * 'bar' a loaded barbell end-on, 'dumbbell' a short one, 'handle' a cable
 * attachment with its line running off-frame, 'none' nothing.
 *
 * `props` are the furniture: 'floor', 'bench', 'incline', 'seat', 'pad'
 * (a leg-machine pad), 'highBar' (something to hang from), 'stack' (a cable
 * tower behind the figure).
 */
export const POSES = {
  horizontalPress: {
    bottom: pose({
      head: [28, 55], neck: [36, 55], shoulder: [39, 55], hip: [62, 57],
      elbow: [48, 66], hand: [39, 47], knee: [76, 62], ankle: [82, 92], toe: [90, 97],
      load: 'bar', props: ['floor', 'bench'],
    }),
    top: pose({
      head: [28, 55], neck: [36, 55], shoulder: [39, 55], hip: [62, 57],
      elbow: [39, 44], hand: [39, 30], knee: [76, 62], ankle: [82, 92], toe: [90, 97],
      load: 'bar', props: ['floor', 'bench'],
    }),
  },

  inclinePress: {
    bottom: pose({
      head: [30, 40], neck: [37, 45], shoulder: [40, 46], hip: [64, 64],
      elbow: [50, 56], hand: [42, 40], knee: [78, 70], ankle: [80, 94], toe: [88, 98],
      load: 'bar', props: ['floor', 'incline'],
    }),
    top: pose({
      head: [30, 40], neck: [37, 45], shoulder: [40, 46], hip: [64, 64],
      elbow: [42, 36], hand: [44, 22], knee: [78, 70], ankle: [80, 94], toe: [88, 98],
      load: 'bar', props: ['floor', 'incline'],
    }),
  },

  verticalPress: {
    bottom: pose({ elbow: [42, 42], hand: [46, 30], load: 'bar' }),
    top: pose({ elbow: [48, 18], hand: [48, 6], load: 'bar' }),
  },

  horizontalPull: {
    bottom: pose({
      head: [26, 44], neck: [34, 47], shoulder: [37, 48], hip: [62, 54],
      elbow: [37, 62], hand: [37, 76], knee: [60, 76], ankle: [58, 97], toe: [68, 99],
      load: 'bar', props: ['floor'],
    }),
    top: pose({
      head: [26, 44], neck: [34, 47], shoulder: [37, 48], hip: [62, 54],
      elbow: [46, 60], hand: [42, 54], knee: [60, 76], ankle: [58, 97], toe: [68, 99],
      load: 'bar', props: ['floor'],
    }),
  },

  verticalPull: {
    bottom: pose({
      head: [50, 34], neck: [50, 42], shoulder: [50, 45], hip: [50, 70],
      elbow: [50, 28], hand: [50, 12], knee: [54, 90], ankle: [52, 99], toe: [62, 99],
      load: 'none', props: ['highBar'],
    }),
    top: pose({
      head: [52, 19], neck: [51, 27], shoulder: [51, 30], hip: [50, 55],
      elbow: [38, 26], hand: [50, 12], knee: [60, 68], ankle: [66, 84], toe: [74, 86],
      load: 'none', props: ['highBar'],
    }),
  },

  squat: {
    bottom: pose({
      head: [40, 36], neck: [44, 45], shoulder: [45, 47], hip: [44, 72],
      elbow: [45, 50], hand: [46, 46], knee: [60, 76], ankle: [52, 97], toe: [62, 99],
      load: 'bar', props: ['floor'],
    }),
    top: pose({ elbow: [50, 33], hand: [50, 30], load: 'bar' }),
  },

  hinge: {
    bottom: pose({
      head: [28, 44], neck: [36, 47], shoulder: [39, 48], hip: [62, 55],
      elbow: [39, 62], hand: [39, 76], knee: [56, 76], ankle: [52, 97], toe: [62, 99],
      load: 'bar', props: ['floor'],
    }),
    top: pose({ hand: [50, 60], elbow: [50, 45], load: 'bar' }),
  },

  lunge: {
    bottom: pose({
      head: [46, 24], neck: [46, 33], shoulder: [46, 36], hip: [46, 60],
      elbow: [46, 48], hand: [46, 60],
      knee: [64, 74], ankle: [66, 97], toe: [76, 99],
      backKnee: [32, 92], backAnkle: [26, 97], backToe: [18, 97],
      load: 'dumbbell', props: ['floor'],
    }),
    top: pose({
      head: [48, 14], neck: [48, 23], shoulder: [48, 26], hip: [48, 50],
      elbow: [48, 39], hand: [48, 52],
      knee: [60, 72], ankle: [64, 97], toe: [74, 99],
      backKnee: [38, 74], backAnkle: [30, 97], backToe: [22, 97],
      load: 'dumbbell', props: ['floor'],
    }),
  },

  legExtension: {
    bottom: pose({
      head: [34, 30], neck: [38, 38], shoulder: [40, 41], hip: [42, 62],
      elbow: [44, 52], hand: [46, 62],
      knee: [66, 62], ankle: [70, 84], toe: [78, 88],
      load: 'none', props: ['floor', 'seat', 'pad'],
    }),
    top: pose({
      head: [34, 30], neck: [38, 38], shoulder: [40, 41], hip: [42, 62],
      elbow: [44, 52], hand: [46, 62],
      knee: [66, 62], ankle: [90, 58], toe: [96, 52],
      load: 'none', props: ['floor', 'seat', 'pad'],
    }),
  },

  legCurl: {
    bottom: pose({
      head: [34, 30], neck: [38, 38], shoulder: [40, 41], hip: [42, 62],
      elbow: [44, 52], hand: [46, 62],
      knee: [66, 62], ankle: [90, 60], toe: [96, 54],
      load: 'none', props: ['floor', 'seat', 'pad'],
    }),
    top: pose({
      head: [34, 30], neck: [38, 38], shoulder: [40, 41], hip: [42, 62],
      elbow: [44, 52], hand: [46, 62],
      knee: [66, 62], ankle: [72, 84], toe: [64, 88],
      load: 'none', props: ['floor', 'seat', 'pad'],
    }),
  },

  hipExtension: {
    bottom: pose({
      head: [20, 56], neck: [29, 58], shoulder: [32, 59], hip: [56, 84],
      elbow: [34, 66], hand: [46, 78],
      knee: [78, 74], ankle: [80, 97], toe: [90, 99],
      load: 'bar', props: ['floor', 'lowBench'],
    }),
    top: pose({
      head: [20, 56], neck: [29, 58], shoulder: [32, 59], hip: [58, 62],
      elbow: [34, 66], hand: [48, 58],
      knee: [80, 64], ankle: [80, 97], toe: [90, 99],
      load: 'bar', props: ['floor', 'lowBench'],
    }),
  },

  curl: {
    bottom: pose({ elbow: [50, 46], hand: [54, 60], load: 'bar' }),
    top: pose({ elbow: [50, 46], hand: [58, 34], load: 'bar' }),
  },

  tricepsExtension: {
    bottom: pose({ elbow: [50, 44], hand: [58, 34], load: 'handle', props: ['floor', 'stack'] }),
    top: pose({ elbow: [50, 44], hand: [54, 58], load: 'handle', props: ['floor', 'stack'] }),
  },

  shrug: {
    bottom: pose({
      head: [50, 15], neck: [50, 25], shoulder: [50, 33],
      elbow: [50, 48], hand: [50, 63], load: 'bar',
    }),
    top: pose({
      head: [50, 15], neck: [50, 25], shoulder: [50, 24],
      elbow: [50, 39], hand: [50, 54], load: 'bar',
    }),
  },

  wristCurl: {
    bottom: pose({
      head: [34, 30], neck: [38, 38], shoulder: [40, 41], hip: [42, 62],
      elbow: [46, 58], hand: [72, 58],
      knee: [64, 62], ankle: [66, 84], toe: [74, 88],
      load: 'dumbbell', props: ['floor', 'seat', 'lowBench'],
      wrist: [78, 66],
    }),
    top: pose({
      head: [34, 30], neck: [38, 38], shoulder: [40, 41], hip: [42, 62],
      elbow: [46, 58], hand: [72, 58],
      knee: [64, 62], ankle: [66, 84], toe: [74, 88],
      load: 'dumbbell', props: ['floor', 'seat', 'lowBench'],
      wrist: [78, 50],
    }),
  },

  raise: {
    bottom: pose({ elbow: [52, 44], hand: [54, 58], load: 'dumbbell' }),
    top: pose({ elbow: [64, 32], hand: [78, 30], load: 'dumbbell' }),
  },

  fly: {
    bottom: pose({
      head: [28, 55], neck: [36, 55], shoulder: [39, 55], hip: [62, 57],
      elbow: [32, 44], hand: [22, 36], farElbow: [48, 44], farHand: [58, 36],
      knee: [76, 62], ankle: [82, 92], toe: [90, 97],
      load: 'dumbbell', props: ['floor', 'bench'],
    }),
    top: pose({
      head: [28, 55], neck: [36, 55], shoulder: [39, 55], hip: [62, 57],
      elbow: [37, 43], hand: [36, 30], farElbow: [43, 43], farHand: [43, 30],
      knee: [76, 62], ankle: [82, 92], toe: [90, 97],
      load: 'dumbbell', props: ['floor', 'bench'],
    }),
  },

  reverseFly: {
    bottom: pose({
      head: [26, 44], neck: [34, 47], shoulder: [37, 48], hip: [62, 54],
      elbow: [37, 62], hand: [37, 76], knee: [60, 76], ankle: [58, 97], toe: [68, 99],
      load: 'dumbbell', props: ['floor'],
    }),
    top: pose({
      head: [26, 44], neck: [34, 47], shoulder: [37, 48], hip: [62, 54],
      elbow: [26, 56], hand: [16, 46], knee: [60, 76], ankle: [58, 97], toe: [68, 99],
      load: 'dumbbell', props: ['floor'],
    }),
  },

  calfRaise: {
    bottom: pose({
      head: [50, 25], neck: [50, 34], shoulder: [50, 38], hip: [50, 62],
      elbow: [50, 52], hand: [50, 66],
      knee: [50, 82], ankle: [50, 99], toe: [62, 92],
      load: 'none', props: ['floor', 'step'],
    }),
    top: pose({
      head: [50, 11], neck: [50, 20], shoulder: [50, 24], hip: [50, 48],
      elbow: [50, 38], hand: [50, 52],
      knee: [50, 68], ankle: [50, 84], toe: [62, 92],
      load: 'none', props: ['floor', 'step'],
    }),
  },

  crunch: {
    bottom: pose({
      head: [46, 28], neck: [47, 36], shoulder: [48, 39], hip: [50, 64],
      elbow: [46, 44], hand: [44, 34],
      knee: [66, 66], ankle: [68, 88], toe: [76, 92],
      load: 'handle', props: ['floor', 'stack', 'seat'],
    }),
    top: pose({
      head: [58, 44], neck: [55, 50], shoulder: [54, 52], hip: [50, 64],
      elbow: [50, 48], hand: [46, 40],
      knee: [66, 66], ankle: [68, 88], toe: [76, 92],
      load: 'handle', props: ['floor', 'stack', 'seat'],
    }),
  },

  deadlift: {
    bottom: pose({
      head: [30, 42], neck: [38, 46], shoulder: [41, 48], hip: [62, 62],
      elbow: [42, 62], hand: [44, 88], knee: [54, 78], ankle: [50, 97], toe: [60, 99],
      load: 'bar', props: ['floor'],
    }),
    top: pose({ hand: [50, 60], elbow: [50, 45], load: 'bar' }),
  },
};

export function posesFor(patternId) {
  return POSES[patternId] ?? null;
}
