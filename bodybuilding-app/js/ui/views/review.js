/**
 * The post-session flashcards.
 *
 * Three or four questions, one screen each, tapped through in under thirty
 * seconds. They are not a diary - each one is an input the engine uses:
 *
 *   EFFORT / STAMINA   how hard the session was and whether you faded. Drives
 *                      whether next week's volume climbs, holds, or backs off
 *                      across the board, on top of the per-muscle answers.
 *
 *   STRENGTH           whether you felt stronger or weaker than last time. A
 *                      run of "weaker" is the signal that fatigue has caught
 *                      up with you before the deload was due.
 *
 *   LOOK               how full and pumped the muscle looks now. It is the
 *                      most honest immediately-available proxy for whether the
 *                      dose landed, which is why bodybuilders have used the
 *                      mirror as a training instrument for eighty years.
 *
 *   WEAK POINT         advanced only - confirms or dismisses what the log
 *                      already thinks is lagging.
 */

import { h } from '../dom.js';
import { store } from '../../store.js';
import { getMode } from '../../data/modes.js';
import { muscleName, isPlural } from '../../data/muscles.js';
import { getProgram } from '../../data/programs.js';
import { feedbackTargets } from '../../engine/mesocycle.js';
import { question } from './cards.js';
import { sessionVolumeModifier } from '../../engine/progression.js';

/** Session-level cards, in the order the mode wants them. */
export function buildCards(active) {
  const mode = getMode(active.mode);
  const program = getProgram(active.programId);
  const day = program?.days.find((d) => d.id === active.dayId);
  const muscles = day ? feedbackTargets({ slots: day.slots }) : [];
  const cards = [];

  for (const key of mode.sessionCards) {
    if (key === 'effort') cards.push(effortCard());
    if (key === 'stamina') cards.push(staminaCard());
    if (key === 'strength') cards.push(strengthCard());
    if (key === 'connection') cards.push(connectionCard());
    if (key === 'look') for (const muscle of muscles) cards.push(lookCard(muscle));
    if (key === 'weakpoint') {
      const lagging = store.weakPoints().lagging[0];
      if (lagging) cards.push(weakPointCard(lagging));
    }
  }
  return cards;
}

function effortCard() {
  return {
    id: 'effort',
    render: (onPick) => h('div', {},
      question({
        title: 'How hard was that session?',
        hint: 'The whole session, not one set. This decides whether next week goes up or holds.',
        options: [
          { value: 0, label: 'Easy', detail: 'I could have done it twice' },
          { value: 1, label: 'Solid', detail: 'Worked hard, finished strong' },
          { value: 2, label: 'Hard', detail: 'Genuinely tough by the end' },
          { value: 3, label: 'Brutal', detail: 'I was hanging on' },
        ],
        selected: store.state.active?.session?.effort,
        onPick: (v) => { store.setSessionCard('effort', v); onPick(); },
      }),
    ),
  };
}

function staminaCard() {
  return {
    id: 'stamina',
    render: (onPick) => h('div', {},
      question({
        title: 'Did you fade as the session went on?',
        hint: 'Stamina within a session is a different signal from how heavy it felt. ' +
              'Fading early usually means the volume, not the weights, is too high.',
        options: [
          { value: 0, label: 'No', detail: 'Last set felt like the first' },
          { value: 1, label: 'A little', detail: 'Slowed down towards the end' },
          { value: 2, label: 'A lot', detail: 'Running on empty by the last exercise' },
        ],
        selected: store.state.active?.session?.stamina,
        onPick: (v) => { store.setSessionCard('stamina', v); onPick(); },
      }),
    ),
  };
}

function strengthCard() {
  return {
    id: 'strength',
    render: (onPick) => h('div', {},
      question({
        title: 'Did you feel stronger than last time?',
        hint: 'Compared with the last time you did this session. A run of "weaker" is how ' +
              'you find out fatigue has caught up with you before the easy week was due.',
        options: [
          { value: 2, label: 'Stronger', detail: 'The weights moved better than last time' },
          { value: 1, label: 'About the same', detail: 'No real difference' },
          { value: 0, label: 'Weaker', detail: 'Same weights felt heavier than they should' },
        ],
        selected: store.state.active?.session?.strength,
        onPick: (v) => { store.setSessionCard('strength', v); onPick(); },
      }),
    ),
  };
}

function connectionCard() {
  return {
    id: 'connection',
    render: (onPick) => h('div', {},
      question({
        title: 'Could you feel the right muscles working?',
        hint: 'This is the skill you are actually building right now. It comes with reps, ' +
              'not with weight - which is why the loads climb slowly at this stage.',
        options: [
          { value: 2, label: 'Most of the time', detail: 'I knew what was doing the work' },
          { value: 1, label: 'Sometimes', detail: 'On some exercises, not others' },
          { value: 0, label: 'Not really', detail: 'I was just moving the weight' },
        ],
        selected: store.state.active?.session?.connection,
        onPick: (v) => { store.setSessionCard('connection', v); onPick(); },
      }),
    ),
  };
}

/**
 * The mirror question, per muscle. Feeds the same input the old "pump" slider
 * did - it is just asked the way a lifter actually thinks about it.
 */
function lookCard(muscle) {
  const name = muscleName(muscle).toLowerCase();
  const verb = isPlural(muscle) ? 'do they' : 'does it';
  return {
    id: `look-${muscle}`,
    render: (onPick) => h('div', {},
      question({
        title: `Your ${name} — how full ${verb} look right now?`,
        hint: 'Right after training, in the mirror. Fuller than usual means the work landed.',
        options: [
          { value: 3, label: 'Blown up', detail: 'Noticeably bigger than normal' },
          { value: 2, label: 'Full', detail: 'Pumped, looks worked' },
          { value: 1, label: 'Slightly fuller', detail: 'A bit, not much' },
          { value: 0, label: 'Flat', detail: 'Looks the same as before I started' },
        ],
        selected: store.state.active?.feedback?.[muscle]?.pump,
        onPick: (v) => { store.setFeedback(muscle, { pump: v }); onPick(); },
      }),
      question({
        title: `Still sore there from last time?`,
        hint: 'Turning up still sore means you have not recovered from the last dose, ' +
              'so adding to it will not help.',
        options: [
          { value: 0, label: 'Not at all', detail: 'Fully recovered' },
          { value: 1, label: 'A little', detail: 'Noticed it warming up' },
          { value: 2, label: 'Yes, quite', detail: 'Sore through the session' },
          { value: 3, label: 'Yes, a lot', detail: 'Still wrecked from last time' },
        ],
        selected: store.state.active?.feedback?.[muscle]?.soreness,
        onPick: (v) => { store.setFeedback(muscle, { soreness: v }); },
      }),
      question({
        title: 'Any joint pain?',
        hint: 'This one always reduces volume, whatever else you said. Joints do not ' +
              'get a training effect from being pushed through pain.',
        options: [
          { value: 0, label: 'None', detail: 'Everything felt fine' },
          { value: 1, label: 'A twinge', detail: 'Noticed something, no pain' },
          { value: 2, label: 'It hurt', detail: 'Painful during sets' },
          { value: 3, label: 'Sharp', detail: 'Sharp pain — I should stop this movement' },
        ],
        selected: store.state.active?.feedback?.[muscle]?.joint,
        onPick: (v) => { store.setFeedback(muscle, { joint: v }); },
      }),
    ),
  };
}

function weakPointCard(muscle) {
  return {
    id: 'weakpoint',
    render: (onPick) => h('div', {},
      question({
        title: `Your log says ${muscleName(muscle).toLowerCase()} is lagging. Agree?`,
        hint: 'If you agree, the next block steers an extra set a week there. If not, ' +
              'the app stops nagging about it.',
        options: [
          { value: 'agree', label: 'Yes, that is a weak point', detail: 'Specialise there' },
          { value: 'unsure', label: 'Not sure', detail: 'Keep watching it' },
          { value: 'disagree', label: 'No', detail: 'Leave it alone' },
        ],
        selected: store.state.active?.session?.weakPoint?.verdict,
        onPick: (v) => { store.setSessionCard('weakPoint', { muscle, verdict: v }); onPick(); },
      }),
    ),
  };
}

export { sessionVolumeModifier };
