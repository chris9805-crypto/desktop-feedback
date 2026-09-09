# IronBlock

A training app for people who are serious about bodybuilding. It runs your
training as **mesocycles** — four weeks where volume and effort climb on
purpose, then a deload — and calculates every load it puts in front of you from
what you actually lifted last week and how hard it felt.

No account, no server, no subscription. Everything lives in your browser.

```bash
npm start           # http://localhost:8080
npm test            # 72 tests, no dependencies
npm run bundle      # dist/ironblock.html — the whole app in one file
```

There is no build step. The app is ES modules loaded straight from source; the
bundle is only there so it can be handed to someone as a single file.

---

## The three things it is trying to be

**Intentional.** Nothing is left to how you feel on the day. Every set has a
prescribed load, a rep target and an RIR target before you touch the bar — and
the reasoning behind it, in plain English, sitting next to the number:

> *8 reps at 2 RIR topped out the 5–8 window. Load goes up 2.5kg and reps reset
> to 5 — that is double progression doing its job.*

If you don't understand where a number came from, you will stop trusting it by
week three. So it always says.

**Efficient.** Volume is capped at what you can recover from rather than at what
you can survive. Supersets are built into the templates where the muscles don't
compete. Session length is *computed from your actual plan* — rest periods and
all — instead of being an advertised guess, so you know a peak-week Upper A is
100 minutes before you commit five weeks to it.

**Progressive.** Load, reps, weekly sets and weekly effort all move, each by its
own rule, each driven by data you logged rather than a number written into a
spreadsheet a year ago.

---

## How progression actually works

### Load and reps: double progression

You work inside a rep window (say 5–8). Reps climb week to week. Only when you
fill the window does load go up and reps reset to the bottom. This kills the two
classic failure modes — adding weight faster than you can hold form, and doing
the same three sets of ten for a year.

### Effort: RIR autoregulation

**RIR** (Reps In Reserve) is how many more you could have done. It is the input
that makes the rest of the system work, so log it honestly.

| What you logged | What happens next week |
|---|---|
| Filled the rep window | Load up, reps reset to the bottom |
| On target, room left in the window | Same load, one more rep |
| Left 2+ more in reserve than planned | Load corrected in **one** jump, not four |
| Went closer to failure than planned | Hold — you are ahead of the curve already |
| Missed the bottom of the window | Load backs off ~6% |

Planned effort tightens across the block — typically 3 RIR in week one down to
0 by week four. Heavy axial lifts (squat, deadlift, overhead press) are floored
at 1 RIR no matter what the week says: grinding a max single on a barbell squat
is not a hypertrophy stimulus, it is a spotter's problem.

### Volume: feedback-driven, capped at MRV

After each session you rate soreness, pump and joint feel for the muscles that
did real work. That sets next week's volume:

| Report | Next week |
|---|---|
| No soreness, no pump | +2 sets — the dose didn't register |
| Recovered well, good pump | +1 set |
| Still sore going in | Hold |
| Sore into the next session, or joint pain | −1 set |
| Sharp joint pain | −2 sets and swap the movement |

Joint pain always reduces volume, whatever else you reported.

Sets are added at the *muscle* level and handed out to the exercises that train
it — and because one set of rows is a set for the lats *and* the upper back
*and* half a set for the biceps, the engine re-measures after every single set
it adds. That is what stops a five-week block quietly growing into two-hour
sessions.

Everything is then clamped to each muscle's **MRV** — the point past which you
accumulate fatigue instead of muscle.

### Volume landmarks

- **MEV** — minimum effective volume: the least that reliably grows a muscle
- **MAV** — maximum adaptive volume: the productive middle
- **MRV** — maximum recoverable volume: the ceiling

Sets are counted **fractionally**: a full set for muscles doing the work, half
for muscles assisting. Sets left more than 4 reps from failure aren't counted at
all — that's a rehearsal, not a stimulus.

Because this counts indirect work that published landmark tables don't, the
numbers here are shifted up to match. Compare them to this app's own volume
report, not to a table you read elsewhere. They are population heuristics
regardless; after a couple of blocks your own data beats all of them.

### Estimated 1RM

RIR-adjusted Epley: a set of 8 with 2 in reserve is treated as a 10-rep effort.
Trustworthy to about 12 reps to failure; past that the app marks the estimate
low-confidence rather than quoting it to the kilo.

---

## The programs

Five templates, each a five-week block. Session and weekly times are computed
from the plan itself, week one through peak week.

| Program | Days | For | Time per week |
|---|---|---|---|
| **Upper / Lower** | 4 | The default answer for most serious lifters | 4.5–6.0 h |
| **Push / Pull / Legs** | 6 | Advanced, recovering well, eating enough | 6.2–7.8 h |
| **Power / Hypertrophy** | 4 | Strength numbers you care about, plus size | 4.7–5.8 h |
| **Full Body** | 3 | Highest return per hour when time is short | 3.4–4.7 h |
| **Classic Split** | 5 | One area per session, weak-point focus | 5.0–6.5 h |

Each is audited by the test suite against the volume landmarks: no muscle is
programmed past MRV in any week, every trained muscle clears MEV by peak week,
week one leaves room to grow into, supersets never pair competing muscles, and
no session runs past 105 minutes.

---

## Layout

```
js/
  data/         exercises, programs, muscles + volume landmarks
  engine/
    onerm.js         estimated 1RM and its inverse
    progression.js   the decision: what goes on the bar today
    volume.js        fractional set counting against landmarks
    mesocycle.js     block construction, volume progression, MRV clamping
  ui/           views, charts, DOM helpers
  store.js      state + localStorage persistence
test/           72 tests: engine, program design audit, store, bundle, docs
tools/          dev server, single-file bundler
```

The engine is pure and has no DOM dependency, which is why it can be tested
properly — including the part that matters most, that a whole simulated block
progresses monotonically instead of wandering.

---

## Your data

Stored in this browser only. Settings → **Copy export to clipboard** gives you
the whole log as JSON; import replaces it. Export before you clear site data or
change browser, because nothing else has a copy.

If storage is unavailable (private mode, blocked site data) the app says so and
keeps working in memory for the session.

---

## What this is not

Not medical advice, not a coach, and not a substitute for knowing your own
recovery. The landmarks are population averages. Deload weeks are not optional
extras — skipping them is skipping the part where the training turns into
muscle.
