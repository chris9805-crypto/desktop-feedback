/**
 * Bundle the app into one self-contained HTML file.
 *
 * There is no build step in normal use - the app runs from source as ES
 * modules. This exists so the whole thing can be handed over as a single file
 * that opens from a phone, a USB stick or a chat message with nothing
 * installed.
 *
 * Each module is wrapped in its own function scope and returns its exports, so
 * two modules are free to define a private helper of the same name. (Flat
 * concatenation looks simpler and works until the day two views both define a
 * `stat` helper, at which point the whole page dies on a duplicate
 * declaration.) Imports become destructuring from the already-evaluated
 * module object, which is why modules are emitted in dependency order.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY = resolve(ROOT, 'js/app.js');
const OUT = resolve(ROOT, 'dist/ironblock.html');

// Static, relative imports only - which is all this codebase uses.
const IMPORT_RE = /^[ \t]*import\s+([\s\S]*?)\s*from\s*['"](\.[^'"]+)['"];?[ \t]*$/gm;

const modules = new Map();   // absolute path -> { source, deps, exports }
const order = [];

function moduleVar(file) {
  return `__m_${relative(ROOT, file).replace(/[^a-zA-Z0-9]/g, '_')}`;
}

function parseImports(source) {
  const out = [];
  IMPORT_RE.lastIndex = 0;
  let m;
  while ((m = IMPORT_RE.exec(source))) out.push({ clause: m[1].trim(), spec: m[2], raw: m[0] });
  return out;
}

function parseExports(source) {
  const names = new Set();
  for (const m of source.matchAll(/^export\s+(?:async\s+)?function\s+(\w+)/gm)) names.add(m[1]);
  for (const m of source.matchAll(/^export\s+class\s+(\w+)/gm)) names.add(m[1]);
  for (const m of source.matchAll(/^export\s+(?:const|let|var)\s+(\w+)/gm)) names.add(m[1]);
  for (const m of source.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (name) names.add(name);
    }
  }
  return [...names];
}

async function walk(file) {
  if (modules.has(file)) return;
  const source = await readFile(file, 'utf8');
  const imports = parseImports(source);
  modules.set(file, { source, imports, exports: parseExports(source) });
  for (const imp of imports) await walk(resolve(dirname(file), imp.spec));
  order.push(file);        // dependencies first
}

function emit(file) {
  const mod = modules.get(file);
  let body = mod.source;

  // Replace each import with a destructure from the dependency's module object.
  for (const imp of mod.imports) {
    const dep = moduleVar(resolve(dirname(file), imp.spec));
    let line;
    const ns = imp.clause.match(/^\*\s+as\s+(\w+)$/);
    if (ns) {
      line = `const ${ns[1]} = ${dep};`;
    } else {
      const named = imp.clause.match(/\{([\s\S]*)\}/);
      // `import { listen as listenForInstall }` becomes `const { listen: listenForInstall }`
      // - destructuring renames with a colon, not `as`.
      line = named ? `const {${named[1].replace(/\b(\w+)\s+as\s+(\w+)/g, '$1: $2')}} = ${dep};` : '';
    }
    body = body.replace(imp.raw, line);
  }

  body = body
    .replace(/^export\s+(?=(?:async\s+)?(?:const|let|var|function|class)\b)/gm, '')
    .replace(/^export\s*\{[^}]*\};?[ \t]*$/gm, '');

  const returns = mod.exports.length ? `\n  return { ${mod.exports.join(', ')} };\n` : '\n';
  return `/* ===== ${relative(ROOT, file)} ===== */\n` +
    `const ${moduleVar(file)} = (() => {\n${body}${returns}})();\n`;
}

await walk(ENTRY);

const chunks = order.map(emit);
const css = await readFile(resolve(ROOT, 'css/app.css'), 'utf8');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>IronBlock</title>
<meta name="description" content="Structured, progressive bodybuilding programs with autoregulated load and volume.">
<meta name="color-scheme" content="light dark">
<style>${css}</style>
</head>
<body>
<noscript><p style="padding:24px;font-family:system-ui">IronBlock needs JavaScript - it runs entirely in your browser with no server behind it.</p></noscript>
<script type="module">
${chunks.join('\n')}
</script>
</body>
</html>
`;

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, html);
console.log(`Bundled ${order.length} modules -> ${relative(ROOT, OUT)} (${Math.round(html.length / 1024)} KB)`);
