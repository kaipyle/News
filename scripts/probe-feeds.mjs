// Diagnóstico temporário: testa URLs candidatas de RSS a partir da rede do GitHub Actions.
const CANDIDATES = {
  folha: ['https://feeds.folha.uol.com.br/emcimadahora/rss091.xml','https://feeds.folha.uol.com.br/poder/rss091.xml','https://feeds.folha.uol.com.br/mundo/rss091.xml','https://feeds.folha.uol.com.br/mercado/rss091.xml','https://feeds.folha.uol.com.br/opiniao/rss091.xml'],
  estadao: ['https://www.estadao.com.br/arc/outboundfeeds/feeds/rss/sections/politica/','https://www.estadao.com.br/arc/outboundfeeds/feeds/rss/sections/economia/','https://www.estadao.com.br/arc/outboundfeeds/feeds/rss/sections/internacional/','https://www.estadao.com.br/arc/outboundfeeds/rss/?outputType=xml','https://www.estadao.com.br/rss/ultimas.xml'],
  oglobo: ['https://oglobo.globo.com/rss/oglobo','https://oglobo.globo.com/arc/outboundfeeds/rss/?outputType=xml','https://oglobo.globo.com/arc/outboundfeeds/rss/category/politica/?outputType=xml','https://oglobo.globo.com/arc/outboundfeeds/rss/category/mundo/?outputType=xml','https://oglobo.globo.com/arc/outboundfeeds/rss/category/economia/?outputType=xml'],
  g1: ['https://g1.globo.com/rss/g1/','https://g1.globo.com/rss/g1/politica/','https://g1.globo.com/rss/g1/economia/','https://g1.globo.com/rss/g1/mundo/'],
  valor: ['https://valor.globo.com/rss/valor/','https://pox.globo.com/rss/valor/','https://valor.globo.com/rss/valor/politica/','https://valor.globo.com/rss/valor/financas/','https://valor.globo.com/rss/valor/mundo/'],
  poder360: ['https://www.poder360.com.br/feed/','https://www.poder360.com.br/poder-congresso/feed/'],
  nexo: ['https://www.nexojornal.com.br/rss.xml','https://www.nexojornal.com.br/feed','https://www.nexojornal.com.br/rss','https://pp.nexojornal.com.br/rss.xml'],
  piaui: ['https://piaui.folha.uol.com.br/feed/'],
  cnnbrasil: ['https://www.cnnbrasil.com.br/feed/','https://www.cnnbrasil.com.br/politica/feed/','https://www.cnnbrasil.com.br/economia/feed/','https://www.cnnbrasil.com.br/internacional/feed/'],
  publica: ['https://apublica.org/feed/'],
  intercept: ['https://www.intercept.com.br/feed/','https://theintercept.com/brasil/feed/'],
  gazeta: ['https://www.gazetadopovo.com.br/feed/rss/republica.xml','https://www.gazetadopovo.com.br/feed/rss/ultimas-noticias.xml','https://www.gazetadopovo.com.br/feed/rss/economia.xml','https://www.gazetadopovo.com.br/feed/rss/mundo.xml'],
  aosfatos: ['https://www.aosfatos.org/noticias/feed/','https://www.aosfatos.org/rss/'],
  lupa: ['https://lupa.uol.com.br/feed/','https://lupa.uol.com.br/rss','https://lupa.uol.com.br/jornalismo/feed'],
  bbcbrasil: ['https://feeds.bbci.co.uk/portuguese/rss.xml'],
  dwbrasil: ['https://rss.dw.com/xml/rss-br-all','https://rss.dw.com/rdf/rss-br-all'],
  agenciabrasil: ['https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml','https://agenciabrasil.ebc.com.br/rss/politica/feed.xml'],
  jota: ['https://www.jota.info/feed','https://www.jota.info/feed/'],
  veja: ['https://veja.abril.com.br/feed/'],
  infomoney: ['https://www.infomoney.com.br/feed/','https://www.infomoney.com.br/mercados/feed/'],
  exame: ['https://exame.com/feed/'],
  cartacapital: ['https://www.cartacapital.com.br/feed/'],
  uol: ['https://rss.uol.com.br/feed/noticias.xml'],
  crusoe: ['https://crusoe.com.br/feed/'],
  reuters_gn: ['https://news.google.com/rss/search?q=when:2d+site:reuters.com&hl=en-US&gl=US&ceid=US:en','https://news.google.com/rss/search?q=when:2d+site:reuters.com/world&hl=en-US&gl=US&ceid=US:en','https://news.google.com/rss/search?q=when:2d+site:reuters.com/markets&hl=en-US&gl=US&ceid=US:en','https://news.google.com/rss/search?q=when:2d+site:reuters.com/business/energy&hl=en-US&gl=US&ceid=US:en'],
  reuters_agency: ['https://www.reutersagency.com/feed/?best-topics=political-general&post_type=best','https://www.reutersagency.com/feed/?taxonomy=best-sectors&post_type=best'],
  ap_gn: ['https://news.google.com/rss/search?q=when:2d+site:apnews.com&hl=en-US&gl=US&ceid=US:en'],
  ap: ['https://apnews.com/index.rss','https://apnews.com/world-news.rss','https://apnews.com/hub/world-news?output=rss'],
  bbc: ['https://feeds.bbci.co.uk/news/world/rss.xml','https://feeds.bbci.co.uk/news/business/rss.xml','https://feeds.bbci.co.uk/news/world/latin_america/rss.xml'],
  ft: ['https://www.ft.com/rss/home','https://www.ft.com/world?format=rss','https://www.ft.com/markets?format=rss','https://www.ft.com/global-economy?format=rss','https://www.ft.com/opinion?format=rss'],
  economist: ['https://www.economist.com/international/rss.xml','https://www.economist.com/finance-and-economics/rss.xml','https://www.economist.com/the-americas/rss.xml','https://www.economist.com/leaders/rss.xml','https://www.economist.com/business/rss.xml'],
  wsj: ['https://feeds.a.dj.com/rss/RSSWorldNews.xml','https://feeds.a.dj.com/rss/RSSMarketsMain.xml','https://feeds.content.dowjones.io/public/rss/RSSWorldNews','https://feeds.content.dowjones.io/public/rss/RSSMarketsMain','https://feeds.content.dowjones.io/public/rss/WSJcomUSBusiness','https://feeds.content.dowjones.io/public/rss/RSSOpinion'],
  nyt: ['https://rss.nytimes.com/services/xml/rss/nyt/World.xml','https://rss.nytimes.com/services/xml/rss/nyt/Business.xml','https://rss.nytimes.com/services/xml/rss/nyt/Economy.xml','https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml','https://rss.nytimes.com/services/xml/rss/nyt/Americas.xml'],
  bloomberg: ['https://feeds.bloomberg.com/markets/news.rss','https://feeds.bloomberg.com/politics/news.rss','https://feeds.bloomberg.com/economics/news.rss','https://feeds.bloomberg.com/business/news.rss'],
  guardian: ['https://www.theguardian.com/world/rss','https://www.theguardian.com/business/rss','https://www.theguardian.com/world/americas/rss'],
  telegraph: ['https://www.telegraph.co.uk/rss.xml','https://www.telegraph.co.uk/news/rss.xml','https://www.telegraph.co.uk/world-news/rss.xml','https://www.telegraph.co.uk/business/rss.xml'],
  aljazeera: ['https://www.aljazeera.com/xml/rss/all.xml'],
  npr: ['https://feeds.npr.org/1004/rss.xml','https://feeds.npr.org/1006/rss.xml'],
  dw: ['https://rss.dw.com/xml/rss-en-world','https://rss.dw.com/xml/rss-en-bus'],
  lemonde: ['https://www.lemonde.fr/en/rss/une.xml','https://www.lemonde.fr/en/international/rss_full.xml'],
  france24: ['https://www.france24.com/en/rss'],
  politico: ['https://www.politico.eu/feed/','https://rss.politico.com/politics-news.xml'],
  axios: ['https://api.axios.com/feed/'],
  nikkei: ['https://asia.nikkei.com/rss/feed/nar'],
  foreignpolicy: ['https://foreignpolicy.com/feed/'],
  cnbc: ['https://www.cnbc.com/id/100003114/device/rss/rss.html','https://www.cnbc.com/id/20910258/device/rss/rss.html'],
};

const UAS = {
  bot: 'Mozilla/5.0 (compatible; MiranteRSS/1.0; +https://github.com/kaipyle/News)',
  browser: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
};

async function get(url, ua) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, { headers: { 'user-agent': ua, accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8, */*;q=0.5' }, redirect: 'follow', signal: ctrl.signal });
    const buf = Buffer.from(await r.arrayBuffer());
    return { status: r.status, type: r.headers.get('content-type') || '', buf, finalUrl: r.url };
  } catch (e) {
    return { status: 0, type: '', buf: Buffer.alloc(0), err: String(e.cause?.code || e.message) };
  } finally { clearTimeout(t); }
}

function first(re, s) { const m = s.match(re); return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim().slice(0, 110) : ''; }

async function probe(url) {
  let r = await get(url, UAS.bot), ua = 'bot';
  if (r.status !== 200) { const r2 = await get(url, UAS.browser); if (r2.status === 200 || r.status === 0) { r = r2; ua = 'browser'; } }
  const head = r.buf.slice(0, 300).toString('latin1');
  const enc = first(/encoding=["']([^"']+)/i, head) || first(/charset=([^;]+)/i, r.type);
  const s = r.buf.toString('utf8');
  const items = (s.match(/<item[\s>]/g) || []).length + (s.match(/<entry[\s>]/g) || []).length;
  const item = (s.match(/<(item|entry)[\s>][\s\S]*?<\/(item|entry)>/) || [''])[0];
  const info = {
    status: r.status, ua, err: r.err, bytes: r.buf.length, enc, items,
    creator: /<dc:creator|<author/.test(item), img: /<media:content|<media:thumbnail|<enclosure|<img /.test(item),
    cats: (item.match(/<category/g) || []).length,
    date: first(/<(?:pubDate|published|dc:date|updated)>([^<]+)/, item),
    title: first(/<title[^>]*>([\s\S]*?)<\/title>/, item),
    author: first(/<(?:dc:creator|author)[^>]*>([\s\S]*?)<\/(?:dc:creator|author)>/, item),
    link: first(/<link[^>]*>([\s\S]*?)<\/link>/, item) || first(/<link[^>]*href="([^"]+)"/, item),
  };
  if (!items) info.snippet = s.slice(0, 160).replace(/\s+/g, ' ');
  return info;
}

const results = {};
const entries = Object.entries(CANDIDATES).flatMap(([k, urls]) => urls.map(u => [k, u]));
let i = 0;
async function worker() { while (i < entries.length) { const [k, u] = entries[i++]; results[u] = { k, ...(await probe(u)) }; } }
await Promise.all(Array.from({ length: 8 }, worker));

for (const [k, u] of entries) {
  const r = results[u];
  const ok = r.status === 200 && r.items > 0 ? 'OK ' : 'XX ';
  console.log(`${ok}[${k}] ${u}\n    status=${r.status}${r.err ? ' err=' + r.err : ''} ua=${r.ua} enc=${r.enc} items=${r.items} creator=${r.creator} img=${r.img} cats=${r.cats} bytes=${r.bytes}\n    date=${r.date} | author=${r.author}\n    title=${r.title}\n    link=${r.link}${r.snippet ? '\n    snippet=' + r.snippet : ''}`);
}

// Teste de enriquecimento (autor via JSON-LD/meta na página do artigo)
console.log('\n=== ENRICH ===');
for (const u of ['https://feeds.folha.uol.com.br/poder/rss091.xml', 'https://valor.globo.com/rss/valor/', 'https://g1.globo.com/rss/g1/politica/', 'https://www.gazetadopovo.com.br/feed/rss/republica.xml', 'https://oglobo.globo.com/rss/oglobo', 'https://www.estadao.com.br/arc/outboundfeeds/feeds/rss/sections/politica/', 'https://feeds.bloomberg.com/politics/news.rss', 'https://www.ft.com/world?format=rss', 'https://www.economist.com/international/rss.xml', 'https://www.nexojornal.com.br/rss.xml', 'https://rss.dw.com/xml/rss-br-all', 'https://feeds.bbci.co.uk/portuguese/rss.xml']) {
  const r = results[u];
  if (!r || !r.link) { console.log('skip', u); continue; }
  const p = await get(r.link.trim(), UAS.browser);
  const html = p.buf.toString('utf8');
  const ld = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const ldAuthor = (ld.join(' ').match(/"author"\s*:\s*(\[[\s\S]{0,400}?\]|\{[\s\S]{0,300}?\})/) || [''])[0].slice(0, 220);
  const metaAuthor = first(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)/i, html) || first(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']author["']/i, html);
  const og = first(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i, html);
  console.log(`[${u}]\n  page=${p.status} ${p.finalUrl || ''}\n  metaAuthor=${metaAuthor}\n  ldAuthor=${ldAuthor.replace(/\s+/g, ' ')}\n  og=${og}`);
}
