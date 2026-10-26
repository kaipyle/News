// Transforma itens crus de feed em matérias do Mirante: URL canônica, autores, resumo,
// temas, regiões, opinião e "ao vivo".
import { createHash } from 'node:crypto';
import { TOPICS, REGIONS, SECTION_TOPICS, URL_SECTIONS, EXCLUDE_URL } from '../config/topics.mjs';
import { clean, fold, stripHtml, truncate, wordsRegex } from './text.mjs';
import { parseDate } from './parse.mjs';
import { composeSummary, ledeFromHtml } from './summary.mjs';

const TRACKING = /^(utm_\w+|at_\w+|cmpid|fbclid|gclid|ref|smid|partner|emc|mod|traffic_source|ito|xtor|ns_\w+|origin|rss|feed|sh|src|syn-[\w-]+|mc_\w+|cid|ocid)$/i;

export function canonicalUrl(raw) {
  let u = clean(raw);
  if (!u) return '';
  // Folha: https://redir.folha.com.br/redir/online/poder/rss091/*https://www1.folha.uol.com.br/...
  const redir = u.match(/redir\.folha\.com\.br\/redir\/[^*]*\*(https?:\/\/.+)$/i);
  if (redir) u = redir[1];
  try {
    const url = new URL(u);
    if (url.hostname === 'news.google.com') return url.toString();
    url.protocol = 'https:';
    url.hash = '';
    for (const k of [...url.searchParams.keys()]) if (TRACKING.test(k)) url.searchParams.delete(k);
    return url.toString();
  } catch {
    return '';
  }
}

export const articleId = (key) => createHash('sha1').update(key).digest('base64url').slice(0, 11);

const HOUSE = /^(da\s+)?(reda[cç][aã]o|equipe|staff|editorial|editores|editors)\b/i;

const outletRx = new Map();
const outletName = (source) => {
  if (!outletRx.has(source.id)) outletRx.set(source.id, wordsRegex([source.name, source.short]));
  return outletRx.get(source.id);
};

// Normaliza a assinatura. Devolve lista de nomes; "Redação" quando o texto é da casa.
export function cleanAuthors(rawList, source) {
  const names = [];
  for (let raw of rawList) {
    raw = clean(raw)
      .replace(/\s*\((now|earlier|later|agora|antes)\)/gi, '')
      .replace(/\s+\d{1,2}\/\d{1,2}\/\d{2,4}\b.*$/, '') // O Globo: "Fulano 26/10/2026 12h51 Atualizado.."
      .replace(/^(by|por|de)\s+/i, '')
      .replace(/\s+(in|em|from)\s+[A-ZÀ-Ú][^,;]*$/, '') // "Tom Phillips in Rio de Janeiro"
      .replace(/\s*[-–—|·]\s*(rep[oó]rter|correspondente|enviad[oa] especial|colunista|da|do|de)\b.*$/i, '')
      .replace(/,\s*(g1|ge|tv globo|globonews|o globo|valor|para a bbc.*|da bbc.*|bbc news.*|de bras[ií]lia|de s[aã]o paulo|do rio)\b.*$/i, '')
      .replace(/\s*\((?:[^)]*)\)\s*$/, '')
      .trim();
    if (!raw) continue;
    for (let n of raw.split(/\s*(?:,|;|\s&\s|\se\s|\sand\s)\s*/i)) {
      n = n.trim();
      if (!n || n.length < 3 || n.length > 60) continue;
      if (HOUSE.test(n) || outletName(source).test(fold(n))) { names.push('Redação'); continue; }
      if (!/\s/.test(n) && n === n.toLowerCase()) continue; // nome de usuário do CMS ("lucasschroeder")
      if (n === n.toUpperCase() && /[A-Z]{3}/.test(n)) n = n.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (c) => c.toUpperCase());
      names.push(n);
    }
  }
  const uniq = [...new Set(names)];
  return uniq.length > 1 ? uniq.filter((n) => n !== 'Redação') : uniq;
}

const OPINION_URL = /\/(opiniao|opinion|opinions|colunas?|colunistas?|columnists?|commentisfree|editoriais|editorial|leaders|blogs?|analise|analysis|opiniao-e-analise|artigos?|ponto-de-vista|comment)\//i;
const LIVE = /(\bao vivo\b|\/ao-vivo\/|\/live\/|\blive updates?\b|^live:|[;:]\s*(siga|acompanhe)\b|\/live-\d+)/i;

const compile = (list) =>
  list.map((t) => ({
    ...t,
    re: wordsRegex(t.words),
    reCased: wordsRegex(t.cased, { cased: true }),
    reNot: wordsRegex(t.not, { global: true }),
  }));
const TOPIC_RX = compile(TOPICS);
const REGION_RX = compile(REGIONS);
const FOREIGN = new Set(REGIONS.map((r) => r.id).filter((id) => id !== 'brasil'));

export function classify({ url, title, excerpt, section, source }) {
  const isBR = source.country === 'BR';
  const sec = URL_SECTIONS.find((s) => s.re.test(url))?.section || section;
  const topics = new Set(SECTION_TOPICS[sec]?.[isBR ? 'BR' : 'INT'] || []);
  const raw = `${title} ${excerpt}`;
  const folded = fold(raw);

  const regions = new Set();
  for (const r of REGION_RX) if (r.re?.test(folded) || r.reCased?.test(raw)) regions.add(r.id);
  const foreign = [...regions].some((r) => FOREIGN.has(r));

  for (const t of TOPIC_RX) {
    const txt = t.reNot ? folded.replace(t.reNot, ' ') : folded;
    if (!(t.re?.test(txt) || t.reCased?.test(raw))) continue;
    if (t.scope === 'int' && isBR && !foreign) continue;
    if (t.scope === 'br' && !isBR && !regions.has('brasil')) continue;
    if (t.id === 'politica-br' && !isBR && !regions.has('brasil')) continue;
    topics.add(t.id);
  }
  // Política nacional de outros países publicada em seção "mundo" de veículo estrangeiro
  // continua internacional; matéria de veículo brasileiro sobre o Brasil não é "internacional"
  // só por citar uma sanção ou um embaixador.
  if (isBR && topics.has('politica-int') && sec !== 'mundo' && !foreign) topics.delete('politica-int');
  if (topics.has('eleicoes') && (isBR || regions.has('brasil')) && !foreign) topics.add('politica-br');
  return { topics: [...topics], regions: [...regions], section: sec };
}

const TZ = { BR: '-03:00' };

export function toArticle(item, feed, source, now) {
  const url = canonicalUrl(item.link);
  if (!url || !item.title) return null;
  if (EXCLUDE_URL.test(new URL(url).pathname)) return null;

  let title = item.title;
  if (source.googleNews) title = title.replace(/\s+[-–]\s+(Reuters|AP News|The Associated Press|Associated Press)$/i, '');
  if (source.titleStrip) title = title.replace(source.titleStrip, '') || title;

  let excerpt = stripHtml(item.description) || stripHtml(item.content);
  excerpt = excerpt
    .replace(/\s*(The post .+ appeared first on .+|Continue reading\.*|Leia mais.*|Read more.*|\[…\]|\[\.\.\.\])\s*$/i, '')
    .trim();
  const ft = fold(title);
  const fe = fold(excerpt);
  if (source.googleNews || !fe || fe === ft || fe.startsWith(ft) || ft.startsWith(fe)) excerpt = '';
  // resumo mais longo para o app: linha fina + início do texto, quando o feed traz o texto completo
  const content = item.content || '';
  const lede = /<p[\s>]/i.test(content) ? ledeFromHtml(content) : stripHtml(content);
  const summary = source.googleNews ? '' : composeSummary({ description: excerpt, lede, title });
  excerpt = truncate(excerpt, 260);

  let date = parseDate(item.date, TZ[source.country] || 'Z');
  if (date && date > now + 10 * 60e3) date = now; // datas no futuro (agendamento do CMS)

  const authors = source.noBylines ? [] : cleanAuthors(item.authors, source);
  const { topics, regions, section } = classify({ url, title, excerpt, section: feed.section, source });
  const opinion = feed.section === 'opiniao' || OPINION_URL.test(url);
  const live = LIVE.test(title) || LIVE.test(url);

  let image = item.image ? canonicalImage(item.image) : '';

  const a = {
    id: articleId(source.googleNews ? `${source.id}:${ft}` : url),
    t: title,
    u: url,
    s: source.id,
    d: date,
    by: authors,
    x: excerpt,
    img: image,
    tp: topics,
    rg: regions,
  };
  if (opinion) a.op = 1;
  else if (feed.analysis) a.an = 1;
  if (live) a.live = 1;
  if (feed.bias != null) a.b = feed.bias;
  if (summary.length > excerpt.length + 20) a.rs = summary;
  a._section = section;
  return a;
}

export function canonicalImage(src) {
  let u = clean(src);
  if (u.startsWith('//')) u = 'https:' + u;
  return u.replace(/^http:\/\//, 'https://');
}
