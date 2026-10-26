#!/usr/bin/env node
// Testa feeds candidatos antes de entrarem em config/sources.mjs.
//
//   node scripts/probe-feeds.mjs https://exemplo.com/feed/ https://outro.com/rss
//   node scripts/probe-feeds.mjs --file lista.txt      (uma URL por linha; # comenta)
import { readFile } from 'node:fs/promises';
import { fetchText } from '../lib/http.mjs';
import { parseFeed } from '../lib/parse.mjs';
import { stripHtml } from '../lib/text.mjs';

const args = process.argv.slice(2);
let urls = args.filter((a) => /^https?:/.test(a));
const fi = args.indexOf('--file');
if (fi >= 0) {
  const txt = await readFile(args[fi + 1], 'utf8');
  urls.push(...txt.split('\n').map((l) => l.replace(/#.*/, '').trim()).filter(Boolean));
}
if (!urls.length) { console.log('uso: node scripts/probe-feeds.mjs <url> [url...] | --file lista.txt'); process.exit(1); }

const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

for (const url of urls) {
  const r = await fetchText(url);
  if (!r.ok) { console.log(`\n✗ ${url}\n   ${r.error || 'HTTP ' + r.status}`); continue; }
  let feed;
  try { feed = parseFeed(r.text); } catch (e) { console.log(`\n✗ ${url}\n   não é RSS/Atom: ${e.message.slice(0, 80)} | começo: ${r.text.slice(0, 80).replace(/\s+/g, ' ')}`); continue; }
  const items = feed.items;
  const dates = items.map((i) => Date.parse(i.date)).filter(Boolean).sort((a, b) => b - a);
  const desc = items.map((i) => stripHtml(i.description).length);
  const cont = items.map((i) => stripHtml(i.content).length);
  console.log(`\n✓ ${url}${r.url && r.url !== url ? `  (→ ${r.url})` : ''}`);
  console.log(`   "${feed.title}" · ${items.length} itens · mais novo: ${dates[0] ? new Date(dates[0]).toISOString() : 'sem data'} · descrição média ${avg(desc)} car. · conteúdo completo em ${cont.filter((n) => n > 400).length}/${items.length}`);
  for (const it of items.slice(0, 3)) {
    console.log(`   · ${it.title.slice(0, 100)}${it.authors?.length ? `  [${it.authors.join(', ')}]` : ''}`);
  }
  const sample = stripHtml(items[0]?.content || items[0]?.description || '').slice(0, 220);
  if (sample) console.log(`   resumo: ${sample}`);
}
