#!/usr/bin/env node
// Coleta todos os feeds e gera public/data/feed.json (+ meta.json) para o app.
//
//   node scripts/build-feed.mjs            coleta e grava
//   node scripts/build-feed.mjs --report   idem, com relatório detalhado por fonte
//
// Estado anterior: reaproveita public/data/feed.json local ou, se não existir,
// PREVIOUS_FEED_URL (no GitHub Actions, o feed já publicado no site).
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCES, COUNTRIES } from '../config/sources.mjs';
import { TOPICS, REGIONS } from '../config/topics.mjs';
import { parseFeed } from '../lib/parse.mjs';
import { toArticle } from '../lib/normalize.mjs';
import { enrichArticles } from '../lib/enrich.mjs';
import { translateArticles } from '../lib/translate.mjs';
import { clusterStories } from '../lib/cluster.mjs';
import { fetchText, fetchPage } from '../lib/http.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'data');
const DEFAULT_MAX_AGE_H = 72;
const MAX_PER_SOURCE = 300;

const log = (...a) => console.log(...a);

async function loadPrevious() {
  try {
    return JSON.parse(await readFile(join(OUT_DIR, 'feed.json'), 'utf8'));
  } catch {}
  const url = process.env.PREVIOUS_FEED_URL;
  if (!url) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (r.ok) return await r.json();
    log(`estado anterior indisponível (${r.status}) em ${url}`);
  } catch (e) {
    log(`estado anterior indisponível: ${e.message}`);
  }
  return null;
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

const laneOf = (sourcesById) => (a) => {
  const b = a.b ?? sourcesById[a.s].bias;
  return b <= -0.25 ? 'e' : b >= 0.25 ? 'd' : 'c';
};

export async function build({ report = false } = {}) {
  const started = Date.now();
  const now = started;
  const sourcesById = Object.fromEntries(SOURCES.map((s) => [s.id, s]));
  const prev = await loadPrevious();
  const prevById = new Map((prev?.articles || []).map((a) => [a.id, { by: [], tp: [], rg: [], x: '', img: '', ...a }]));
  log(`estado anterior: ${prevById.size} matérias`);

  // 1. Coleta
  const jobs = SOURCES.flatMap((source) => source.feeds.map((feed) => ({ source, feed })));
  const results = await pool(jobs, 10, async ({ source, feed }) => {
    const r = await fetchText(feed.url);
    if (!r.ok) return { source, feed, error: r.error || `HTTP ${r.status}`, items: [] };
    try {
      return { source, feed, items: parseFeed(r.text).items };
    } catch (e) {
      return { source, feed, error: `XML inválido: ${e.message.slice(0, 80)}`, items: [] };
    }
  });

  // 2. Normalização + mescla com o estado anterior
  const health = {};
  const byId = new Map();
  for (const { source, feed, items, error } of results) {
    const h = (health[source.id] ||= { feeds: 0, ok: 0, items: 0, errors: [] });
    h.feeds++;
    if (error) { h.errors.push(`${feed.url} → ${error}`); continue; }
    h.ok++;
    const maxAge = (source.maxAgeHours || DEFAULT_MAX_AGE_H) * 3600e3;
    for (const it of items) {
      const a = toArticle(it, feed, source, now);
      if (!a) continue;
      const old = prevById.get(a.id);
      if (!a.d) a.d = old?.d || now; // sem data no feed: hora em que apareceu pela primeira vez
      if (now - a.d > maxAge) continue;
      h.items++;
      const seen = byId.get(a.id);
      if (seen) { // mesma matéria em dois feeds do veículo: une os temas
        seen.tp = [...new Set([...seen.tp, ...a.tp])];
        seen.rg = [...new Set([...seen.rg, ...a.rg])];
        if (a.op) seen.op = 1;
        continue;
      }
      if (old) {
        if (!a.by.length && old.by?.length) a.by = old.by;
        if (!a.img && old.img) a.img = old.img;
        if (old.enr) a.enr = 1;
        // tradução só vale enquanto o texto original for o mesmo
        if (old.tt && old.t === a.t) { a.tt = old.tt; if (old.tx && old.x === a.x) a.tx = old.tx; }
      }
      byId.set(a.id, a);
    }
  }
  // matérias que saíram do RSS mas ainda estão na janela continuam no app
  for (const old of prevById.values()) {
    const src = sourcesById[old.s];
    if (!src || byId.has(old.id)) continue;
    if (now - old.d > (src.maxAgeHours || DEFAULT_MAX_AGE_H) * 3600e3) continue;
    byId.set(old.id, old);
  }

  // Google Notícias às vezes repete o mesmo título com links diferentes; e um veículo
  // pode publicar a mesma matéria em duas URLs. Título igual no mesmo veículo = duplicata.
  const byTitle = new Map();
  for (const a of [...byId.values()].sort((x, y) => y.d - x.d)) {
    const k = `${a.s}|${a.t.toLowerCase()}`;
    if (byTitle.has(k)) byId.delete(a.id);
    else byTitle.set(k, a.id);
  }

  let articles = [...byId.values()].sort((x, y) => y.d - x.d);
  const perSource = {};
  articles = articles.filter((a) => (perSource[a.s] = (perSource[a.s] || 0) + 1) <= MAX_PER_SOURCE);

  // 3. Autor/imagem pela página da matéria (só as novas, com orçamento por rodada)
  if (process.env.SKIP_ENRICH !== '1') {
    await enrichArticles(articles, sourcesById, { fetchPage, budget: Number(process.env.ENRICH_BUDGET || 160), log });
  }
  if (process.env.SKIP_TRANSLATE !== '1') {
    await translateArticles(articles, sourcesById, { budget: Number(process.env.TRANSLATE_BUDGET || 600), log });
  }

  // 4. Mesma pauta, ângulos diferentes
  const lane = laneOf(sourcesById);
  const recent = articles.filter((a) => now - a.d < 30 * 3600e3 && !a.op);
  const stories = [];
  for (const lang of ['pt', 'en']) {
    const group = recent.filter((a) => sourcesById[a.s].lang === lang);
    for (const st of clusterStories(group, lane)) {
      const members = st.ids.map((id) => byId.get(id));
      const br = members.filter((a) => a.tp.includes('politica-br')).length >= members.length / 2;
      stories.push({ ...st, lang, br: br ? 1 : 0 });
    }
  }
  stories.sort((x, y) => y.ids.length - x.ids.length || y.d - x.d);

  // 5. Grava
  // campos vazios não vão para o JSON (o app trata ausência como vazio)
  for (const a of articles) {
    delete a._section;
    for (const k of ['by', 'tp', 'rg']) if (!a[k]?.length) delete a[k];
    for (const k of ['x', 'img', 'tt', 'tx']) if (!a[k]) delete a[k];
  }
  const feed = {
    v: 1,
    updatedAt: now,
    sources: SOURCES.map(({ feeds, ...s }) => ({ ...s, feeds: feeds.length })),
    countries: COUNTRIES,
    topics: TOPICS.map(({ id, label, short }) => ({ id, label, short })),
    regions: REGIONS.map(({ id, label }) => ({ id, label })),
    health: Object.fromEntries(Object.entries(health).map(([id, h]) => [id, { ok: h.ok, feeds: h.feeds, items: h.items }])),
    stories: stories.slice(0, 40),
    articles,
  };
  await mkdir(OUT_DIR, { recursive: true });
  const json = JSON.stringify(feed);
  await writeFile(join(OUT_DIR, 'feed.json.tmp'), json);
  await rename(join(OUT_DIR, 'feed.json.tmp'), join(OUT_DIR, 'feed.json'));
  await writeFile(join(OUT_DIR, 'meta.json'), JSON.stringify({ updatedAt: now, count: articles.length, newest: articles[0]?.id || null }));

  // 6. Relatório
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  log(`\n${articles.length} matérias, ${stories.length} pautas em comum, ${(json.length / 1024).toFixed(0)} kB, ${secs}s`);
  const failed = Object.entries(health).filter(([, h]) => h.errors.length);
  for (const [id, h] of failed) for (const e of h.errors) log(`  ✗ ${id}: ${e}`);
  if (report) {
    log('\nfonte            matérias  c/autor  c/imagem  feeds');
    for (const s of SOURCES) {
      const list = articles.filter((a) => a.s === s.id);
      const pa = list.length ? Math.round((100 * list.filter((a) => a.by?.length).length) / list.length) : 0;
      const pi = list.length ? Math.round((100 * list.filter((a) => a.img).length) / list.length) : 0;
      log(`${s.id.padEnd(16)} ${String(list.length).padStart(8)} ${String(pa + '%').padStart(8)} ${String(pi + '%').padStart(9)}  ${health[s.id].ok}/${health[s.id].feeds}`);
    }
    log('\ntemas:');
    for (const t of TOPICS) log(`  ${t.id.padEnd(14)} ${articles.filter((a) => a.tp?.includes(t.id)).length}`);
    log(`  opinião        ${articles.filter((a) => a.op).length}`);
    log(`  ao vivo        ${articles.filter((a) => a.live).length}`);
    log('\npautas em comum:');
    for (const st of stories.slice(0, 15)) {
      log(`  [${st.lang}${st.br ? ' BR' : ''}] ${st.ids.length} veículos E${st.lanes.e} C${st.lanes.c} D${st.lanes.d} — ${st.title}`);
      for (const id of st.ids) { const a = byId.get(id); log(`        · ${a.s}: ${a.t.slice(0, 110)}`); }
    }
    const en = articles.filter((a) => sourcesById[a.s].lang === 'en');
    log(`\ntraduzidas: ${en.filter((a) => a.tt).length} de ${en.length} matérias em inglês`);
    for (const a of en.filter((a) => a.tt).slice(0, 6)) log(`  ${a.s}: ${a.t}\n     → ${a.tt}${a.tx ? `\n     → ${a.tx.slice(0, 140)}` : ''}`);
    log('\namostra de autores por fonte:');
    for (const s of SOURCES) {
      const ex = articles.filter((a) => a.s === s.id && a.by?.length).slice(0, 3).map((a) => a.by.join(' + '));
      log(`  ${s.id.padEnd(16)} ${ex.join(' | ')}`);
    }
  }
  return feed;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  build({ report: process.argv.includes('--report') }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
