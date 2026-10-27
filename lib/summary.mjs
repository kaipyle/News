// Resumo de cada matéria: a linha fina (descrição) mais o início do texto, cortado em fim de frase.
// É um trecho do próprio veículo, não um texto gerado. Fica fora do feed.json, em arquivos
// separados que o app só baixa quando o leitor abre um resumo.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { clean, fold, stripHtml } from './text.mjs';

export const SUMMARY_MAX = 450;
export const SHARDS = 32;
// Mesma conta no app (public/app.js): o primeiro caractere do id decide o arquivo.
export const shardOf = (id) => id.charCodeAt(0) % SHARDS;

// Parágrafos que não são texto da matéria: legenda, chamada, assinatura, aviso.
const JUNK = /^(o post |the post |foto|fotos|imagem|cr[eé]dito|reprodu[cç][aã]o|publicidade|an[uú]ncio|leia (tamb[eé]m|mais)|veja (tamb[eé]m|mais)|siga |assine|compartilhe|ou[cç]a|clique|saiba mais|copyright|©|getty images|this article|sign up|subscribe|advertisement|read more|related:)/i;
const BAD = /(cookies?|javascript|newsletter|assinante|subscriber|all rights reserved|todos os direitos|atualizad[oa] em|publicad[oa] em|\d{1,2}\/\d{1,2}\/\d{4} ?(às|-) ?\d)/i;
const SENTENCE_END = /[.!?…]["”’»)]?$/;
// Restos que os feeds deixam no texto: links entre colchetes, rodapé do WordPress, convite de newsletter.
const BOILERPLATE = [
  /\s*\[https?:\/\/[^\]\s]*\]/g,
  /\s*https?:\/\/\S+/g,
  /\s*(O post|The post) .{1,300}? (apareceu primeiro em|appeared first on) [^.]*\.?/gi,
  /\s*Get our [^.]{0,60}?(email|newsletter)(,? free app or daily news podcast)?\.?/gi,
  /\s*Follow (the day['’]s|today['’]s|our) [^.]{0,40}live\.?/gi,
  /\s*This story originally appeared in [^.]+\.(\s*To get stories like this[^.]*\.)?/gi,
  /^\s*((Download|Compartilhar|Enviar|E-?mail|Imprimir|Ouvir)\s+){2,}/i, // botões de compartilhar lidos como texto
  /^\s*Resumo\s+(?=[A-ZÀ-Ú])/, // caixa "Resumo" do Tecnoblog
  /\s*📱?\s*(favorite|siga) o g1 no google[^.]*\.?/gi,
];

/** Limpa o texto do resumo: entidades, restos de feed e espaço antes de pontuação ("Trump ," → "Trump,"). */
export function tidySummary(text) {
  let t = clean(text);
  for (const re of BOILERPLATE) t = t.replace(re, '');
  return t.replace(/\s+([,.;:!?%])/g, '$1').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').replace(/\s{2,}/g, ' ').trim();
}
// para comparar trechos: sem acento, sem pontuação
const norm = (s) => fold(s).replace(/[^a-z0-9]+/g, ' ').trim();

/** Primeiros parágrafos de texto corrido de um HTML (página da matéria ou content:encoded do feed). */
export function ledeFromHtml(html, { min = 60, want = 360, maxParas = 4 } = {}) {
  if (!html) return '';
  const start = html.search(/<article[\s>]/i);
  const region = start >= 0 ? html.slice(start) : html;
  const out = [];
  let len = 0;
  for (const m of region.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)) {
    const t = stripHtml(m[1]);
    if (t.length < min || JUNK.test(t) || BAD.test(t)) continue;
    out.push(t);
    len += t.length;
    if (len >= want || out.length >= maxParas) break;
  }
  return out.join(' ');
}

/** Corta no último fim de frase antes do limite; sem frase completa, corta na palavra com reticências. */
export function clipSummary(text, max = SUMMARY_MAX) {
  const t = tidySummary(text);
  if (t.length <= max) return t;
  const re = /[.!?…]["”’»)]?(?=\s)/g;
  let end = -1;
  for (let m; (m = re.exec(t)) && m.index < max;) {
    if (m.index + m[0].length <= max) end = m.index + m[0].length;
  }
  if (end >= Math.min(140, max * 0.4)) return t.slice(0, end);
  const sp = t.lastIndexOf(' ', max - 1);
  return t.slice(0, sp > 0 ? sp : max).replace(/[\s,;:.—–-]+$/, '') + '…';
}

/** Junta linha fina e início do texto sem repetir um dentro do outro nem repetir o título. */
export function composeSummary({ description = '', lede = '', title = '' }, max = SUMMARY_MAX) {
  let d = tidySummary(description).replace(/\s*(\[…\]|\[\.\.\.\]|…|\.\.\.)$/, '');
  let l = tidySummary(lede);
  const ft = norm(title);
  if (d && (norm(d) === ft || ft.startsWith(norm(d)))) d = '';
  if (d && l) {
    const fd = norm(d), fl = norm(l);
    if (fl.includes(fd.slice(0, 60))) d = ''; // o texto já começa pela linha fina
    else if (fd.includes(fl.slice(0, 60))) l = '';
  }
  if (d && l && !SENTENCE_END.test(d)) d += '.';
  return clipSummary([d, l].filter(Boolean).join(' '), max);
}

/** Grava os resumos em SHARDS arquivos (o app baixa um por vez) e num arquivo único (estado da próxima coleta). */
export async function writeSummaries(dir, map) {
  const shards = Array.from({ length: SHARDS }, () => ({}));
  for (const [id, v] of Object.entries(map)) shards[shardOf(id)][id] = v;
  await mkdir(join(dir, 'resumos'), { recursive: true });
  await Promise.all(shards.map((s, i) => writeFile(join(dir, 'resumos', `${i}.json`), JSON.stringify(s))));
  await writeFile(join(dir, 'resumos.json'), JSON.stringify(map));
}
