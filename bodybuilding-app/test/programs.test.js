/**
 * These are not unit tests so much as a design audit of the shipped programs.
 * A template that starts above a muscle's adaptive ceiling has nowhere to
 * progress to, and one that never reaches minimum effective volume is not
 * going to grow anything. Both are silent failures in a training app, so they
 * are checked here rather than discovered eight weeks in.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROGRAMS, getProgram } from '../js/data/programs.js';
import { EXERCISE_BY_ID, getExercise } from '../js/data/exercises.js';
import { MUSCLES, MUSCLE_DISPLAY_ORDER } from '../js/data/muscles.js';
import { plannedSetsByMuscle, landmarkStatus, setsByMuscle, isStimulating } from '../js/engine/volume.js';
import {
  newMesocycle, weekPlan, totalWeeks, feedbackTargets, computeExtras,
  estimateSessionMinutes, programTimeProfile,
} from '../js/engine/mesocycle.js';

const accumulationVolume = (program) => {
  const meso = newMesocycle(program);
  const rows = [];
  for (let w = 0; w < program.accumulationWeeks; w++) {
    rows.push(plannedSetsByMuscle(weekPlan(meso, [], w).days));
  }
  return rows;
};

test('every program references real exercises and declares its day count', () => {
  for (const program of PROGRAMS) {
    assert.equal(program.days.length, program.daysPerWeek, `${program.id} day count`);
    assert.equal(program.rirByWeek.length, program.accumulationWeeks, `${program.id} RIR plan`);
    for (const day of program.days) {
      assert.ok(day.slots.length >= 4, `${program.id}/${day.id} is too thin to be a session`);
      for (const s of day.slots) {
        assert.ok(EXERCISE_BY_ID[s.exerciseId], `${program.id} references ${s.exerciseId}`);
        assert.ok(s.sets >= 1);
      }
    }
  }
});

test('no muscle is programmed past its recoverable volume in any week', () => {
  for (const program of PROGRAMS) {
    for (const week of accumulationVolume(program)) {
      for (const [muscleId, sets] of Object.entries(week)) {
        assert.ok(sets <= MUSCLES[muscleId].mrv,
          `${program.id}: ${muscleId} at ${sets} sets exceeds MRV ${MUSCLES[muscleId].mrv}`);
      }
    }
  }
});

test('every trained muscle clears minimum effective volume by the peak week', () => {
  for (const program of PROGRAMS) {
    const rows = accumulationVolume(program);
    const peak = rows[rows.length - 1];
    for (const muscleId of MUSCLE_DISPLAY_ORDER) {
      const sets = peak[muscleId] ?? 0;
      if (sets === 0) continue; // deliberately untrained is a choice, not a bug
      assert.ok(sets >= MUSCLES[muscleId].mev,
        `${program.id}: ${muscleId} peaks at ${sets} sets, below MEV ${MUSCLES[muscleId].mev}`);
    }
  }
});

test('week one leaves room to progress into', () => {
  for (const program of PROGRAMS) {
    const [first] = accumulationVolume(program);
    for (const [muscleId, sets] of Object.entries(first)) {
      assert.ok(sets <= MUSCLES[muscleId].mav,
        `${program.id}: ${muscleId} opens at ${sets} sets, already past MAV ${MUSCLES[muscleId].mav}`);
    }
  }
});

test('volume climbs week over week and the block ends in a deload', () => {
  for (const program of PROGRAMS) {
    const meso = newMesocycle(program);
    let previous = 0;
    for (let w = 0; w < program.accumulationWeeks; w++) {
      const total = weekPlan(meso, [], w).days
        .reduce((n, d) => n + d.slots.reduce((k, s) => k + s.sets, 0), 0);
      assert.ok(total >= previous, `${program.id} week ${w + 1} did not progress`);
      previous = total;
    }
    const deload = weekPlan(meso, [], program.accumulationWeeks);
    assert.equal(deload.deload, true);
    assert.equal(totalWeeks(program), program.accumulationWeeks + 1);
  }
});

test('every program covers the movement patterns a physique needs', () => {
  const required = ['chest', 'lats', 'upperBack', 'quads', 'hamstrings', 'sideDelts', 'biceps', 'triceps'];
  for (const program of PROGRAMS) {
    const peak = accumulationVolume(program).at(-1);
    for (const muscleId of required) {
      assert.ok((peak[muscleId] ?? 0) > 0, `${program.id} never trains ${muscleId}`);
    }
  }
});

test('push and pull volume stay within sight of each other', () => {
  for (const program of PROGRAMS) {
    const peak = accumulationVolume(program).at(-1);
    const push = (peak.chest ?? 0) + (peak.frontDelts ?? 0) + (peak.triceps ?? 0);
    const pull = (peak.lats ?? 0) + (peak.upperBack ?? 0) + (peak.biceps ?? 0);
    const ratio = push / pull;
    assert.ok(ratio > 0.6 && ratio < 1.6, `${program.id} push/pull ratio ${ratio.toFixed(2)} is lopsided`);
  }
});

test('rest periods respect what the movement demands', () => {
  for (const program of PROGRAMS) {
    for (const day of program.days) {
      for (const s of day.slots) {
        if (s.restSec == null) continue;
        const ex = getExercise(s.exerciseId);
        if (ex.type === 'compound') {
          assert.ok(s.restSec >= 120, `${program.id}: ${s.exerciseId} rests only ${s.restSec}s`);
        }
      }
    }
  }
});

test('supersets pair movements that do not compete for the same muscle', () => {
  for (const program of PROGRAMS) {
    for (const day of program.days) {
      const groups = {};
      for (const s of day.slots) {
        if (!s.superset) continue;
        (groups[s.superset] ??= []).push(getExercise(s.exerciseId));
      }
      for (const [tag, members] of Object.entries(groups)) {
        for (let i = 0; i < members.length; i++) {
          for (let j = i + 1; j < members.length; j++) {
            const shared = members[i].primary.filter((m) => members[j].primary.includes(m));
            assert.equal(shared.length, 0,
              `${program.id}/${day.id} superset ${tag}: ${members[i].id} and ${members[j].id} share ${shared}`);
          }
        }
      }
    }
  }
});

test('no session runs past what a training session can reasonably be', () => {
  // Peak week is the hardest week by design, but a session that runs past
  // ~105 minutes stops being trainable and starts being endured.
  for (const program of PROGRAMS) {
    const plan = weekPlan(newMesocycle(program), [], program.accumulationWeeks - 1);
    for (const day of plan.days) {
      const minutes = estimateSessionMinutes(day);
      assert.ok(minutes <= 105, `${program.id}/${day.id} runs ~${minutes} min at peak`);
    }
  }
});

test('the efficiency program is genuinely the cheapest week', () => {
  // "Highest return per hour" is a claim the app makes on the programs screen.
  // Session length alone would not prove it - a full body day is long. Weekly
  // hours are what the claim is actually about.
  const profiles = Object.fromEntries(PROGRAMS.map((p) => [p.id, programTimeProfile(p)]));
  const cheapest = Object.entries(profiles).sort((a, b) => a[1].weeklyStart - b[1].weeklyStart)[0][0];
  assert.equal(cheapest, 'fb3');
  assert.ok(profiles.ppl6.weeklyStart > profiles.ul4.weeklyStart, 'six days should cost more than four');
});

test('time estimates come from the plan rather than a hand-written number', () => {
  for (const program of PROGRAMS) {
    assert.equal(program.sessionMinutes, undefined,
      `${program.id} still declares a session length that can drift from its own plan`);
    const t = programTimeProfile(program);
    assert.ok(t.sessionMin > 20 && t.sessionMax > t.sessionMin);
    assert.ok(t.weeklyPeak > t.weeklyStart);
  }
});

test('feedback drives volume up when recovery is good and down when it is not', () => {
  const program = getProgram('ul4');
  const meso = newMesocycle(program);
  const week0 = weekPlan(meso, [], 0);
  const chestSets = (plan) => plannedSetsByMuscle(plan.days).chest ?? 0;

  const fresh = [{ mesoId: meso.id, week: 0, feedback: { chest: { soreness: 0, pump: 0, joint: 0 } } }];
  const wrecked = [{ mesoId: meso.id, week: 0, feedback: { chest: { soreness: 3, pump: 3, joint: 0 } } }];

  assert.ok(chestSets(weekPlan(meso, fresh, 1)) > chestSets(week0), 'under-stimulated chest should get more work');
  assert.ok(chestSets(weekPlan(meso, wrecked, 1)) < chestSets(week0), 'unrecovered chest should get less');
});

test('joint pain pulls volume back even when everything else looks great', () => {
  const program = getProgram('ul4');
  const meso = newMesocycle(program);
  const base = plannedSetsByMuscle(weekPlan(meso, [], 0).days).chest;
  const sessions = [{ mesoId: meso.id, week: 0, feedback: { chest: { soreness: 0, pump: 0, joint: 3 } } }];
  const after = plannedSetsByMuscle(weekPlan(meso, sessions, 1).days).chest;
  assert.ok(after < base, 'joint pain must never read as "add more sets"');
});

test('the MRV clamp reaches a fixed point across every muscle', () => {
  // Sets added for one muscle land as indirect volume on others; clamping has
  // to settle globally, not per muscle in isolation.
  const program = getProgram('ppl6');
  const meso = newMesocycle(program);
  const allFresh = [0, 1, 2, 3].map((week) => ({
    mesoId: meso.id, week,
    feedback: Object.fromEntries(MUSCLE_DISPLAY_ORDER.map((m) => [m, { soreness: 0, pump: 0, joint: 0 }])),
  }));
  for (let w = 0; w < program.accumulationWeeks; w++) {
    const volume = plannedSetsByMuscle(weekPlan(meso, allFresh, w).days);
    for (const [muscleId, sets] of Object.entries(volume)) {
      assert.ok(sets <= MUSCLES[muscleId].mrv,
        `week ${w + 1}: ${muscleId} at ${sets} sets broke through MRV ${MUSCLES[muscleId].mrv}`);
    }
  }
});

test('added sets are spread across exercises rather than dumped on one', () => {
  const program = getProgram('ul4');
  const meso = newMesocycle(program);
  const { extras } = computeExtras(program, [], meso.id, 3);
  const values = Object.values(extras).filter((v) => v > 0);
  assert.ok(values.length > 3, 'volume should be distributed');
  assert.ok(Math.max(...values) <= 3, 'no single slot absorbs the whole block of added volume');
});

test('post-session feedback is asked only about muscles that took real work', () => {
  const program = getProgram('ul4');
  const upperA = weekPlan(newMesocycle(program), [], 0).days.find((d) => d.id === 'upper-a');
  const targets = feedbackTargets(upperA);
  assert.ok(targets.includes('chest'));
  assert.ok(!targets.includes('quads'), 'never asked about a muscle the session did not train');
});

test('volume counting ignores warm-ups and sets left far from failure', () => {
  const sessions = [{
    entries: [{
      exerciseId: 'bb-bench',
      sets: [
        { weight: 60, reps: 10, rir: 8, done: true, warmup: true },
        { weight: 100, reps: 5, rir: 6, done: true },   // too easy to count
        { weight: 100, reps: 5, rir: 2, done: true },
        { weight: 100, reps: 5, rir: 1, done: false },  // not performed
      ],
    }],
  }];
  const totals = setsByMuscle(sessions);
  assert.equal(totals.chest, 1);
  assert.equal(totals.triceps, 0.5, 'assisting muscles are credited a half set');
  assert.equal(isStimulating({ done: true, reps: 8, rir: 2 }), true);
  assert.equal(isStimulating({ done: true, reps: 8, rir: 6 }), false);
});

test('landmark status reads as words, never as colour alone', () => {
  assert.equal(landmarkStatus(0, 'chest').zone, 'none');
  assert.equal(landmarkStatus(4, 'chest').zone, 'below-mev');
  assert.equal(landmarkStatus(14, 'chest').zone, 'productive');
  assert.equal(landmarkStatus(22, 'chest').zone, 'near-mrv');
  assert.equal(landmarkStatus(40, 'chest').zone, 'over-mrv');
  for (const sets of [0, 4, 14, 22, 40]) {
    const s = landmarkStatus(sets, 'chest');
    assert.ok(s.label.length > 0 && s.advice.length > 0);
  }
});
