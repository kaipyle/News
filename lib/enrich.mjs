// Completa autor, imagem e resumo lendo a própria página da matéria
// (JSON-LD, <meta name="author">, og:image, og:description e primeiros parágrafos).
// Só roda para matérias que ainda não passaram por aqui e têm algo faltando.
import { clean, decodeEntities, stripHtml } from './text.mjs';
import { cleanAuthors, canonicalImage } from './normalize.mjs';
import { clipSummary, composeSummary, ledeFromHtml } from './summary.mjs';

// Versão do enriquecimento: matérias lidas por uma versão anterior (sem resumo) são relidas uma vez.
export const ENRICH_VERSION = 2;

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
  const out = { authors: [], image: '', description: '', lede: '' };
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data;
    try { data = JSON.parse(m[1].trim()); } catch { continue; }
    for (const node of walk(data)) {
      const type = [].concat(node['@type'] || []).find((t) => ARTICLE_TYPES.test(t));
      if (!type) continue;
      if (!out.authors.length) out.authors = names(node.author).map(clean).filter(Boolean);
      if (!out.image) out.image = image(node.image);
      if (!out.description && typeof node.description === 'string') out.description = stripHtml(node.description);
      if (!out.lede && typeof node.articleBody === 'string' && node.articleBody.length > 200) {
        out.lede = clipSummary(stripHtml(node.articleBody), 600);
      }
    }
  }
  if (!out.description) out.description = meta(html, 'og:description') || meta(html, 'description') || meta(html, 'twitter:description');
  if (!out.lede) out.lede = ledeFromHtml(html);
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
  // da mais nova para a mais antiga; o orçamento conta só as páginas de fato pedidas
  const queue = articles.filter((a) => {
    const src = sourcesById[a.s];
    if ((a.enr || 0) >= ENRICH_VERSION || src.googleNews) return false;
    return (!a.by.length && !src.noBylines) || !a.img || !a.rs || a.rs.length < 300;
  });
  const failures = {};
  let tried = 0, done = 0, gotAuthor = 0, gotImage = 0, gotSummary = 0;

  async function work() {
    while (queue.length && tried < budget) {
      const a = queue.shift();
      if ((failures[a.s] || 0) >= 3) continue; // site bloqueando: tenta de novo na próxima rodada
      tried++;
      const res = await fetchPage(a.u);
      if (!res.ok) { failures[a.s] = (failures[a.s] || 0) + 1; continue; }
      a.enr = ENRICH_VERSION;
      done++;
      const m = extractMeta(res.text);
      if (!a.by.length && m.authors.length && !sourcesById[a.s].noBylines) {
        a.by = cleanAuthors(m.authors, sourcesById[a.s]);
        if (a.by.length) gotAuthor++;
      }
      if (!a.img && m.image && !/logo|placeholder|default|meta-image/i.test(m.image)) { a.img = canonicalImage(m.image); gotImage++; }
      const rs = composeSummary({ description: m.description, lede: m.lede, title: a.t });
      if (rs.length > Math.max(a.rs?.length || 0, a.x?.length || 0) + 20) {
        a.rs = rs;
        delete a.trs; // a tradução era de outro texto
        gotSummary++;
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, work));
  log(`enriquecimento: ${done} páginas lidas de ${tried} pedidas, +${gotAuthor} autores, +${gotImage} imagens, +${gotSummary} resumos; bloqueios: ${JSON.stringify(failures)}`);
}
