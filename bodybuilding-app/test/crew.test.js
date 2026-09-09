/**
 * Crew codes.
 *
 * A code is text somebody else wrote, arriving via a chat app, going straight
 * onto your screen. It has to be treated as hostile: the tests below are mostly
 * about what happens when it is malformed, oversized, or deliberately nasty.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
};
globalThis.btoa ??= (s) => Buffer.from(s, 'binary').toString('base64');
globalThis.atob ??= (s) => Buffer.from(s, 'base64').toString('binary');

const { store } = await import('../js/store.js');
const {
  buildCard, encodeCard, decodeCard, standings, newProfile, safeName, CODE_PREFIX,
} = await import('../js/engine/crew.js');

beforeEach(() => { memory.clear(); store.reset(); });

const progress = { level: { level: 7 }, xp: 5200, streak: { current: 12 } };
const totals = { sessions: 4, sets: 78 };
const mine = () => buildCard(newProfile('Sam'), progress, totals);

/* ----------------------------------------------------------- round trip */

test('a code survives being pasted through a chat app', () => {
  const card = mine();
  const decoded = decodeCard(encodeCard(card));
  assert.equal(decoded.name, 'Sam');
  assert.equal(decoded.level, 7);
  assert.equal(decoded.streak, 12);
  assert.equal(decoded.sessions, 4);
});

test('whitespace and line breaks in a pasted code are tolerated', () => {
  const code = encodeCard(mine());
  const mangled = `  ${code.slice(0, 20)}\n${code.slice(20)}  `;
  assert.equal(decodeCard(mangled).name, 'Sam');
});

test('a code carries a summary and nothing else', () => {
  // Whatever else is in the log, none of it may end up in a code.
  const card = mine();
  assert.deepEqual(
    Object.keys(card).sort(),
    ['at', 'id', 'level', 'name', 'sessions', 'sets', 'streak', 'v', 'xp'],
  );
  const json = JSON.stringify(card);
  for (const leak of ['entries', 'weight', 'bodyweight', 'feedback', 'mesoId']) {
    assert.ok(!json.includes(leak), `a code should never contain ${leak}`);
  }
});

/* ------------------------------------------------------ hostile input */

test('junk is refused with something a person can act on', () => {
  for (const bad of ['', 'hello', 'IB1-', 'IB1-!!!!', `${CODE_PREFIX}-${btoa('not json')}`]) {
    assert.throws(() => decodeCard(bad), (err) => {
      assert.ok(err.message.length > 20, 'the error should explain what to do');
      return true;
    }, `"${bad}" should be refused`);
  }
});

test('a code cannot put markup on your screen', () => {
  const nasty = encodeCard({ ...mine(), name: '<img src=x onerror=alert(1)>' });
  const decoded = decodeCard(nasty);
  assert.ok(!decoded.name.includes('<'));
  assert.ok(!decoded.name.includes('>'));
  assert.ok(!decoded.name.includes('='));
});

test('a code cannot claim absurd numbers', () => {
  const inflated = encodeCard({
    ...mine(), level: 999999, xp: Number.MAX_SAFE_INTEGER, streak: 1e9, sessions: 5000, sets: 999999,
  });
  const decoded = decodeCard(inflated);
  assert.ok(decoded.level <= 60);
  assert.ok(decoded.streak <= 9999);
  assert.ok(decoded.sessions <= 100);
  assert.ok(decoded.sets <= 5000);
});

test('a code cannot claim a name of unbounded length', () => {
  const decoded = decodeCard(encodeCard({ ...mine(), name: 'A'.repeat(5000) }));
  assert.ok(decoded.name.length <= 24);
});

test('NaN and nulls become sane defaults rather than blanks on screen', () => {
  const decoded = decodeCard(encodeCard({ ...mine(), level: null, streak: 'lots', sessions: undefined }));
  assert.equal(decoded.level, 1);
  assert.equal(decoded.streak, 0);
  assert.equal(decoded.sessions, 0);
});

test('names in any script survive, apostrophes included', () => {
  assert.equal(safeName('Björn'), 'Björn');
  assert.equal(safeName('O’Neill'), 'O’Neill');
  assert.equal(safeName("O'Neill"), "O'Neill");
  assert.equal(safeName('大輔'), '大輔');
  assert.equal(safeName('   '), 'Anonymous', 'never render an empty name');
  assert.equal(safeName(null), 'Anonymous');
});

/* -------------------------------------------------------- standings */

test('standings rank by showing up, not by how much you lift', () => {
  // Ranking a crew by weight lifted just tells you who is heaviest, and tells a
  // beginner they are losing at something they cannot win for two years.
  const you = { name: 'You', level: 2, xp: 400, streak: 9, sessions: 4, at: Date.now() };
  const strong = { id: 'a', name: 'Strong', level: 30, xp: 90000, streak: 2, sessions: 1, at: Date.now() };
  const rows = standings(you, [strong]);
  assert.equal(rows[0].name, 'You');
  assert.equal(rows[0].rank, 1);
  assert.equal(rows[1].name, 'Strong');
});

test('you are always in your own standings, even alone', () => {
  const rows = standings({ name: 'You', level: 1, streak: 0, sessions: 0 }, []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].isYou, true);
});

test('a stale card is marked rather than silently trusted', () => {
  const you = { name: 'You', level: 3, streak: 1, sessions: 1, at: Date.now() };
  const old = { id: 'a', name: 'Ghost', level: 9, streak: 40, sessions: 6, at: Date.now() - 40 * 86400000 };
  const rows = standings(you, [old]);
  const ghost = rows.find((r) => r.name === 'Ghost');
  assert.equal(ghost.stale, true);
  assert.ok(ghost.daysOld >= 39);
});

/* ------------------------------------------------------------- store */

test('nothing is shared until you make a profile', () => {
  assert.equal(store.profile(), null);
  assert.deepEqual(store.state.settings.crew, []);
});

test('adding someone twice updates them instead of duplicating them', () => {
  store.setProfileName('Sam');
  const friend = newProfile('Alex');
  store.addCrewCode(encodeCard(buildCard(friend, progress, { sessions: 2, sets: 30 })));
  store.addCrewCode(encodeCard(buildCard(friend, { ...progress, streak: { current: 20 } }, { sessions: 5, sets: 70 })));
  assert.equal(store.state.settings.crew.length, 1);
  assert.equal(store.state.settings.crew[0].streak, 20, 'the newer card wins');
});

test('your own code is refused rather than listing you twice', () => {
  store.setProfileName('Sam');
  assert.throws(() => store.addCrewCode(encodeCard(store.myCard())), /your own code/i);
});

test('a crew member can be removed', () => {
  store.setProfileName('Sam');
  const card = store.addCrewCode(encodeCard(buildCard(newProfile('Alex'), progress, totals)));
  assert.equal(store.state.settings.crew.length, 1);
  store.removeCrew(card.id);
  assert.equal(store.state.settings.crew.length, 0);
});

test('the profile name is sanitised on the way in too', () => {
  store.setProfileName('<script>bad</script>');
  assert.ok(!store.profile().name.includes('<'));
});
