import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed, parseDate, decodeBody } from '../lib/parse.mjs';
import { toArticle, canonicalUrl, cleanAuthors, classify } from '../lib/normalize.mjs';
import { extractMeta } from '../lib/enrich.mjs';
import { clusterStories } from '../lib/cluster.mjs';
import { SOURCES } from '../config/sources.mjs';

const src = (id) => SOURCES.find((s) => s.id === id);
const NOW = Date.parse('2026-10-26T16:00:00Z');

test('Folha: ISO-8859-1, link de redirecionamento e autor', () => {
  const xml = `<?xml version="1.0" encoding="ISO-8859-1"?><rss version="0.91"><channel><title>Folha</title>
  <item><title>Aliada de Flávio fala em fiscalizar governo na oposição</title>
  <link>https://redir.folha.com.br/redir/online/poder/rss091/*https://www1.folha.uol.com.br/poder/2026/10/aliada.shtml</link>
  <pubDate>26 Oct 2026 12:28:00 -0300</pubDate><author>Anna Júlia Lopes</author>
  <description>Senadora diz que oposição vai fiscalizar.</description></item></channel></rss>`;
  const text = decodeBody(Buffer.from(xml, 'latin1'), 'text/xml');
  const { items } = parseFeed(text);
  const folha = src('folha');
  const a = toArticle(items[0], folha.feeds[0], folha, NOW);
  assert.equal(a.t, 'Aliada de Flávio fala em fiscalizar governo na oposição');
  assert.equal(a.u, 'https://www1.folha.uol.com.br/poder/2026/10/aliada.shtml');
  assert.deepEqual(a.by, ['Anna Júlia Lopes']);
  assert.equal(a.d, Date.parse('2026-10-26T15:28:00Z'));
  assert.ok(a.tp.includes('politica-br'));
});

test('WordPress: dc:creator, entidades escapadas duas vezes, media:content e categoria opinião por URL', () => {
  const xml = `<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/"><channel>
  <item><title>Lula&amp;#8217;s comeback</title><link>https://www.jota.info/opiniao-e-analise/colunas/x/lula?utm_source=rss</link>
  <dc:creator><![CDATA[Beto Bombig]]></dc:creator><pubDate>Mon, 26 Oct 2026 15:14:58 +0000</pubDate>
  <media:content url="http://img.example.com/a.jpg" medium="image" width="800"/>
  <description><![CDATA[<p>Lula ganha nova chance &#8230;</p><p>The post X appeared first on JOTA.</p>]]></description></item></channel></rss>`;
  const { items } = parseFeed(xml);
  const jota = src('jota');
  const a = toArticle(items[0], jota.feeds[0], jota, NOW);
  assert.equal(a.t, 'Lula’s comeback');
  assert.equal(a.u, 'https://www.jota.info/opiniao-e-analise/colunas/x/lula');
  assert.equal(a.img, 'https://img.example.com/a.jpg');
  assert.equal(a.op, 1);
  assert.deepEqual(a.by, ['Beto Bombig']);
  assert.ok(!a.x.includes('appeared first'));
});

test('Atom e Google Notícias (Reuters sem sufixo, sem resumo)', () => {
  const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Atom title</title>
  <link rel="alternate" href="https://example.com/a"/><published>2026-10-26T10:00:00Z</published>
  <author><name>Jane Doe</name></author><summary>Sum</summary></entry></feed>`;
  const e = parseFeed(atom).items[0];
  assert.equal(e.link, 'https://example.com/a');
  assert.deepEqual(e.authors, ['Jane Doe']);

  const gn = `<rss><channel><item><title>Egypt approves military support for Saudi Arabia - Reuters</title>
  <link>https://news.google.com/rss/articles/CBMi123?oc=5</link><pubDate>Mon, 26 Oct 2026 14:00:33 GMT</pubDate>
  <description>&lt;a href="x"&gt;Egypt approves military support&lt;/a&gt;</description><source url="https://www.reuters.com">Reuters</source></item></channel></rss>`;
  const reuters = src('reuters');
  const a = toArticle(parseFeed(gn).items[0], reuters.feeds[0], reuters, NOW);
  assert.equal(a.t, 'Egypt approves military support for Saudi Arabia');
  assert.equal(a.x, '');
  assert.ok(a.u.startsWith('https://news.google.com/'));
  assert.ok(a.tp.includes('politica-int'));
});

test('datas em português, ISO sem fuso e datas no futuro', () => {
  assert.equal(parseDate('Seg, 26 Out 2026 12:32:15 -0300'), Date.parse('2026-10-26T15:32:15Z'));
  assert.equal(parseDate('2026-10-26T12:28:10', '-03:00'), Date.parse('2026-10-26T15:28:10Z'));
  assert.equal(parseDate('Mon, 26 Oct 2026 10:00:00 EDT'), Date.parse('2026-10-26T14:00:00Z'));
  assert.equal(parseDate(''), null);
});

test('assinaturas', () => {
  const p = src('poder360');
  assert.deepEqual(cleanAuthors(['Poder360 · PODER360'], p), ['Redação']);
  assert.deepEqual(cleanAuthors(['Daniella Almeida - Repórter da Agência Brasil'], p), ['Daniella Almeida']);
  assert.deepEqual(cleanAuthors(['By Aaron Pellish and Andrew Howard'], src('politico')), ['Aaron Pellish', 'Andrew Howard']);
  assert.deepEqual(cleanAuthors(['Ana Ionova, Adam B. Ellick and Yan Zhuang'], src('nyt')), ['Ana Ionova', 'Adam B. Ellick', 'Yan Zhuang']);
  assert.deepEqual(cleanAuthors(['lucasschroeder'], src('cnnbrasil')), []);
  assert.deepEqual(cleanAuthors(['AMY MORRIS'], src('bloomberg')), ['Amy Morris']);
  assert.deepEqual(cleanAuthors(['Paulo Pappas'], src('ap')), ['Paulo Pappas']);
  assert.deepEqual(cleanAuthors(['Fulano de Tal, g1 — Brasília'], src('g1')), ['Fulano de Tal']);
});

test('temas e regiões', () => {
  const g = (title, id, section = 'geral', url = 'https://x.com/a') => classify({ url, title, excerpt: '', section, source: src(id) });
  assert.ok(g('Netanyahu sugere retomar guerra contra o Irã', 'valor', 'mundo').topics.includes('guerras'));
  assert.ok(!g('China e EUA ampliam guerra comercial', 'folha', 'mundo').topics.includes('guerras'));
  assert.ok(g('China e EUA ampliam guerra comercial', 'folha', 'mundo').topics.includes('economia-int'));
  assert.ok(g('Brent sobe 4% e Petrobras avalia reajuste', 'estadao').topics.includes('petroleo'));
  assert.ok(g('Ibovespa cai 15% após circuit breaker', 'valor').topics.includes('mercados'));
  assert.ok(g('Lula wins fourth term in dramatic Brazil election comeback', 'bbc', 'mundo').topics.includes('politica-br'));
  assert.ok(!g('Senators debate Ukraine aid package', 'nyt', 'mundo').topics.includes('politica-br'));
  assert.ok(g('Clima de tensão no Congresso após derrota', 'folha', 'politica').topics.includes('politica-br'));
  assert.ok(!g('Clima de tensão no Congresso após derrota', 'folha', 'politica').topics.includes('clima'));
  assert.ok(g('Trump says US will impose tariffs', 'reuters', 'mundo').regions.includes('eua'));
  assert.ok(!g('Tell us what you think', 'guardian', 'mundo').regions.includes('eua'));
  assert.ok(g('Anthropic files for IPO as AI race heats up', 'bloomberg', 'mercados').topics.includes('tecnologia'));
  assert.ok(!g('Ação do governo no Ceará', 'g1', 'politica').topics.includes('tecnologia'));
});

test('exclui esporte e entretenimento', () => {
  const g1 = src('g1');
  const it = { title: 'Flamengo vence', link: 'https://ge.globo.com/futebol/times/flamengo/x.ghtml', date: '', authors: [], description: '', content: '', image: '', categories: [] };
  assert.equal(toArticle(it, g1.feeds[0], g1, NOW), null);
});

test('metadados da página: JSON-LD, meta author e g1', () => {
  const ld = `<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"NewsArticle","author":[{"@type":"Person","name":"Maria Silva"}],"image":{"url":"https://img/x.jpg"}}]}</script>`;
  assert.deepEqual(extractMeta(ld).authors, ['Maria Silva']);
  assert.equal(extractMeta(ld).image, 'https://img/x.jpg');
  assert.deepEqual(extractMeta('<meta name="author" content="João Souza">').authors, ['João Souza']);
  assert.deepEqual(extractMeta('<p class="content-publication-data__from" title="x">Por Pedro Alves, g1 — Brasília</p>').authors, ['Pedro Alves, g1']);
});

test('mesma pauta: agrupa coberturas parecidas e separa assuntos diferentes', () => {
  const mk = (id, s, t) => ({ id, s, t, x: '', d: NOW - id.length * 1000 });
  const arts = [
    mk('a1', 'folha', 'Ministros do STF não veem chance de Flávio Bolsonaro anular eleição'),
    mk('a2', 'estadao', 'Ministros do STF e do TSE não veem chance de Flávio Bolsonaro conseguir anular eleições'),
    mk('a3', 'intercept', 'Flávio Bolsonaro tenta anular eleição e STF reage'),
    mk('a4', 'gazeta', 'Pedido de Flávio Bolsonaro para anular eleição divide ministros do STF'),
    mk('a5', 'valor', 'Ibovespa cai 15% e dólar dispara após resultado'),
    mk('a6', 'g1', 'Dólar dispara e Ibovespa aciona circuit breaker'),
    mk('a7', 'cnnbrasil', 'Ibovespa despenca e dólar sobe 9%'),
    mk('a8', 'poder360', 'Artistas comemoram vitória no segundo turno'),
  ];
  const lane = (a) => ({ intercept: 'e', gazeta: 'd', estadao: 'd' })[a.s] || 'c';
  const stories = clusterStories(arts, lane, { minSources: 3 });
  const anular = stories.find((s) => s.ids.includes('a1'));
  assert.ok(anular, 'pauta sobre anulação existe');
  assert.ok(anular.ids.includes('a2') && anular.ids.includes('a4'));
  assert.ok(!anular.ids.includes('a5'));
  const bolsa = stories.find((s) => s.ids.includes('a5'));
  assert.ok(bolsa && bolsa.ids.includes('a6'));
});

test('URL canônica remove rastreadores', () => {
  assert.equal(canonicalUrl('http://www.bbc.co.uk/news/x?at_medium=RSS&amp;at_campaign=rss'), 'https://www.bbc.co.uk/news/x');
  assert.equal(canonicalUrl('https://www.ft.com/content/abc?syn-25a6b1a6=1'), 'https://www.ft.com/content/abc');
});
