#!/usr/bin/env node
// Coleta todos os feeds e gera public/data/feed.json (+ meta.json) para o app.
//
//   node scripts/build-feed.mjs            coleta e grava
//   node scripts/build-feed.mjs --report   idem, com relatório detalhado por fonte
//
// Estado anterior: reaproveita public/data/feed.json (mais feed-<aba>.json e resumos.json) local ou,
// se não existir, PREVIOUS_FEED_URL (no GitHub Actions, o feed já publicado no site).
//
// Arquivos gerados: feed.json (notícias gerais, o que o app abre primeiro), feed-tecnologia.json e
// feed-cinema.json (matérias só desses temas, baixadas quando o leitor abre a aba) e data/resumos/.
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
import { writeSummaries, tidySummary } from '../lib/summary.mjs';
import { fetchText, fetchPage } from '../lib/http.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'data');
const DEFAULT_MAX_AGE_H = 72;
const MAX_PER_SOURCE = 300;
const DESKS = [...new Set(TOPICS.map((t) => t.desk).filter(Boolean))];
const DESK_OF = Object.fromEntries(TOPICS.filter((t) => t.desk).map((t) => [t.id, t.desk]));

// Matéria só de temas com aba própria vai para o arquivo da aba; com qualquer tema de notícia geral
// (política, economia, guerra...) fica no feed principal.
export function deskOf(a, source) {
  const tp = a.tp || [];
  if (tp.some((t) => !DESK_OF[t])) return '';
  const desks = new Set(tp.map((t) => DESK_OF[t]));
  if (!desks.size) return '';
  if (source?.desk && desks.has(source.desk)) return source.desk;
  return [...desks][0];
}

const log = (...a) => console.log(...a);

async function loadPrevious(name = 'feed.json') {
  try {
    return JSON.parse(await readFile(join(OUT_DIR, name), 'utf8'));
  } catch {}
  const url = process.env.PREVIOUS_FEED_URL?.replace(/feed\.json$/, name);
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
  for (const d of DESKS) {
    const extra = await loadPrevious(`feed-${d}.json`);
    if (prev && extra?.articles) prev.articles.push(...extra.articles);
  }
  const prevSummaries = (await loadPrevious('resumos.json')) || {};
  const prevById = new Map((prev?.articles || []).map((a) => {
    // resumos antigos passam pela limpeza atual; se o texto mudar, a tradução é refeita
    const [raw, rawTr] = prevSummaries[a.id] || [];
    const rs = raw && tidySummary(raw);
    const trs = rs === raw ? rawTr : undefined;
    return [a.id, { by: [], tp: [], rg: [], x: '', img: '', ...a, ...(rs && { rs }), ...(trs && { trs }) }];
  }));
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
        if (old.enr) a.enr = old.enr;
        // tradução só vale enquanto o texto original for o mesmo
        if (old.tt && old.t === a.t) { a.tt = old.tt; if (old.tx && old.x === a.x) a.tx = old.tx; }
        // resumo: fica o mais completo (o da página costuma ganhar do feed)
        if (old.rs && old.rs.length > (a.rs?.length || 0)) a.rs = old.rs;
        if (old.trs && old.rs === a.rs) a.trs = old.trs;
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
  articles = articles.filter((a) => (perSource[a.s] = (perSource[a.s] || 0) + 1) <= (sourcesById[a.s].maxItems || MAX_PER_SOURCE));

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
      // pauta de tecnologia ou cinema aparece na aba dela, não no "Mais cobertas" do Início
      const desk = DESKS.find((d) => members.filter((a) => deskOf(a, sourcesById[a.s]) === d).length > members.length / 2);
      stories.push({ ...st, lang, br: br ? 1 : 0, ...(desk && { dk: desk }) });
    }
  }
  stories.sort((x, y) => y.ids.length - x.ids.length || y.d - x.d);

  // 5. Grava
  // resumos vão para arquivos à parte: o app só baixa quando o leitor abre um
  const summaries = {};
  for (const a of articles) {
    if (a.rs) summaries[a.id] = a.trs ? [a.rs, a.trs] : [a.rs];
    delete a.rs;
    delete a.trs;
  }
  // campos vazios não vão para o JSON (o app trata ausência como vazio)
  for (const a of articles) {
    delete a._section;
    for (const k of ['by', 'tp', 'rg']) if (!a[k]?.length) delete a[k];
    for (const k of ['x', 'img', 'tt', 'tx']) if (!a[k]) delete a[k];
  }
  const byDesk = Object.fromEntries(['', ...DESKS].map((d) => [d, []]));
  for (const a of articles) byDesk[deskOf(a, sourcesById[a.s])].push(a);
  const feed = {
    v: 1,
    updatedAt: now,
    sources: SOURCES.map(({ feeds, titleStrip, maxItems, ...s }) => ({ ...s, feeds: feeds.length })),
    countries: COUNTRIES,
    topics: TOPICS.map(({ id, label, short, desk, parent }) => ({ id, label, short, ...(desk && { desk }), ...(parent && { parent }) })),
    regions: REGIONS.map(({ id, label }) => ({ id, label })),
    desks: DESKS,
    health: Object.fromEntries(Object.entries(health).map(([id, h]) => [id, { ok: h.ok, feeds: h.feeds, items: h.items }])),
    // as pautas de cada aba ficam todas; as gerais, as 40 maiores
    stories: [...stories.filter((st) => !st.dk).slice(0, 40), ...DESKS.flatMap((d) => stories.filter((st) => st.dk === d).slice(0, 12))],
    articles: byDesk[''],
  };
  await mkdir(OUT_DIR, { recursive: true });
  const write = async (name, data) => {
    const text = JSON.stringify(data);
    await writeFile(join(OUT_DIR, `${name}.tmp`), text);
    await rename(join(OUT_DIR, `${name}.tmp`), join(OUT_DIR, name));
    return text;
  };
  // as abas primeiro: quando o feed principal (com o novo updatedAt) aparece, elas já estão prontas
  const deskSizes = {};
  for (const d of DESKS) deskSizes[d] = (await write(`feed-${d}.json`, { v: 1, updatedAt: now, desk: d, articles: byDesk[d] })).length;
  const json = await write('feed.json', feed);
  await writeSummaries(OUT_DIR, summaries);
  await writeFile(join(OUT_DIR, 'meta.json'), JSON.stringify({ updatedAt: now, count: articles.length, newest: articles[0]?.id || null }));

  // 6. Relatório
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  log(`\n${articles.length} matérias, ${stories.length} pautas em comum, ${Object.keys(summaries).length} resumos, ${secs}s`);
  log(`feed.json ${(json.length / 1024).toFixed(0)} kB (${byDesk[''].length} matérias)${DESKS.map((d) => ` · feed-${d}.json ${(deskSizes[d] / 1024).toFixed(0)} kB (${byDesk[d].length})`).join('')}`);
  const failed = Object.entries(health).filter(([, h]) => h.errors.length);
  for (const [id, h] of failed) for (const e of h.errors) log(`  ✗ ${id}: ${e}`);
  if (report) {
    log('\nfonte            matérias  c/autor  c/imagem  c/resumo  feeds');
    const pct = (list, f) => (list.length ? Math.round((100 * list.filter(f).length) / list.length) : 0) + '%';
    for (const s of SOURCES) {
      const list = articles.filter((a) => a.s === s.id);
      log(`${s.id.padEnd(16)} ${String(list.length).padStart(8)} ${pct(list, (a) => a.by?.length).padStart(8)} ${pct(list, (a) => a.img).padStart(9)} ${pct(list, (a) => summaries[a.id] || a.x).padStart(9)}  ${health[s.id].ok}/${health[s.id].feeds}`);
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
    log('\namostra de resumos:');
    for (const s of SOURCES) {
      const a = articles.find((x) => x.s === s.id && summaries[x.id]);
      if (a) log(`  ${s.id.padEnd(16)} ${summaries[a.id][0].slice(0, 160)}${summaries[a.id][1] ? `\n  ${''.padEnd(16)} → ${summaries[a.id][1].slice(0, 160)}` : ''}`);
    }
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
