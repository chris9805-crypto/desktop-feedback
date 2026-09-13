/**
 * The backup nag. Wrong in either direction is bad: silent means someone loses
 * a block, constant means they learn to tap past it.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  backupStatus, backupLine, backupFilename, NAG_AFTER_SESSIONS, SNOOZE_DAYS,
} from '../js/engine/backup.js';

const DAY = 86400000;
const NOW = Date.UTC(2026, 0, 31, 12);
const daysAgo = (n) => NOW - n * DAY;
const sessions = (...dates) => dates.map((d, i) => ({ id: `s${i}`, date: d }));

test('a fresh log is not nagged about', () => {
  const status = backupStatus({ sessions: [], now: NOW });
  assert.equal(status.level, 'none');
  assert.ok(!status.needed);
  assert.equal(status.sessionsSince, 0);
});

test('a couple of sessions is not enough to interrupt for', () => {
  const status = backupStatus({ sessions: sessions(daysAgo(2), daysAgo(4)), now: NOW });
  assert.equal(status.level, 'none');
});

test('a block’s worth of unsaved work asks', () => {
  const dates = Array.from({ length: NAG_AFTER_SESSIONS }, (_, i) => daysAgo(i + 1));
  const status = backupStatus({ sessions: sessions(...dates), now: NOW });
  assert.equal(status.level, 'due');
  assert.equal(status.sessionsSince, NAG_AFTER_SESSIONS);
  assert.ok(status.neverBackedUp);
});

test('only work logged since the last backup counts', () => {
  const status = backupStatus({
    sessions: sessions(daysAgo(40), daysAgo(38), daysAgo(36), daysAgo(34), daysAgo(32), daysAgo(2)),
    lastBackupAt: daysAgo(10),
    now: NOW,
  });
  assert.equal(status.sessionsSince, 1);
  assert.equal(status.level, 'none');
  assert.equal(status.daysSince, 10);
});

test('one session sitting unsaved for a month asks even though it is only one', () => {
  const status = backupStatus({ sessions: sessions(daysAgo(30)), lastBackupAt: daysAgo(40), now: NOW });
  assert.equal(status.level, 'due');
});

test('time alone with nothing new logged never asks', () => {
  // Someone who stopped training for a year has nothing at risk they have not
  // already saved, and being nagged on their way back in is the wrong welcome.
  const status = backupStatus({ sessions: sessions(daysAgo(400)), lastBackupAt: daysAgo(390), now: NOW });
  assert.equal(status.level, 'none');
});

test('dismissing quiets it for a week, then it comes back', () => {
  const dates = Array.from({ length: 6 }, (_, i) => daysAgo(i + 1));
  const base = { sessions: sessions(...dates), now: NOW };
  assert.equal(backupStatus({ ...base, snoozedAt: daysAgo(1) }).level, 'none');
  assert.equal(backupStatus({ ...base, snoozedAt: daysAgo(SNOOZE_DAYS + 1) }).level, 'due');
});

test('a dismissal does not hide an urgent one', () => {
  const dates = Array.from({ length: 20 }, (_, i) => daysAgo(i + 1));
  const status = backupStatus({ sessions: sessions(...dates), snoozedAt: daysAgo(1), now: NOW });
  assert.equal(status.level, 'urgent');
  assert.ok(status.needed);
});

test('the line counts rather than scolds', () => {
  // An empty log is not the same as a saved one, and saying "backed up" to
  // someone who has never trained reads as a bug.
  assert.match(backupLine({ total: 0, sessionsSince: 0 }), /Nothing logged yet/);
  assert.equal(backupLine({ total: 4, sessionsSince: 0 }), 'Everything logged is backed up.');
  assert.equal(backupLine({ total: 1, sessionsSince: 1, neverBackedUp: true }), '1 session exists only on this device.');
  assert.equal(backupLine({ total: 9, sessionsSince: 6, neverBackedUp: false }), '6 sessions logged since your last backup.');
});

test('the filename sorts by date and says what it is', () => {
  assert.match(backupFilename(Date.UTC(2026, 8, 4, 12)), /^ironblock-2026-09-0\d\.json$/);
});
