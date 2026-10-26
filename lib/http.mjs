// Requisições com tempo-limite, limite de tamanho e user-agent de navegador como reserva
// (alguns sites bloqueiam robôs declarados mesmo em feeds públicos).
import { decodeBody } from './parse.mjs';

const UA_BOT = 'Mozilla/5.0 (compatible; MiranteNews/1.0; leitor pessoal de RSS)';
const UA_BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

async function once(url, ua, { timeout, maxBytes, accept }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': ua, accept, 'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8' },
      redirect: 'follow',
      signal: ctrl.signal,
    });
    if (!res.ok) { res.body?.cancel().catch(() => {}); return { ok: false, status: res.status }; }
    const chunks = [];
    let size = 0;
    for await (const chunk of res.body) {
      chunks.push(chunk);
      size += chunk.length;
      if (size > maxBytes) { ctrl.abort(); break; }
    }
    const buf = Buffer.concat(chunks);
    return { ok: true, status: res.status, text: decodeBody(buf, res.headers.get('content-type') || ''), url: res.url };
  } catch (e) {
    return { ok: false, status: 0, error: e.name === 'AbortError' ? 'timeout' : String(e.cause?.code || e.message) };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchText(url, { timeout = 15000, maxBytes = 3_000_000, accept = 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.5' } = {}) {
  const r = await once(url, UA_BOT, { timeout, maxBytes, accept });
  if (r.ok || r.status === 404) return r;
  return once(url, UA_BROWSER, { timeout, maxBytes, accept });
}

export function fetchPage(url) {
  // A página só interessa até o <body>; 600 kB cobre o <head> até dos portais mais pesados.
  return once(url, UA_BROWSER, { timeout: 9000, maxBytes: 600_000, accept: 'text/html,application/xhtml+xml' });
}
