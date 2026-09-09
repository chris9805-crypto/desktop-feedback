/**
 * Crew: comparing progress with people you actually know, without a server.
 *
 * There is no backend here and adding one would change what this app is: your
 * training data currently never leaves your phone, there is no account, and
 * nothing to breach. A live leaderboard would need accounts, storage and
 * moderation, and would put everybody's log on someone else's computer.
 *
 * So the sharing works the way game consoles did it before they were online:
 * you export a short code containing a summary of your week, your friend
 * pastes it in, and each of you sees a standings table built from the codes you
 * hold. It is manual and asynchronous. In exchange it is real - no invented
 * users, no fabricated leaderboard - and it needs no account, no network and no
 * trust in anybody's server.
 *
 * A code carries a summary and nothing else: a name you choose, your level,
 * streak and the week's totals. Never your log, never your bodyweight, never
 * anything you did not type into the name field.
 */

import { uid } from '../util/id.js';

export const CODE_PREFIX = 'IB1';

/** The only fields that ever leave the device. */
export function buildCard(profile, progress, weekTotals) {
  return {
    v: 1,
    id: profile.id,
    name: String(profile.name ?? 'Anonymous').slice(0, 24),
    level: progress.level.level,
    xp: progress.xp,
    streak: progress.streak.current,
    sessions: weekTotals.sessions,
    sets: weekTotals.sets,
    at: Date.now(),
  };
}

/**
 * Encode to something a person can paste into a message.
 *
 * Base64 of compact JSON. This is not encryption and is not claimed to be: the
 * point is surviving a copy-paste through any chat app, not secrecy. Anyone
 * holding the code can read the summary in it, which is exactly why you sent
 * it to them.
 */
export function encodeCard(card) {
  const bytes = new TextEncoder().encode(JSON.stringify(card));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `${CODE_PREFIX}-${btoa(binary).replace(/=+$/, '')}`;
}

export function decodeCard(code) {
  const trimmed = String(code ?? '').trim().replace(/\s+/g, '');
  if (!trimmed.startsWith(`${CODE_PREFIX}-`)) {
    throw new Error('That does not look like a crew code - they start with IB1-.');
  }
  const payload = trimmed.slice(CODE_PREFIX.length + 1);
  let json;
  try {
    const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const binary = atob(padded);
    json = new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
  } catch {
    throw new Error('That code is damaged - ask them to send it again.');
  }

  let card;
  try {
    card = JSON.parse(json);
  } catch {
    throw new Error('That code is damaged - ask them to send it again.');
  }
  if (!card || card.v !== 1 || !card.id || !card.name) {
    throw new Error('That code is from a different version of the app.');
  }

  // Everything in here was typed by somebody else. Clamp and strip rather than
  // trust: a crew code must not be able to put markup or absurd numbers on your
  // screen, whoever wrote it.
  return {
    v: 1,
    id: String(card.id).slice(0, 40),
    name: safeName(card.name),
    level: clampNumber(card.level, 1, 60),
    xp: clampNumber(card.xp, 0, 10000000),
    streak: clampNumber(card.streak, 0, 9999),
    sessions: clampNumber(card.sessions, 0, 100),
    sets: clampNumber(card.sets, 0, 5000),
    at: clampNumber(card.at, 0, Date.now() + 86400000),
  };
}

/** Letters, digits and simple punctuation only, and never empty. */
export function safeName(value) {
  const cleaned = String(value ?? '')
    // Letters and digits in any script, plus the punctuation that turns up in
    // real names. Both apostrophes: phones produce the curly one by default,
    // and stripping it turns O'Neill into ONeill.
    .replace(/[^\p{L}\p{N} '\u2019._-]/gu, '')
    .trim()
    .slice(0, 24);
  return cleaned || 'Anonymous';
}

function clampNumber(value, lo, hi) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

export function newProfile(name) {
  return { id: uid('lifter'), name: safeName(name ?? 'You'), createdAt: Date.now() };
}

/**
 * Standings from you plus the cards you hold.
 *
 * Ranked by current streak, then sessions this week - deliberately not by
 * weight lifted or XP alone. Ranking a crew by tonnage just tells you who is
 * heaviest, and tells a beginner they are losing at something they cannot win
 * for two years. Ranking by showing up is a competition anyone can be in on
 * their first day.
 */
export function standings(you, crew, { staleDays = 10, now = Date.now() } = {}) {
  const rows = [
    { ...you, isYou: true },
    ...crew.map((card) => ({ ...card, isYou: false })),
  ].map((row) => ({
    ...row,
    daysOld: Math.floor((now - (row.at ?? now)) / 86400000),
    stale: (now - (row.at ?? now)) / 86400000 > staleDays,
  }));

  rows.sort((a, b) => (
    b.streak - a.streak
    || b.sessions - a.sessions
    || b.level - a.level
    || String(a.name).localeCompare(String(b.name))
  ));

  return rows.map((row, i) => ({ ...row, rank: i + 1 }));
}
