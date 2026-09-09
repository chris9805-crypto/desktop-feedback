/**
 * The service worker lists the files to cache for offline use. That list is
 * hand-written, which means it rots the moment a module is added - and the
 * symptom is not an error, it is the app failing to open in a gym basement
 * three weeks later. So it is checked against what is actually on disk.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(join(ROOT, dir), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...await walk(path));
    else if (entry.name.endsWith('.js')) out.push(path);
  }
  return out;
}

test('the offline cache lists every module the app loads', async () => {
  const sw = await readFile(join(ROOT, 'sw.js'), 'utf8');
  const listed = new Set([...sw.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]));

  const modules = (await walk('js')).map((p) => p.replace(/^\.\//, ''));
  const missing = modules.filter((m) => !listed.has(m));
  assert.deepEqual(missing, [],
    `sw.js does not cache these, so the app will not open offline: ${missing.join(', ')}`);
});

test('the offline cache does not list files that no longer exist', async () => {
  const sw = await readFile(join(ROOT, 'sw.js'), 'utf8');
  const listed = [...sw.matchAll(/'\.\/([^']+\.(?:js|css|html|webmanifest|png))'/g)].map((m) => m[1]);
  const modules = new Set([...(await walk('js'))]);
  const stale = [];
  for (const entry of listed) {
    if (entry.endsWith('.js') && entry.startsWith('js/') && !modules.has(entry)) stale.push(entry);
  }
  assert.deepEqual(stale, [], `sw.js caches files that are gone: ${stale.join(', ')}`);
});

test('the manifest points at icons that are actually there', async () => {
  const manifest = JSON.parse(await readFile(join(ROOT, 'manifest.webmanifest'), 'utf8'));
  assert.ok(manifest.icons.length >= 2, 'needs at least a normal and a maskable icon');
  for (const icon of manifest.icons) {
    const buf = await readFile(join(ROOT, icon.src));
    // PNG signature - a manifest pointing at an SVG breaks the iOS install.
    assert.equal(buf.subarray(0, 4).toString('hex'), '89504e47', `${icon.src} is not a PNG`);
    assert.ok(buf.length > 200, `${icon.src} looks empty`);
  }
  assert.ok(manifest.icons.some((i) => i.purpose === 'maskable'),
    'Android crops a non-maskable icon into a circle and cuts the artwork');
  assert.equal(manifest.display, 'standalone');
});

test('the page declares what a phone needs to install it', async () => {
  const html = await readFile(join(ROOT, 'index.html'), 'utf8');
  for (const needed of [
    'manifest.webmanifest',
    'apple-touch-icon',
    'apple-mobile-web-app-capable',
    'viewport-fit=cover',        // so safe-area insets work on a notched phone
    'theme-color',
  ]) {
    assert.ok(html.includes(needed), `index.html is missing ${needed}`);
  }
});
