/* A static server that behaves like GitHub Pages for measurements: gzip (no brotli), Cache-Control max-age=600. Serves ./dist. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.webp': 'image/webp' };
const GZ = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.svg', '.ttf']);
export function serveDist(port, dist = path.resolve(process.cwd(), process.env.DIST_DIR || 'dist')) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(dist, p); if (!f.startsWith(dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
    const ext = path.extname(f); let body = fs.readFileSync(f); const h = { 'content-type': TYPES[ext] || 'application/octet-stream', 'cache-control': 'public, max-age=600' };
    if (GZ.has(ext) && /gzip/.test(req.headers['accept-encoding'] || '')) { body = zlib.gzipSync(body); h['content-encoding'] = 'gzip'; }
    h['content-length'] = body.length; res.writeHead(200, h); res.end(body);
  }).listen(port);
  return { base: `http://127.0.0.1:${port}/`, close: () => server.close() };
}
