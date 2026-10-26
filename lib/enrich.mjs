// Completa autor e imagem lendo os metadados da própria página da matéria
// (JSON-LD, <meta name="author">, og:image). Só roda para matérias novas sem autor.
import { clean, decodeEntities } from './text.mjs';
import { cleanAuthors, canonicalImage } from './normalize.mjs';

const ARTICLE_TYPES = /^(NewsArticle|Article|ReportageNewsArticle|AnalysisNewsArticle|OpinionNewsArticle|BackgroundNewsArticle|BlogPosting|LiveBlogPosting|WebPage|ReviewNewsArticle)$/;

function* walk(node) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const n of node) yield* walk(n); return; }
  yield node;
  if (node['@graph']) yield* walk(node['@graph']);
  if (node.mainEntity) yield* walk(node.mainEntity);
}

const names = (a) => {
  if (!a) return [];
  if (typeof a === 'string') return [a];
  if (Array.isArray(a)) return a.flatMap(names);
  if (typeof a === 'object' && a['@type'] !== 'Organization' && a['@type'] !== 'NewsMediaOrganization') return names(a.name);
  if (typeof a === 'object') return ['Redação'];
  return [];
};
const image = (i) => (typeof i === 'string' ? i : Array.isArray(i) ? image(i[0]) : i?.url || i?.contentUrl || '');

const meta = (html, key) => {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${key}["'][^>]*>`, 'i');
  const tag = html.match(re)?.[0];
  return tag ? decodeEntities(tag.match(/content=["']([^"']*)["']/i)?.[1] || '') : '';
};

export function extractMeta(html) {
  const out = { authors: [], image: '' };
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data;
    try { data = JSON.parse(m[1].trim()); } catch { continue; }
    for (const node of walk(data)) {
      const type = [].concat(node['@type'] || []).find((t) => ARTICLE_TYPES.test(t));
      if (!type) continue;
      if (!out.authors.length) out.authors = names(node.author).map(clean).filter(Boolean);
      if (!out.image) out.image = image(node.image);
    }
  }
  if (!out.authors.length) {
    const byl = meta(html, 'byl') || meta(html, 'author') || meta(html, 'parsely-author') || meta(html, 'sailthru.author') || meta(html, 'dc.creator');
    if (byl && !/^https?:/.test(byl)) out.authors = [byl];
  }
  if (!out.authors.length) {
    // g1 e demais sites da Globo: "Por Fulano, g1 — Brasília"
    const g = html.match(/class="content-publication-data__from"[^>]*>([\s\S]*?)<\/p>/i)?.[1];
    if (g) out.authors = [clean(g.replace(/<[^>]+>/g, ' ')).replace(/^por\s+/i, '').replace(/\s+[—–-]\s+.*$/, '')];
  }
  if (!out.image) out.image = meta(html, 'og:image') || meta(html, 'twitter:image');
  return out;
}

export async function enrichArticles(articles, sourcesById, { fetchPage, budget = 150, concurrency = 8, log = () => {} }) {
  const queue = articles.filter((a) => {
    const src = sourcesById[a.s];
    return !a.enr && !src.googleNews && !src.noBylines && (!a.by.length || !a.img);
  }).slice(0, budget);
  const failures = {};
  let done = 0, gotAuthor = 0, gotImage = 0;

  async function work() {
    while (queue.length) {
      const a = queue.shift();
      if ((failures[a.s] || 0) >= 3) continue; // site bloqueando: tenta de novo na próxima rodada
      const res = await fetchPage(a.u);
      if (!res.ok) { failures[a.s] = (failures[a.s] || 0) + 1; continue; }
      a.enr = 1;
      done++;
      const m = extractMeta(res.text);
      if (!a.by.length && m.authors.length) {
        a.by = cleanAuthors(m.authors, sourcesById[a.s]);
        if (a.by.length) gotAuthor++;
      }
      if (!a.img && m.image && !/logo|placeholder|default|meta-image/i.test(m.image)) { a.img = canonicalImage(m.image); gotImage++; }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, work));
  log(`enriquecimento: ${done} páginas lidas, +${gotAuthor} autores, +${gotImage} imagens; bloqueios: ${JSON.stringify(failures)}`);
}
