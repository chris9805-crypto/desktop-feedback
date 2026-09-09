/**
 * The single-file bundle is a real deliverable, not a convenience script - it
 * is how the app gets handed to someone with nothing installed. A bundler bug
 * produces a page that dies on load with no other symptom, so it gets checked
 * like anything else.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const run = promisify(execFile);
const ROOT = new URL('..', import.meta.url).pathname;

test('the bundle builds, parses, and contains the whole app', async () => {
  await run('node', ['tools/bundle.mjs'], { cwd: ROOT });
  const html = await readFile(join(ROOT, 'dist/ironblock.html'), 'utf8');

  // No module syntax may survive - it would throw at load with nothing else.
  const script = html.slice(html.indexOf('<script type="module">') + 22, html.lastIndexOf('</script>'));
  assert.equal(/^\s*import\s.+from\s/m.test(script), false, 'an import survived bundling');
  assert.equal(/^\s*export\s/m.test(script), false, 'an export survived bundling');

  // It has to actually parse. This is what catches duplicate declarations
  // from two modules that happen to share a private helper name.
  const dir = await mkdtemp(join(tmpdir(), 'ironblock-'));
  const file = join(dir, 'bundle.mjs');
  await writeFile(file, script);
  await run('node', ['--check', file]);

  // And it has to be the whole app, not a truncated graph.
  for (const marker of ['Barbell bench press', 'Push / Pull / Legs', 'Double progression', 'IRONBLOCK', 'setChangeFromFeedback']) {
    assert.ok(html.includes(marker), `bundle is missing "${marker}"`);
  }
  assert.ok(html.includes('--surface-1'), 'bundle is missing the stylesheet');
});
