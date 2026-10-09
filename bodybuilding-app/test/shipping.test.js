/**
 * The things that have to be true before strangers use this.
 *
 * Not training logic - paperwork. The kind of thing that is correct the day it
 * is written and quietly wrong six months later, which is exactly what a test
 * is for.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { APP_VERSION } from '../js/version.js';

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), 'utf8');

const pkg = JSON.parse(await read('package.json'));
const privacy = await read('privacy.html');
const support = await read('support.html');
const manifest = JSON.parse(await read('manifest.webmanifest'));
const sw = await read('sw.js');
const settings = await read('js/ui/views/settings.js');
const onboarding = await read('js/ui/views/onboarding.js');

test('the version the app reports is the version that was released', () => {
  assert.equal(APP_VERSION, pkg.version);
});

test('the pages people are sent to actually exist and are cached offline', () => {
  // Linked from inside the app, so they have to survive a gym with no signal.
  for (const page of ['./privacy.html', './support.html']) {
    assert.ok(sw.includes(`'${page}'`), `${page} is not in the offline cache`);
  }
});

test('both pages are real documents rather than stubs', () => {
  for (const [name, page] of [['privacy', privacy], ['support', support]]) {
    assert.match(page, /<!doctype html>/i, `${name} is not a document`);
    assert.match(page, /<title>[^<]+<\/title>/, `${name} has no title`);
    assert.match(page, /name="viewport"/, `${name} will not fit a phone`);
    assert.ok(page.includes('css/app.css'), `${name} does not use the app's styling`);
    assert.ok(page.includes('href="./index.html"'), `${name} has no way back to the app`);
    assert.ok(page.length > 2000, `${name} is too short to be a real page`);
  }
});

test('the privacy policy makes the claims the app actually honours', () => {
  // Each of these is a promise the code keeps: no backend, no analytics, local
  // storage only. If one stops being true, the policy becomes a lie.
  for (const claim of ['no account', 'analytics', 'local storage', 'GitHub Pages']) {
    assert.ok(privacy.toLowerCase().includes(claim.toLowerCase()),
      `the policy does not mention ${claim}`);
  }
  // Hosting logging is disclosed rather than glossed over.
  assert.ok(/IP address/i.test(privacy), 'the policy does not disclose request logging');
});

test('the health disclaimer is somewhere people will actually meet it', () => {
  // On the support page, in Settings, and once during setup - before anybody
  // has been told what to lift.
  assert.ok(/not medical advice/i.test(support), 'the support page has no disclaimer');
  assert.ok(/not medical advice/i.test(settings), 'Settings has no disclaimer');
  assert.ok(/not medical advice/i.test(onboarding), 'setup never mentions it');
});

test('the support page answers the questions that lose people their data', () => {
  for (const topic of ['Add to Home Screen', 'backup', 'Restore from a file']) {
    assert.ok(support.includes(topic), `support does not cover "${topic}"`);
  }
});

test('nobody is sent to a page that does not exist', async () => {
  // Relative links only - the app is served from a subpath on GitHub Pages, so
  // an absolute path would 404 for everyone.
  const linked = [...settings.matchAll(/href: '(\.\/[^']+)'/g)].map((m) => m[1]);
  assert.ok(linked.length >= 2, 'Settings links to neither page');
  for (const href of linked) {
    await assert.doesNotReject(read(href.replace('./', '')), `${href} is linked but missing`);
  }
});

test('the manifest stays relative so a subpath install works', () => {
  assert.ok(manifest.start_url.startsWith('.'), 'start_url is not relative');
  assert.ok(manifest.scope.startsWith('.'), 'scope is not relative');
  for (const icon of manifest.icons) {
    assert.ok(!icon.src.startsWith('/'), `${icon.src} is an absolute path`);
  }
});
