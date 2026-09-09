/**
 * Generate the app icons.
 *
 * A home-screen icon has to be a real PNG - SVG is not accepted for the iOS
 * touch icon and is patchy for maskable icons elsewhere. Rather than add an
 * image library for four flat rectangles, this writes the PNGs directly:
 * zlib is in Node already, and a PNG is little more than a CRC, a header and
 * some deflated scanlines.
 *
 *   node tools/icons.mjs
 */

import { deflateSync } from 'node:zlib';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const INK = [17, 17, 16];        // --surface-0 dark
const ACCENT = [57, 135, 229];   // --series-1 dark

/* ------------------------------------------------------------------ PNG */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  const body = out.subarray(4, 8 + data.length);
  out.writeUInt32BE(crc32(body), 8 + data.length);
  return out;
}

/** @param {(x:number,y:number)=>number[]} shade RGB for a pixel */
function png(size, shade) {
  const stride = size * 3;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (stride + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = shade(x, y);
      raw[row + 1 + x * 3] = r;
      raw[row + 2 + x * 3] = g;
      raw[row + 3 + x * 3] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ----------------------------------------------------------------- art */

/** A barbell, in units of the 1000-wide design grid. */
const BARBELL = [
  { x: [215, 785], y: [478, 522] },   // bar
  { x: [285, 355], y: [370, 630] },   // inner plates
  { x: [645, 715], y: [370, 630] },
  { x: [200, 262], y: [420, 580] },   // outer plates
  { x: [738, 800], y: [420, 580] },
];

function draw(size, { inset = 0, corner = 0 } = {}) {
  const scale = size / 1000;
  const shapes = BARBELL.map((s) => ({
    x: [s.x[0], s.x[1]].map((v) => (v - 500) * (1 - inset) * scale + size / 2),
    y: [s.y[0], s.y[1]].map((v) => (v - 500) * (1 - inset) * scale + size / 2),
  }));
  const r = corner * size;

  return (x, y) => {
    if (r > 0 && outsideRoundedCorner(x + 0.5, y + 0.5, size, r)) return [255, 255, 255];
    for (const s of shapes) {
      if (x >= s.x[0] && x < s.x[1] && y >= s.y[0] && y < s.y[1]) return ACCENT;
    }
    return INK;
  };
}

function outsideRoundedCorner(x, y, size, r) {
  const cx = x < r ? r : x > size - r ? size - r : x;
  const cy = y < r ? r : y > size - r ? size - r : y;
  return (x - cx) ** 2 + (y - cy) ** 2 > r * r;
}

/* --------------------------------------------------------------- write */

await mkdir(resolve(ROOT, 'icons'), { recursive: true });

const outputs = [
  // Rounded, for platforms that show the icon as supplied.
  ['icons/icon-192.png', 192, { corner: 0.18 }],
  ['icons/icon-512.png', 512, { corner: 0.18 }],
  ['icons/apple-touch-icon.png', 180, { corner: 0 }],
  // Maskable: full bleed, artwork pulled into the safe zone so a circular
  // or squircle mask cannot crop the barbell.
  ['icons/icon-maskable-512.png', 512, { inset: 0.34 }],
];

for (const [file, size, opts] of outputs) {
  const buf = png(size, draw(size, opts));
  await writeFile(resolve(ROOT, file), buf);
  console.log(`${file}  ${size}×${size}  ${(buf.length / 1024).toFixed(1)} KB`);
}
