// Tradução automática (inglês → português) de títulos, chamadas e resumos, feita na coleta.
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

// Campo original → campo traduzido: título, chamada e resumo.
const FIELDS = [['t', 'tt'], ['x', 'tx'], ['rs', 'trs']];
const MAX_CHARS = 4000; // por requisição, abaixo do limite do endpoint

/**
 * Preenche `tt` (título), `tx` (chamada) e `trs` (resumo) das matérias em inglês que ainda não
 * têm tradução. Traduções de coletas anteriores chegam prontas e só valem para o mesmo texto.
 */
export async function translateArticles(articles, sourcesById, { budget = 600, maxMs = 150e3, log = () => {} } = {}) {
  const until = Date.now() + maxMs; // o resto fica para a próxima coleta
  const queue = articles
    .filter((a) => sourcesById[a.s]?.lang === 'en' && FIELDS.some(([f, k]) => a[f] && !a[k]))
    .slice(0, budget);
  if (!queue.length) return;
  const jobs = queue.flatMap((a) => FIELDS.filter(([f, k]) => a[f] && !a[k]).map(([f, k]) => ({ a, k, text: a[f] })));
  let done = 0, fallback = false, failures = 0;

  for (let i = 0; i < jobs.length && failures < 3 && Date.now() < until;) {
    const chunk = [];
    for (let size = 0; i < jobs.length && chunk.length < 40 && (!chunk.length || size + jobs[i].text.length <= MAX_CHARS); i++) {
      chunk.push(jobs[i]);
      size += jobs[i].text.length;
    }
    const texts = chunk.map((j) => j.text);
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
      chunk.forEach((j, n) => { j.a[j.k] = tidy(out[n]); });
      done += chunk.length;
      failures = 0;
    } catch (e) {
      failures++;
      log(`tradução falhou (${e.message})`);
    }
    await sleep(250);
  }
  const stop = failures >= 3 ? ' (interrompida após falhas seguidas; continua na próxima coleta)' : done < jobs.length ? ' (tempo esgotado; continua na próxima coleta)' : '';
  log(`tradução: ${done} de ${jobs.length} textos de ${queue.length} matérias em inglês${stop}`);
}
