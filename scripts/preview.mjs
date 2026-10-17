import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import site from '../site.config.json' with { type: 'json' };
const basePath = site.basePath;

const output = path.resolve('out');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.woff2': 'font/woff2', '.png': 'image/png', '.woff': 'font/woff' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === basePath) { res.writeHead(308, { Location: basePath + '/' }); res.end(); return; }
  if (!url.pathname.startsWith(basePath + '/')) { res.writeHead(404); res.end('Not found'); return; }
  let file = path.resolve(output, '.' + decodeURIComponent(url.pathname.slice(basePath.length)));
  if (file !== output && !file.startsWith(output + path.sep)) { res.writeHead(404); res.end(); return; }
  try {
    const info = await stat(file);
    if (info.isDirectory()) file = path.join(file, 'index.html');
    else if (url.pathname.endsWith('/')) { res.writeHead(404); res.end('Not found'); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(4173, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:4173${basePath}/`));
