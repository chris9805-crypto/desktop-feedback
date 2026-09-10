# IronBlock

A training app for people who are serious about bodybuilding. It runs your
training as **mesocycles** — four weeks where volume and effort climb on
purpose, then a deload — and calculates every load it puts in front of you from
what you actually lifted last week and how hard it felt.

No account, no server, no subscription. Everything lives in your browser.

```bash
npm start           # http://localhost:8080
npm test            # 251 tests, no dependencies
npm run bundle      # dist/ironblock.html — the whole app in one file
npm run icons       # regenerate the home-screen icons
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

## Getting it on your phone

Three routes, easiest first.

### 1. GitHub Pages — the proper install

The repository ships a workflow (`.github/workflows/ironblock-pages.yml`) that
tests and deploys the app. It does nothing until you switch Pages on:

1. **Settings → Pages → Source: GitHub Actions**
2. **Actions** tab → *Deploy IronBlock* → **Run workflow**
3. It builds in about a minute and gives you a URL like
   `https://<your-username>.github.io/<repo>/`
4. Open that in **Safari** on the iPhone → **Share** → **Add to Home Screen**

You get a real app icon, full screen with no browser chrome, and — because the
URL is HTTPS — the service worker registers, so **it opens with no signal**.
That last part matters more than it sounds; a lot of gyms are basements.

Note that enabling Pages makes the app itself publicly readable. Your training
data is unaffected: it never leaves your phone, so there is nothing on the
server to expose.

### 2. Same-WiFi, no setup

On a computer on the same network:

```bash
cd bodybuilding-app && npm start
```

Then open `http://<that-computer's-IP>:8080` on the phone. Fine for trying it;
you can still Add to Home Screen. But a plain-HTTP address on your network is
not a secure origin, so **the offline cache will not install** and the app needs
the computer running and reachable.

### 3. One file

`npm run bundle` writes `dist/ironblock.html` — the entire app, no server. AirDrop
or email it to yourself and open it from Files. Good for a look; not good as
your log, because file-opened pages are the least reliable place iOS keeps
stored data.

**Whichever route you take, do this once a week:** Settings → **Copy export to
clipboard**, and paste it somewhere. The data lives in one browser on one device
and nothing else has a copy.

## Your first week

### Before session one (five minutes)

Answer the three setup questions honestly. The number of days is the one people
get wrong — pick the number you will still hit in week four, not the number you
want to be true. Four is plenty. Three is plenty.

### Session one is a measuring session

This is the part no app can do for you, and the only part that is genuinely
manual. On every exercise the card says **"—"** where the weight goes, because
nothing has been logged yet. So:

1. Warm up. Tap *How do I warm up for this?* if you want the ramp worked out.
2. Do your first set at a weight you are **confident** about.
3. Type that weight in and confirm.
4. Answer *how many more could you have done?* honestly.

**Start too light.** If the card asks for 8 reps with 3 left in the tank and you
finish thinking "I had six left" — good. Say six. The app will jump the weight
properly next time. Starting 10kg light costs you one session; starting 10kg
heavy costs you a month and possibly a shoulder.

Expect session one to take longer than the estimate. You are entering numbers
that will never need entering again.

### Sessions two to four

Now it does the work. Each card arrives with the weight and reps already filled
in, and the button says `Done — 60kg × 8`. If that is what you did, one tap.
Steppers if you need 62.5 instead. The keyboard should barely appear.

The **only** thing it needs from you is the effort question after each set, and
it is worth being precise about what honest means here: *how many more reps
could you have completed with good form, at that moment?* Not how many you could
have survived. If the last rep was a grind and the next would have collapsed,
that is **1 more** — not none.

Systematically over-reporting effort ("none left" when two were left) makes the
app hold weights it should be adding to. Under-reporting makes it chase you up
in weight until something gives. It self-corrects either way, but slowly, and
week one is where it matters most.

### The flashcards at the end

Thirty seconds, and they are what makes week two different from week one. The
soreness question is asking about **when you walked in today**, not how you feel
now. Joint pain always reduces volume, so do not be brave about it.

Skipping is fine — it means "no signal", not "it was easy".

### What week two will look like

Different, and specifically:

- Weights on most exercises will have moved, each for a stated reason.
- A few exercises will get **more sets** — the ones you recovered well from.
- Anything you reported as still sore, or painful in the joint, gets **fewer**.
- If a first-week weight was badly off, it gets corrected in one jump rather
  than crept up on.

### Things that trip people up

| What happens | What it means |
|---|---|
| An exercise says *"Same weight — prove it again"* | Beginner mode. You hit the top of the range; do it once more cleanly and it goes up. |
| A weight goes **down** | You missed the bottom of the rep range. Getting the reps is the point, not the number on the bar. |
| Week five is much lighter | That is the easy week and it is not optional. It is where the previous four weeks turn into muscle. |
| Estimated max has not moved | Normal inside a block. Volume and effort climb first; strength shows up after the easy week. |
| You miss a session | Log the next one. Nothing breaks. The plan waits. |

---

## Streaks, levels and badges

Gamification in a training app is easy to get actively wrong, and the wrong
version would argue with everything else here. A **daily** streak pushes people
to train seven days a week. **XP per set** rewards training past what you can
recover from — the exact thing the volume engine spends its time preventing.

So the incentives point at the behaviours that actually produce results:

- **The streak counts sessions, not days.** Rest never breaks it. What breaks it
  is going long enough without training that you have clearly skipped something.
  It warns you before it lapses rather than after.
- **XP is mostly for turning up.** Tripling your sets is worth less than one
  extra session. Reporting effort and answering the recovery questions is worth
  points, because those are what make the next week correct.
- **The easy week is worth more than a hard one**, and finishing one is a gold
  badge. It is the most-skipped week in training and the one that converts the
  previous four into muscle, so the scoring makes skipping it cost you.
- **No badge rewards volume for its own sake.** There is no "most sets in a
  week" — that would be the app arguing with itself, and a test enforces it.

Fourteen badges, three tiers, each tied to something in the log: sessions
logged, clean weeks, blocks finished, honest reporting, personal bests, and a
week where every muscle landed in its productive range.

Finishing a session shows what it earned and where each point came from, plus
any badge that just unlocked and any lift that hit a new best.

## Crew — comparing progress without a server

**There is no backend, and adding one would change what this app is.** A live
leaderboard or a discussion forum needs accounts, storage and moderation, and
would put everybody's training log on someone else's computer. Right now yours
has never left your phone.

So sharing works the way game consoles did before they were online. You copy a
short code, send it to someone you train with, they paste it in — and each of
you gets a standings table built from the codes you hold. Manual and
asynchronous. In exchange it is **real**: no invented users, no fabricated
leaderboard, no account, nothing uploaded.

A code carries your name, level, streak and the week's totals. Nothing else —
not your log, not your weights, not your bodyweight. Codes arriving from other
people are treated as hostile input: names are stripped to letters and digits,
every number is clamped, and malformed codes are refused with an explanation.

**Standings rank by streak, then sessions — never by weight lifted.** Ranking a
crew by tonnage just tells you who is heaviest, and tells a beginner they are
losing at something they cannot win for two years. Showing up is a competition
anyone can be in on their first day.

### What is honestly not here

Live leaderboards against strangers, following people, and community discussion
threads. All three need a server. The Crew screen says so rather than showing an
empty "coming soon" feed, because a fake social feature is worse than an honest
small one.

---

## Exercise visuals

There are no photographs, and that is a deliberate limit rather than an
oversight: there is no licensed source for them, and anything fetched from the
web would break the offline promise and put a third party in the middle of your
training log. Real form demonstration needs video of a real person, and this
app cannot honestly provide that.

What it does instead is generated from its own data, which makes it useful in a
different way:

- **A muscle map** on every exercise — a front and back diagram with the main
  movers filled solid and the assisting muscles at half strength. That is
  literally the same full-set / half-set distinction the volume engine counts,
  so the picture and the numbers can never disagree, and a new exercise gets a
  correct diagram with no artwork to commission.
- **A movement pattern** — the start and finish positions and the one thing
  that usually goes wrong. There are only about twenty things a body does under
  load, so each pattern is described properly once rather than sixty-nine times
  badly.

The figure is drawn as separated blocks rather than a continuous silhouette. At
this size an attempt at a real body reads as a bad drawing; clearly separated
parts read as what it is, a diagram.

Maps appear in the exercise library, beside the exercise on the set card (tap
for the full picture and cues), and on each option in the swap sheet, so you can
see what a substitute trains before choosing it.

---

## Cutting: when holding is the win

Training mode is about how experienced you are. **Phase** is about what you are
eating for — *Gaining*, *Maintaining* or *Cutting* — and it changes what counts
as a good week. You can switch it mid-block, because starting a diet mid-block
is normal.

This exists because in a deficit the app's default behaviour is **wrong, not
just unhelpful**:

- **Loads ratcheted down.** Missing a rep target dropped the load 6%, and each
  drop lowered the next week's target. Miss occasionally while genuinely
  maintaining — which is what a deficit looks like — and the weights spiral on
  their own. The diet gets blamed for bookkeeping.
- **Volume climbed anyway**, which is the wrong direction when recovery is
  impaired.
- **Success was defined as progress**, so someone doing everything right was
  told every week that they had failed.

On **Cutting**:

| | What changes |
|---|---|
| Goal | Matching last week is logged as a success (`Match it`), not a stall |
| Load floor | Takes **two** consecutive misses to move, and then only ~3% |
| Volume | Stops climbing, and good feedback does not add sets — feeling fresh in a deficit is not a mandate for more work |
| Ceiling | MRV drops 20%, because recoverable volume genuinely does |
| Effort | One notch further from failure — grinding underfed recovers worse and injures more |

Progress still counts when it comes: genuinely filling the rep window still
earns load. You are simply not being asked for it.

### Strength retention

Replaces "records" as the headline while cutting: **what percentage of your
best you are still holding**, per lift and overall, with compounds weighted
double. Within 3% of peak counts as held, because a couple of percent off during
a diet is a successful diet.

It reads your *best recent* effort rather than your last one — judging a diet on
a single bad session would be wrong and would push people to abandon it — and
peak comes from your whole log, since the thing you are keeping is the best you
have ever been.

### Bodyweight — optional, and the denominator

Logging your weight is what turns a flat line into the win it actually is:
holding a 100kg bench while the scale drops means you are moving the same bar
with less of you doing it. The app shows that as **strength per kilo** —
*"+4.1% strength per kilo, moving the same weight at 85kg, down from 88.5kg"* —
which the headline percentage on its own reads as no change at all.

Everything works without it. The headline retention figure needs no bodyweight;
the relative number simply is not offered.

Because this is the part of a fitness app most capable of doing harm, it is
deliberately restrained:

- **The trend is the number, never today's reading.** Day-to-day bodyweight is
  mostly water and glycogen; a single figure is noise wearing the costume of a
  fact. It shows a 7-day average, and a rate fitted by least squares over three
  weeks rather than first-versus-last, which two noisy endpoints can fake.
- **No goal weight, no finish date, no "behind schedule", no calorie estimates.**
  The app cannot know any of that, and guessing would be both wrong and unkind.
- **The only judgement it offers is on rate**, because rate is the part that
  decides whether a cut costs you muscle: past roughly 1% of bodyweight a week,
  the share of the loss coming from muscle climbs sharply, and that is worth
  saying to someone using an app built to prevent exactly that.
- Weighing daily is not required; irregular readings are handled, and a rate is
  not quoted at all until there is enough history to mean something.

**One honest limit, stated in the app as well as here: this is strength
retention, not muscle retention.** No training log can measure tissue. You can
hold strength while losing a little muscle, and the reverse. Strength is the
best proxy available and a decent one, but it is a proxy, and it is labelled as
one everywhere it appears.

---

## Three modes

The mode changes the **training**, not just the wording. It is picked on first
run and switchable in Settings; a block already running keeps the mode it
started in, so switching never rewrites training you are part-way through.

### Form & foundation — beginner

The constraint at this stage is technique, not recovery, so the app treats it
that way:

- **Never within 2 reps of failure**, on any exercise, in any week — including
  the last hard week where the program itself calls for 0 RIR.
- **Rep windows shift up by 2.** Lighter loads for more reps are far more
  forgiving of imperfect technique and teach position better.
- **Half-size load jumps**, and load only moves after you have hit the top of
  the range **twice**. Repeating a session you can already do well is what makes
  a movement automatic.
- **Tempo prescribed** — three seconds down, pause, lift with control.
- After each exercise it asks two things: *did the technique hold up* and *did
  you feel the target muscle working*. Both gate progression: report that form
  broke down and the weight does not go up, whatever the reps said.
- No estimated 1RM shown. The number means little before technique settles.

### Strength & structure — intermediate

The main lifts get the heavy work and the attention. Effort is capped by the
movement rather than by the mode — a heavy barbell lift still stops at 1 RIR,
but taking a leg extension to failure is normal, useful training here.

Form is the **gate** rather than the goal: one question after each exercise, and
a set where technique came apart holds the load. Estimated 1RM on the main lifts
is front and centre.

### Weak points & limits — advanced

At this level the average is not the problem — the weak links are. This mode
reads the log for three kinds of imbalance and steers volume accordingly:

- **Strength ratios.** Row against bench, overhead press against bench, squat
  against deadlift, vertical pull against vertical press. A bench that has run
  away from the row it should roughly match is a back problem that eventually
  becomes a shoulder problem.
- **Progress rate by muscle.** A muscle whose estimated max has gone nowhere for
  a block while everything else moved, measured against the median.
- **Side-to-side**, from what you report after unilateral sets. Near universal,
  almost never measured.

Every finding shows its evidence (*"85 vs 184 — a ratio of 0.46 where 0.85 is
typical"*). The top two lagging muscles get an extra set a week in the next
block — still clamped to MRV, and only while they are actually recovering.
Sets on stable movements can go to genuine failure, and a rough-form report is
treated as information rather than a veto: you are told, and you decide.

## Logging without typing

The old grid of number boxes assumed you wanted to type. Mostly you do not —
you did roughly what the app told you to, and typing three numbers per set,
twenty times a session, with chalk on your hands, is why training logs get
abandoned in week three.

So **the app proposes and you confirm**. One card per set, the predicted numbers
already in place at a size you can read from arm's length, and a button that
says `Done — 100kg × 8`. Adjusting is a tap on a stepper. Typing is still there
for when reality diverged badly, but it is the exception rather than the
interaction. The prediction is not a guess — it is the same progression engine
that writes the plan, so confirming is genuinely the common case.

**Straight sets are the default.** Log the first set of an exercise and the
rest of it fills in with the same weight and reps — because that is what almost
everybody does, and because a first-ever lift has nothing prescribed to fall
back on, so without this it asked for the same two numbers on every set.
Anything you change yourself is never overwritten, so putting five more kilos on
the last set still works, and deviating from the plan on set one carries *your*
number forward rather than the plan's.

**The order is yours.** A busy squat rack is not a programming decision. `Do
later` on any card sends that exercise to the back of what is left, keeping any
sets you already logged; the list view has up/down arrows; and `Keep this order`
remembers it for that day for the rest of the block. It changes nothing about
the training — same sets, same prescriptions — and it applies to your block
only, not the program.

The one thing it cannot predict is how hard the set felt, so that is asked
straight after, in words, with five big targets. It is never assumed: a set
confirmed with one tap carries no effort rating until you give one, because
feeding the engine its own assumptions back is worse than a gap.

`See the whole session` switches to the scrollable list at any point.

### The flashcards afterwards

Three or four questions, one screen each, about thirty seconds:

| Card | What it asks | What it does |
|---|---|---|
| **Effort** | How hard was the session? | Whether next week's volume climbs or backs off |
| **Stamina** | Did you fade as it went on? | Fading early means volume, not load, is too high |
| **Strength** | Stronger or weaker than last time? | A run of "weaker" means fatigue caught up early |
| **Look** | How does the muscle look right now? | The most honest available proxy for whether the dose landed |
| **Weak point** | Advanced only — agree with what the log found? | Agreeing steers an extra set there; disagreeing stops it being raised again |

One question at a time, each stating its consequence. A single dense form asking
nine things gets skipped, and skipped feedback is the same as no feedback — the
app falls back to a default step up and stops being able to tell a good week
from a bad one.

Skipping is still fine, and explicitly means *no signal* rather than "it was
easy": an unanswered card changes nothing. The per-muscle answers decide whether
a *muscle* gets more work; these decide whether *you* do, and apply across the
whole following week.

---

## If you are new to this

You do not need to know any of the words. Three questions on first run — how
long you have been lifting, how many days you can train, what equipment you
have — and it picks a program and explains why.

**Nothing is called by its jargon name unless you ask for it.** Instead of
`4 × 5 @ 100kg · 2 RIR` you get:

> *4 sets of 5 reps at 100kg, and stop with about 2 reps still in you.*

and underneath, in place of "topped out the window at 2 RIR":

> *Last time you got 8 reps and still had 2 more reps in you. That is the signal
> to add weight, so you are going up to 102.5kg and back down to 5 reps.*

Other things that change in beginner mode:

- **Effort is asked in words, not numbers.** After each set: *"How many more
  could you have done?"* → `None left · 1 more · 2 more · 3 more · 4+ more`.
  Nobody is handed an empty box labelled RIR.
- **Warm-up guidance on every exercise**, with the weights worked out —
  `8 reps at 40kg · 5 reps at 60kg · 3 reps at 80kg`. This is the thing every
  program assumes you know and none of them tell you.
- **Any underlined word is tappable** for a plain-English definition, anywhere
  in the app. The full glossary lives under **Learn**, along with the handful of
  things nobody tells beginners — that soreness is not the score, that you will
  not grow without eating, that a missed session is not failure.
- **A beginner program.** *First Steps*: three days, six exercises, mostly
  machines and dumbbells, every set stopping well short of failure. Volume is
  deliberately low — beginners grow on far less work than an intermediate needs,
  and recovering easily is what gets you back three times a week.
- **Recovery questions in plain language.** "Still aching from last time?"
  rather than "Soreness 0–3".

Switch to `Settings → Just the numbers` at any point and the technical
vocabulary comes back. The training underneath is identical either way — it is
the wording that changes, not the plan.

## Using it on your phone

It installs to the home screen and runs full-screen with its own icon:

- **iPhone/iPad:** Share → Add to Home Screen
- **Android:** menu (⋮) → Install app, or the button in Settings

Once installed **it works with no signal**, which matters because gyms are
famously basements. Everything is cached on first visit and your data never
leaves the device, so there is nothing to sync and nothing to wait for.

The phone layout is a five-item bottom bar within thumb reach, tap targets sized
for someone out of breath, and safe-area insets so nothing hides under a notch
or a home indicator. There are no `alert()` or `prompt()` dialogs anywhere —
every confirmation is a bottom sheet you can reach one-handed.

## Training without a full gym

Pick what you actually have — full gym, machines and cables but no barbell, or
just dumbbells at home — and exercises you cannot do are swapped for ones that
train the same muscle. A back squat becomes a goblet squat; a cable pushdown
becomes a dumbbell overhead extension.

The swap happens *after* volume and progression are worked out, so the plan
underneath is identical — only the movement you physically perform changes. Set
counts, rep windows and MRV caps are unaffected. Every program is checked by the
test suite to be fully performable on every equipment profile, and every
substitute is checked to train the same primary muscle as the movement it
replaces.

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

Six templates, each a five-week block. Session and weekly times are computed
from the plan itself, week one through peak week.

| Program | Days | For | Time per week |
|---|---|---|---|
| **First Steps** | 3 | Your first six months — machines, dumbbells, nothing near failure | 2.5–3.4 h |
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
  data/         exercises, programs, muscles + landmarks, glossary, modes,
                phases, achievements, movement patterns
  engine/
    equipment.js     substituting movements for the kit you have
    imbalance.js     strength ratios, stalled muscles, side-to-side
    progress.js      streaks, XP, levels, badges
    retention.js     how much of your peak strength you are holding
    bodyweight.js    the trend, and the only judgement it makes (rate)
    crew.js          share codes and standings, no server
    onerm.js         estimated 1RM and its inverse
    progression.js   the decision: what goes on the bar today
    volume.js        fractional set counting against landmarks
    mesocycle.js     block construction, volume progression, MRV clamping
  ui/
    explain.js       plain-English wording for everything the engine decides
    muscle-map.js    body diagrams generated from the exercise data
    sheet.js         bottom sheets (no alert/prompt/confirm anywhere)
    term.js          tappable jargon
    views/
      cards.js       one-card-per-set logging
      review.js      the post-session flashcards
      ...            screens, the first-run walkthrough and Learn
  store.js      state + localStorage persistence
sw.js           offline cache
manifest.webmanifest, icons/   home-screen install
test/           251 tests: engine, program design audit, store, modes,
                weak-point detection, beginner layer, equipment adaptation,
                offline shell, bundle, docs
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
