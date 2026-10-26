// Tradução automática (inglês → português) de títulos e resumos, feita na coleta.
// Usa o endpoint gratuito do Google Tradutor (o mesmo da extensão do navegador). Não é uma
// API oficial: se parar de responder, as matérias simplesmente seguem no original.
import { decodeEntities } from './text.mjs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Vários textos numa requisição só; a resposta vem na mesma ordem.
async function translateMany(texts, sl, tl) {
  const body = new URLSearchParams();
  for (const t of texts) body.append('q', t);
  const res = await fetch(`https://translate.googleapis.com/translate_a/t?client=gtx&sl=${sl}&tl=${tl}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8', 'user-agent': UA },
    body,
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const list = (texts.length === 1 && !Array.isArray(data) ? [data] : data).map((x) => (Array.isArray(x) ? x[0] : x));
  if (!Array.isArray(list) || list.length !== texts.length || list.some((x) => typeof x !== 'string')) {
    throw new Error('resposta em formato inesperado');
  }
  return list;
}

// Reserva: um texto por requisição, no formato clássico do endpoint.
async function translateOne(text, sl, tl) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data[0].map((seg) => seg[0]).join('');
}

const tidy = (s) => decodeEntities(String(s)).replace(/\s+/g, ' ').trim();

/**
 * Preenche `tt` (título traduzido) e `tx` (resumo traduzido) das matérias em inglês que
 * ainda não têm tradução. Matérias já traduzidas em coletas anteriores chegam com os campos.
 */
export async function translateArticles(articles, sourcesById, { budget = 600, batch = 20, log = () => {} } = {}) {
  const queue = articles.filter((a) => sourcesById[a.s]?.lang === 'en' && !a.tt).slice(0, budget);
  if (!queue.length) return;
  let done = 0, fallback = false, failures = 0;

  for (let i = 0; i < queue.length && failures < 3; i += batch) {
    const chunk = queue.slice(i, i + batch);
    const texts = [];
    for (const a of chunk) { texts.push(a.t); if (a.x) texts.push(a.x); }
    try {
      let out;
      if (!fallback) {
        try { out = await translateMany(texts, 'en', 'pt'); }
        catch (e) { fallback = true; log(`tradução em lote indisponível (${e.message}); usando um texto por vez`); }
      }
      if (!out) {
        out = [];
        for (const t of texts) { out.push(await translateOne(t, 'en', 'pt')); await sleep(120); }
      }
      let k = 0;
      for (const a of chunk) {
        a.tt = tidy(out[k++]);
        if (a.x) a.tx = tidy(out[k++]);
        done++;
      }
      failures = 0;
    } catch (e) {
      failures++;
      log(`tradução falhou (${e.message})`);
    }
    await sleep(250);
  }
  log(`tradução: ${done} matérias em inglês traduzidas${failures >= 3 ? ' (interrompida após falhas seguidas; continua na próxima coleta)' : ''}`);
}
