/**
 * Telling someone their training log is at risk, before it is gone.
 *
 * This app has no account and no server, which is the point: nothing to breach,
 * nothing to subscribe to, and the log is genuinely yours. The cost of that is
 * real and has to be said plainly - the data lives in one browser on one
 * device, and clearing site data, switching phone, or leaving it unopened in
 * Safari for long enough takes it with it. (Adding the app to the home screen
 * is what protects it on iOS; a tab is not storage anyone promised to keep.)
 *
 * An app that says this once during setup has told nobody. So the nagging is
 * here, driven by how much unbacked-up work exists rather than by a calendar:
 * losing three sessions is annoying, losing a finished block is the reason
 * people stop using an app.
 */

const DAY = 86400000;

/** Enough logged, or enough time passed, to be worth interrupting for. */
export const NAG_AFTER_SESSIONS = 5;
export const NAG_AFTER_DAYS = 21;
export const URGENT_AFTER_SESSIONS = 14;
export const URGENT_AFTER_DAYS = 60;
export const SNOOZE_DAYS = 7;

/**
 * Whether to ask, and how loudly.
 *
 * `level` is 'none', 'due' or 'urgent'. Sessions are counted since the last
 * export rather than in total, because what matters is how much work is
 * currently only in one place.
 */
export function backupStatus({
  sessions = [],
  lastBackupAt = null,
  snoozedAt = null,
  now = Date.now(),
} = {}) {
  const since = sessions.filter((s) => !lastBackupAt || s.date > lastBackupAt);
  const sessionsSince = since.length;
  const daysSince = lastBackupAt == null ? null : Math.floor((now - lastBackupAt) / DAY);
  const oldestUnsaved = since.length ? Math.min(...since.map((s) => s.date)) : null;
  const daysExposed = oldestUnsaved == null ? 0 : Math.floor((now - oldestUnsaved) / DAY);

  const urgent = sessionsSince >= URGENT_AFTER_SESSIONS
    || (sessionsSince > 0 && daysExposed >= URGENT_AFTER_DAYS);
  const due = sessionsSince >= NAG_AFTER_SESSIONS
    || (sessionsSince > 0 && daysExposed >= NAG_AFTER_DAYS);

  // A snooze quiets the nag but never hides an urgent one: by then there is
  // more at stake than being interrupted.
  const snoozed = snoozedAt != null && now - snoozedAt < SNOOZE_DAYS * DAY;
  const level = urgent ? 'urgent' : (due && !snoozed ? 'due' : 'none');

  return {
    level,
    needed: level !== 'none',
    total: sessions.length,
    sessionsSince,
    daysSince,
    daysExposed,
    neverBackedUp: lastBackupAt == null,
    snoozed,
  };
}

/** The sentence the nag leads with. Counts, not adjectives. */
export function backupLine(status) {
  if (!status?.total) return 'Nothing logged yet — this fills in once you train.';
  if (!status.sessionsSince) return 'Everything logged is backed up.';
  const n = status.sessionsSince;
  const sessions = `${n} session${n === 1 ? '' : 's'}`;
  if (status.neverBackedUp) return `${sessions} exist${n === 1 ? 's' : ''} only on this device.`;
  return `${sessions} logged since your last backup.`;
}

/** A filename that sorts by date and says what it is. */
export function backupFilename(now = Date.now()) {
  const d = new Date(now);
  const pad = (n) => String(n).padStart(2, '0');
  return `ironblock-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}
