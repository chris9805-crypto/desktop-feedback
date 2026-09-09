/** Zero-dependency static server, so `npm start` just works. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = Number(process.env.PORT ?? 8080);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname === '/' ? '/index.html' : url.pathname;
  const target = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ''));
  if (!target.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }
  try {
    const body = await readFile(target);
    res.writeHead(200, { 'Content-Type': TYPES[extname(target)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
}).listen(PORT, () => console.log(`IronBlock running at http://localhost:${PORT}`));
