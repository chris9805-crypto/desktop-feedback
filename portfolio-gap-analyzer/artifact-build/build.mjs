/**
 * Builds the single-file artifact version of Gapline.
 *
 * The published Artifact is one self-contained HTML page: no framework, no
 * routing, no network. It exists because a Next.js static export cannot be
 * published as an artifact — artifact pages are served from a subpath and must
 * reference their files relatively, while Next emits root-absolute asset paths.
 *
 * The engine is shared rather than reimplemented. `entry.ts` re-exports it,
 * esbuild bundles that into one IIFE, and `app.js` is a vanilla-JS interface
 * over the same functions the Next app calls. Analysis logic therefore has
 * exactly one home, and this build inherits every fix made to it.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const core = join(here, "core.js");

execFileSync(
  join(root, "node_modules/.bin/esbuild"),
  [
    join(here, "entry.ts"),
    "--bundle",
    "--format=iife",
    "--global-name=GaplineCore",
    "--minify",
    "--target=es2020",
    `--tsconfig=${join(root, "tsconfig.json")}`,
    `--outfile=${core}`,
  ],
  { stdio: "inherit" },
);

const bundle = readFileSync(core, "utf8");
if (bundle.includes("</script")) {
  throw new Error("bundle contains a script-closing sequence and cannot be inlined safely");
}

const page = [
  readFileSync(join(here, "head.html"), "utf8"),
  '<div id="app"></div>',
  "<script>",
  bundle,
  "</script>",
  "<script>",
  readFileSync(join(here, "app.js"), "utf8"),
  "</script>",
].join("\n");

const out = join(here, "gapline.html");
writeFileSync(out, page);
console.log(`wrote ${out} — ${(page.length / 1024).toFixed(0)}KB`);
