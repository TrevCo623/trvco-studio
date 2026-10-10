// Tiny zero-dependency dev server: serves files and falls back to index.html for app routes,
// so deep links like /type/oxomoco work on reload (same as _redirects does on Netlify).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT) || 8080;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.otf': 'font/otf', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(root, path);
  try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); }
  catch { file = extname(path) ? null : join(root, 'index.html'); }
  if (!file) { res.writeHead(404); return res.end('Not found'); }
  try { res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(await readFile(file)); }
  catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, () => console.log(`trvco.studio running at http://localhost:${port}`));
