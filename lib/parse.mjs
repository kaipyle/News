// Leitura de feeds RSS 0.91/2.0, RSS 1.0 (RDF) e Atom.
import { XMLParser } from 'fast-xml-parser';
import { clean } from './text.mjs';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: true,
  isArray: (name) => ['item', 'entry', 'category', 'media:content', 'media:thumbnail', 'link', 'enclosure', 'dc:creator', 'author'].includes(name),
});

// Decodifica respeitando o charset declarado (a Folha ainda publica em ISO-8859-1).
export function decodeBody(buf, contentType = '') {
  const head = buf.subarray(0, 200).toString('latin1');
  const declared = (head.match(/encoding=["']([\w-]+)["']/i) || [])[1] || (contentType.match(/charset=([\w-]+)/i) || [])[1] || 'utf-8';
  try {
    return new TextDecoder(declared.toLowerCase()).decode(buf);
  } catch {
    return new TextDecoder('utf-8').decode(buf);
  }
}

const text = (v) => {
  if (v == null) return '';
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === 'object') return v['#text'] ?? v['@_href'] ?? v.name ?? '';
  return String(v);
};

const PT_MONTHS = { jan: 'Jan', fev: 'Feb', mar: 'Mar', abr: 'Apr', mai: 'May', jun: 'Jun', jul: 'Jul', ago: 'Aug', set: 'Sep', out: 'Oct', nov: 'Nov', dez: 'Dec' };

// Datas de feed: RFC 822 (inclusive com meses em português) e ISO 8601.
// ISO sem fuso é lido no fuso do veículo (`tz`, ex.: "-03:00").
export function parseDate(raw, tz = 'Z') {
  let s = clean(raw);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s)) s = s.replace(' ', 'T') + tz;
  else if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += 'T12:00:00' + tz;
  else {
    s = s.replace(/^(seg|ter|qua|qui|sex|s[áa]b|dom)[a-zç-]*,?\s*/i, '');
    s = s.replace(/\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*\b/i, (m, k) => PT_MONTHS[k.toLowerCase()]);
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

function pickLink(item) {
  const links = item.link;
  if (Array.isArray(links)) {
    const alt = links.find((l) => typeof l === 'object' && l['@_href'] && (!l['@_rel'] || l['@_rel'] === 'alternate'));
    if (alt) return alt['@_href'];
    const first = links.map(text).find((l) => /^https?:/.test(l));
    if (first) return first;
  } else if (links) {
    const l = text(links);
    if (/^https?:/.test(l)) return l;
  }
  const guid = text(item.guid);
  return /^https?:/.test(guid) ? guid : '';
}

function pickImage(item) {
  const candidates = [];
  for (const m of [].concat(item['media:content'] || [], item['media:group']?.['media:content'] || [])) {
    if (!m || !m['@_url']) continue;
    const type = m['@_type'] || '';
    const medium = m['@_medium'] || '';
    if (medium && medium !== 'image') continue;
    if (type && !type.startsWith('image')) continue;
    candidates.push({ url: m['@_url'], w: Number(m['@_width']) || 0 });
  }
  for (const m of [].concat(item['media:thumbnail'] || [], item['media:group']?.['media:thumbnail'] || [])) {
    if (m?.['@_url']) candidates.push({ url: m['@_url'], w: Number(m['@_width']) || 0 });
  }
  for (const e of item.enclosure || []) {
    if (e?.['@_url'] && (!e['@_type'] || e['@_type'].startsWith('image'))) candidates.push({ url: e['@_url'], w: 0 });
  }
  if (candidates.length) {
    // Prefere a maior imagem até ~1000px (thumbnails gigantes pesam no celular).
    candidates.sort((a, b) => (b.w > 1000 ? 0 : b.w) - (a.w > 1000 ? 0 : a.w));
    return candidates[0].url;
  }
  const html = text(item['content:encoded']) || text(item.description) || text(item.content) || '';
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : '';
}

function pickAuthors(item) {
  const out = [];
  for (const c of item['dc:creator'] || []) out.push(text(c));
  for (const a of item.author || []) {
    let v = typeof a === 'object' ? text(a.name) || text(a) : String(a);
    // RSS 2.0: "email@dominio (Nome)"
    const m = v.match(/^\S+@\S+\s*\(([^)]+)\)$/);
    if (m) v = m[1];
    else if (/^\S+@\S+$/.test(v)) v = '';
    out.push(v);
  }
  return out.map(clean).filter(Boolean);
}

export function parseFeed(xml) {
  const doc = parser.parse(xml);
  const channel = doc.rss?.channel || doc['rdf:RDF']?.channel || doc.feed || {};
  const raw = doc.rss?.channel?.item || doc['rdf:RDF']?.item || doc.feed?.entry || doc.rss?.item || [];
  const items = raw.map((it) => ({
    title: clean(text(it.title)),
    link: clean(pickLink(it)),
    date: text(it.pubDate) || text(it['dc:date']) || text(it.published) || text(it.updated) || text(it['a10:updated']) || '',
    authors: pickAuthors(it),
    description: text(it.description) || text(it.summary) || '',
    content: text(it['content:encoded']) || text(it.content) || '',
    image: clean(pickImage(it)),
    categories: (it.category || []).map((c) => clean(text(c))).filter(Boolean),
    sourceName: clean(text(it.source)),
  }));
  return { title: clean(text(channel.title)), items };
}
