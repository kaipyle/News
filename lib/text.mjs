// Utilitários de texto compartilhados entre coleta, classificação e agrupamento.

const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', middot: '·', bull: '•',
  aacute: 'á', agrave: 'à', acirc: 'â', atilde: 'ã', eacute: 'é', ecirc: 'ê', iacute: 'í', oacute: 'ó',
  ocirc: 'ô', otilde: 'õ', uacute: 'ú', uuml: 'ü', ccedil: 'ç', Aacute: 'Á', Agrave: 'À', Acirc: 'Â',
  Atilde: 'Ã', Eacute: 'É', Ecirc: 'Ê', Iacute: 'Í', Oacute: 'Ó', Ocirc: 'Ô', Otilde: 'Õ', Uacute: 'Ú',
  Ccedil: 'Ç', ordm: 'º', ordf: 'ª', deg: '°', euro: '€', pound: '£', copy: '©', reg: '®', trade: '™',
};

export function decodeEntities(s) {
  if (!s || s.indexOf('&') === -1) return s || '';
  // Duas passadas: feeds de WordPress costumam escapar duas vezes ("&amp;#8217;").
  for (let i = 0; i < 2 && s.indexOf('&') !== -1; i++) {
    s = s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e) => {
      if (e[0] === '#') {
        const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(cp) && cp > 0 && cp < 0x110000 ? String.fromCodePoint(cp) : m;
      }
      return NAMED[e] ?? NAMED[e.toLowerCase()] ?? m;
    });
  }
  return s;
}

export function stripHtml(s) {
  if (!s) return '';
  return decodeEntities(
    String(s)
      .replace(/<(script|style|figure|figcaption)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>|<\/p>|<\/li>|<\/h\d>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
}

export function clean(s) {
  return decodeEntities(String(s ?? '')).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// Minúsculas, sem acentos, com º/ª viradas em letra — base para comparar palavras.
export function fold(s) {
  return String(s || '')
    .replace(/º/g, 'o').replace(/ª/g, 'a')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function truncate(s, max) {
  if (!s || s.length <= max) return s || '';
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.—–-]+$/, '') + '…';
}

const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Compila uma lista de palavras ("bombarde*", "cessar-fogo") numa regex de palavra inteira.
export function wordsRegex(words, { cased = false, global = false } = {}) {
  if (!words?.length) return null;
  const cls = cased ? 'A-Za-zÀ-ÿ0-9' : 'a-z0-9';
  const alts = words
    .map((w) => (cased ? w : fold(w)))
    .sort((a, b) => b.length - a.length)
    .map((w) => (w.endsWith('*') ? esc(w.slice(0, -1)) + `[${cls}-]*` : esc(w)));
  return new RegExp(`(?<![${cls}])(?:${alts.join('|')})(?![${cls}])`, global ? 'g' : '');
}
