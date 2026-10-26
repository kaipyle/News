#!/usr/bin/env node
// Servidor local do Mirante: serve o app e atualiza as notícias a cada 10 minutos.
//
//   npm start                 porta 8080, acessível por outros aparelhos da mesma rede
//   PORT=3000 npm start       outra porta
//   DEMO=1 npm start          usa a coleta de exemplo em test/fixtures (sem internet)
import { createServer } from 'node:http';
import { readFile, stat, mkdir, copyFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(ROOT, 'public');
const PORT = Number(process.env.PORT || 8080);
const REFRESH_MIN = Number(process.env.REFRESH_MIN || 10);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon',
};

async function refresh() {
  if (process.env.DEMO === '1') {
    await mkdir(join(PUBLIC, 'data'), { recursive: true });
    await copyFile(join(ROOT, 'test/fixtures/feed.json'), join(PUBLIC, 'data/feed.json'));
    const feed = JSON.parse(await readFile(join(PUBLIC, 'data/feed.json'), 'utf8'));
    const { writeFile } = await import('node:fs/promises');
    await writeFile(join(PUBLIC, 'data/meta.json'), JSON.stringify({ updatedAt: feed.updatedAt, count: feed.articles.length }));
    // a coleta de exemplo não guarda resumos: usa a chamada de cada matéria no lugar
    const { writeSummaries } = await import('./lib/summary.mjs');
    await writeSummaries(join(PUBLIC, 'data'), Object.fromEntries(feed.articles.filter((a) => a.x).map((a) => [a.id, a.tx ? [a.x, a.tx] : [a.x]])));
    console.log('modo demonstração: usando test/fixtures/feed.json');
    return;
  }
  const t = Date.now();
  try {
    const { build } = await import('./scripts/build-feed.mjs');
    const feed = await build();
    console.log(`[${new Date().toLocaleTimeString('pt-BR')}] ${feed.articles.length} matérias atualizadas em ${((Date.now() - t) / 1000).toFixed(0)}s`);
  } catch (e) {
    console.error(`[${new Date().toLocaleTimeString('pt-BR')}] falha na coleta: ${e.message}`);
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    if (path.endsWith('/')) path += 'index.html';
    const file = join(PUBLIC, path);
    if (!file.startsWith(PUBLIC)) { res.writeHead(403).end(); return; }
    const info = await stat(file).catch(() => null);
    if (!info?.isFile()) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Não encontrado'); return; }
    const ext = extname(file);
    let body = await readFile(file);
    const headers = {
      'content-type': TYPES[ext] || 'application/octet-stream',
      'cache-control': path.startsWith('/data/') || ext === '.html' || path === '/sw.js' ? 'no-cache' : 'public, max-age=3600',
    };
    if (/gzip/.test(req.headers['accept-encoding'] || '') && /json|javascript|css|html|svg/.test(headers['content-type'])) {
      body = gzipSync(body);
      headers['content-encoding'] = 'gzip';
    }
    res.writeHead(200, headers).end(body);
  } catch (e) {
    res.writeHead(500).end(String(e.message));
  }
});

const lan = Object.values(networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);

console.log('Mirante: primeira coleta em andamento (leva ~30 s)...');
await refresh();
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\nPronto. Abra no computador:  http://localhost:${PORT}`);
  for (const ip of lan) console.log(`No celular (mesmo Wi-Fi):    http://${ip}:${PORT}`);
  console.log(`\nAs notícias são atualizadas a cada ${REFRESH_MIN} min enquanto este terminal estiver aberto.`);
});
if (process.env.DEMO !== '1') setInterval(refresh, REFRESH_MIN * 60e3);
