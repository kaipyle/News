// Fontes do Mirante.
//
// bias: linha editorial do VEÍCULO (não de cada texto), de -1 (esquerda) a +1 (direita).
//   Internacionais: referência em AllSides e Ad Fontes Media.
//   Brasil: não existe auditoria equivalente confiável; a nota é editorial e explicada em `note`.
// rigor: qualidade de apuração (checável), independente da linha editorial.
// feeds[].section: politica | mundo | economia | mercados | energia | opiniao | checagem | geral
// feeds[].bias: sobrescreve o viés do veículo para aquele feed (ex.: página de opinião do WSJ).
// maxAgeHours: até quanto tempo atrás manter matérias (veículos de ritmo semanal ganham mais).
// official: fonte primária (banco central, bolsa), não veículo jornalístico; fica fora da régua.
// titleStrip: trecho burocrático a tirar do começo dos títulos (regex).

export const SOURCES = [
  // ───────────── Brasil ─────────────
  {
    id: 'folha', name: 'Folha de S.Paulo', short: 'Folha', country: 'BR', lang: 'pt',
    bias: -0.15, rigor: 'alto', kind: 'Jornal', paywall: true,
    owner: 'Grupo Folha (família Frias)', url: 'https://www.folha.uol.com.br',
    note: 'Centro. Editorial progressista, mas publica colunistas de direita. Único grande veículo com ombudsman independente que critica o próprio jornal publicamente.',
    feeds: [
      { url: 'https://feeds.folha.uol.com.br/poder/rss091.xml', section: 'politica' },
      { url: 'https://feeds.folha.uol.com.br/mundo/rss091.xml', section: 'mundo' },
      { url: 'https://feeds.folha.uol.com.br/mercado/rss091.xml', section: 'economia' },
      { url: 'https://feeds.folha.uol.com.br/opiniao/rss091.xml', section: 'opiniao' },
    ],
  },
  {
    id: 'estadao', name: 'Estadão', short: 'Estadão', country: 'BR', lang: 'pt',
    bias: 0.4, rigor: 'alto', kind: 'Jornal', paywall: true,
    owner: 'Grupo Estado (família Mesquita)', url: 'https://www.estadao.com.br',
    note: 'Centro-direita liberal. Editoriais duros tanto com o PT quanto com o bolsonarismo. Apuração sólida.',
    feeds: [
      { url: 'https://www.estadao.com.br/arc/outboundfeeds/feeds/rss/sections/politica/', section: 'politica' },
      { url: 'https://www.estadao.com.br/arc/outboundfeeds/feeds/rss/sections/economia/', section: 'economia' },
      { url: 'https://www.estadao.com.br/arc/outboundfeeds/feeds/rss/sections/internacional/', section: 'mundo' },
      { url: 'https://www.estadao.com.br/arc/outboundfeeds/feeds/rss/sections/opiniao/', section: 'opiniao' },
    ],
  },
  {
    id: 'oglobo', name: 'O Globo', short: 'O Globo', country: 'BR', lang: 'pt',
    bias: 0.1, rigor: 'alto', kind: 'Jornal', paywall: true,
    owner: 'Grupo Globo (família Marinho)', url: 'https://oglobo.globo.com',
    note: 'Centro. Editorial liberal na economia; criticado pela esquerda e pela direita.',
    feeds: [{ url: 'https://oglobo.globo.com/rss/oglobo', section: 'geral' }],
  },
  {
    id: 'g1', name: 'g1', short: 'g1', country: 'BR', lang: 'pt',
    bias: 0, rigor: 'alto', kind: 'Portal', paywall: false,
    owner: 'Grupo Globo', url: 'https://g1.globo.com',
    note: 'Centro. Portal gratuito da Globo, noticiário factual e de serviço.',
    feeds: [
      { url: 'https://g1.globo.com/rss/g1/politica/', section: 'politica' },
      { url: 'https://g1.globo.com/rss/g1/economia/', section: 'economia' },
      { url: 'https://g1.globo.com/rss/g1/mundo/', section: 'mundo' },
    ],
  },
  {
    id: 'valor', name: 'Valor Econômico', short: 'Valor', country: 'BR', lang: 'pt',
    bias: 0.1, rigor: 'muito alto', kind: 'Jornal', paywall: true,
    owner: 'Grupo Globo', url: 'https://valor.globo.com',
    note: 'Centro. Jornal de economia da Globo, de tom sóbrio e técnico.',
    feeds: [
      { url: 'https://valor.globo.com/rss/valor/politica/', section: 'politica' },
      { url: 'https://valor.globo.com/rss/valor/financas/', section: 'mercados' },
      { url: 'https://valor.globo.com/rss/valor/mundo/', section: 'mundo' },
      { url: 'https://valor.globo.com/rss/valor/', section: 'economia' },
    ],
  },
  {
    id: 'poder360', name: 'Poder360', short: 'Poder360', country: 'BR', lang: 'pt',
    bias: 0, rigor: 'alto', kind: 'Digital', paywall: false,
    owner: 'Fernando Rodrigues (fundador)', url: 'https://www.poder360.com.br',
    note: 'Centro. O mais factual e seco do país: documentos, dados, pouca opinião.',
    feeds: [{ url: 'https://www.poder360.com.br/feed/', section: 'politica' }],
  },
  {
    id: 'cnnbrasil', name: 'CNN Brasil', short: 'CNN Brasil', country: 'BR', lang: 'pt',
    bias: 0.05, rigor: 'bom', kind: 'TV e digital', paywall: false,
    owner: 'Rubens Menin (MRV, Banco Inter)', url: 'https://www.cnnbrasil.com.br',
    note: 'Centro. Menin afirma não interferir e criou conselho editorial sem acionistas. Nasceu chamada de "Fox News brasileira" pela esquerda e de "esquerdista" pela direita. Lidera o ranking de confiança do Reuters Institute 2026 (62%), que mede percepção do público, não acurácia. A qualidade oscilou após as demissões de 2022-23.',
    feeds: [{ url: 'https://www.cnnbrasil.com.br/feed/', section: 'geral' }],
  },
  {
    id: 'jota', name: 'JOTA', short: 'JOTA', country: 'BR', lang: 'pt',
    bias: 0, rigor: 'muito alto', kind: 'Digital', paywall: true,
    owner: 'JOTA Jornalismo', url: 'https://www.jota.info',
    note: 'Centro. Especializado em Judiciário, STF, Congresso e regulação. Técnico e pouco opinativo.',
    feeds: [{ url: 'https://www.jota.info/feed', section: 'politica' }],
  },
  {
    id: 'bbcbrasil', name: 'BBC News Brasil', short: 'BBC Brasil', country: 'BR', lang: 'pt',
    bias: -0.05, rigor: 'muito alto', kind: 'Serviço público', paywall: false,
    owner: 'BBC (Reino Unido)', url: 'https://www.bbc.com/portuguese',
    note: 'Centro. Financiamento público britânico, sem vínculo com grupos econômicos brasileiros.',
    feeds: [{ url: 'https://feeds.bbci.co.uk/portuguese/rss.xml', section: 'geral' }],
  },
  {
    id: 'dwbrasil', name: 'DW Brasil', short: 'DW Brasil', country: 'BR', lang: 'pt',
    bias: -0.1, rigor: 'alto', kind: 'Serviço público', paywall: false,
    owner: 'Deutsche Welle (Alemanha)', url: 'https://www.dw.com/pt-br',
    note: 'Centro. Financiamento público alemão, sem vínculo com grupos econômicos brasileiros.',
    feeds: [{ url: 'https://rss.dw.com/xml/rss-br-all', section: 'geral' }],
  },
  {
    id: 'piaui', name: 'piauí', short: 'piauí', country: 'BR', lang: 'pt',
    bias: -0.45, rigor: 'muito alto', kind: 'Revista', paywall: true, maxAgeHours: 168,
    owner: 'Família Moreira Salles', url: 'https://piaui.uol.com.br',
    note: 'Centro-esquerda. Apuração excelente, mas não é imparcial: leia pela qualidade, não pela neutralidade.',
    feeds: [{ url: 'https://piaui.folha.uol.com.br/feed/', section: 'geral' }],
  },
  {
    id: 'nexo', name: 'Nexo Jornal', short: 'Nexo', country: 'BR', lang: 'pt',
    bias: -0.45, rigor: 'alto', kind: 'Digital', paywall: true, maxAgeHours: 120,
    owner: 'Nexo Jornal (independente)', url: 'https://www.nexojornal.com.br',
    note: 'Centro-esquerda. Explicativo, com dados e fontes acadêmicas.',
    feeds: [{ url: 'https://www.nexojornal.com.br/rss.xml', section: 'geral' }],
  },
  {
    id: 'publica', name: 'Agência Pública', short: 'Pública', country: 'BR', lang: 'pt',
    bias: -0.75, rigor: 'alto', kind: 'Investigação', paywall: false, maxAgeHours: 168,
    owner: 'Sem fins lucrativos (fundações e leitores)', url: 'https://apublica.org',
    note: 'Esquerda assumida. Jornalismo investigativo com documentação.',
    feeds: [{ url: 'https://apublica.org/feed/', section: 'geral' }],
  },
  {
    id: 'intercept', name: 'Intercept Brasil', short: 'Intercept', country: 'BR', lang: 'pt',
    bias: -0.8, rigor: 'bom', kind: 'Investigação', paywall: false, maxAgeHours: 168,
    owner: 'Sem fins lucrativos (leitores)', url: 'https://www.intercept.com.br',
    note: 'Esquerda assumida. Investigação de impacto, com tom militante em parte dos textos.',
    feeds: [{ url: 'https://www.intercept.com.br/feed/', section: 'geral' }],
  },
  {
    id: 'veja', name: 'Veja', short: 'Veja', country: 'BR', lang: 'pt',
    bias: 0.4, rigor: 'bom', kind: 'Revista', paywall: true,
    owner: 'Grupo Abril', url: 'https://veja.abril.com.br',
    note: 'Centro-direita. Maior revista semanal do país; tem histórico de capas sensacionalistas, mas a cobertura diária de política é de redação profissional.',
    feeds: [{ url: 'https://veja.abril.com.br/feed/', section: 'geral' }],
  },
  {
    id: 'gazeta', name: 'Gazeta do Povo', short: 'Gazeta', country: 'BR', lang: 'pt',
    bias: 0.75, rigor: 'bom', kind: 'Jornal', paywall: true,
    owner: 'Grupo GRPCOM (família Cunha Pereira)', url: 'https://www.gazetadopovo.com.br',
    note: 'Direita assumida, com apuração real. Acreditar na isenção dela é o mesmo erro de acreditar na isenção da piauí.',
    feeds: [
      { url: 'https://www.gazetadopovo.com.br/feed/rss/republica.xml', section: 'politica' },
      { url: 'https://www.gazetadopovo.com.br/feed/rss/economia.xml', section: 'economia' },
      { url: 'https://www.gazetadopovo.com.br/feed/rss/mundo.xml', section: 'mundo' },
    ],
  },
  {
    id: 'infomoney', name: 'InfoMoney', short: 'InfoMoney', country: 'BR', lang: 'pt',
    bias: 0.15, rigor: 'bom', kind: 'Digital', paywall: false,
    owner: 'XP Inc.', url: 'https://www.infomoney.com.br',
    note: 'Centro, com viés pró-mercado. Pertence a uma corretora: útil para o dia a dia da bolsa, não para análise independente do setor financeiro.',
    feeds: [{ url: 'https://www.infomoney.com.br/feed/', section: 'mercados' }],
  },
  {
    id: 'valorinveste', name: 'Valor Investe', short: 'Valor Investe', country: 'BR', lang: 'pt',
    bias: 0.1, rigor: 'alto', kind: 'Digital', paywall: false,
    owner: 'Grupo Globo', url: 'https://valorinveste.globo.com',
    note: 'Centro. Site gratuito de investimentos do Valor Econômico, voltado a quem investe por conta própria.',
    feeds: [{ url: 'https://valorinveste.globo.com/rss/valorinveste/', section: 'mercados' }],
  },
  {
    id: 'braziljournal', name: 'Brazil Journal', short: 'Brazil Journal', country: 'BR', lang: 'pt',
    bias: 0.35, rigor: 'alto', kind: 'Digital', paywall: false,
    owner: 'Independente (Geraldo Samor)', url: 'https://braziljournal.com',
    note: 'Centro-direita, pró-mercado assumido. Furos sobre empresas, fusões e gestoras; escreve para quem trabalha no mercado financeiro.',
    feeds: [{ url: 'https://braziljournal.com/feed/', section: 'mercados' }],
  },
  {
    id: 'neofeed', name: 'NeoFeed', short: 'NeoFeed', country: 'BR', lang: 'pt',
    bias: 0.25, rigor: 'alto', kind: 'Digital', paywall: false,
    owner: 'Independente', url: 'https://neofeed.com.br',
    note: 'Centro-direita moderada, pró-mercado. Negócios, startups, venture capital e mercado financeiro, com muitas entrevistas com executivos.',
    feeds: [{ url: 'https://neofeed.com.br/feed/', section: 'economia' }],
  },
  {
    id: 'bloomberglinea', name: 'Bloomberg Línea Brasil', short: 'Bloomberg Línea', country: 'BR', lang: 'pt',
    bias: 0, rigor: 'alto', kind: 'Digital', paywall: false,
    owner: 'Bloomberg Línea (empresa latino-americana com licença da marca Bloomberg)', url: 'https://www.bloomberglinea.com.br',
    note: 'Centro. Negócios e mercados na América Latina, com acesso ao noticiário da Bloomberg; tom técnico.',
    feeds: [{ url: 'https://www.bloomberglinea.com.br/arc/outboundfeeds/rss/?outputType=xml', section: 'economia' }],
  },
  {
    id: 'exame', name: 'Exame Invest', short: 'Exame', country: 'BR', lang: 'pt',
    bias: 0.35, rigor: 'bom', kind: 'Revista', paywall: false,
    owner: 'Sócios do BTG Pactual', url: 'https://exame.com/invest/',
    note: 'Centro-direita, pró-mercado. Pertence a sócios de um banco de investimento: útil no dia a dia dos investimentos, com conflito de interesse em temas do setor financeiro.',
    feeds: [{ url: 'https://exame.com/invest/feed/', section: 'mercados' }],
  },
  {
    id: 'b3', name: 'B3 (Bora Investir)', short: 'B3', country: 'BR', lang: 'pt',
    bias: 0, rigor: 'fonte primária', kind: 'Bolsa de valores', paywall: false, official: true, maxAgeHours: 120,
    owner: 'B3 S.A., empresa de capital aberto que opera a bolsa brasileira', url: 'https://borainvestir.b3.com.br/noticias/',
    note: 'Portal de notícias da própria bolsa. Fonte primária para avisos de negociação (circuit breaker, horários, índices e balanços); não é jornalismo independente e não critica o mercado.',
    feeds: [{ url: 'https://borainvestir.b3.com.br/noticias/feed/', section: 'mercados' }],
  },
  {
    id: 'bcb', name: 'Banco Central do Brasil', short: 'Banco Central', country: 'BR', lang: 'pt',
    bias: 0, rigor: 'fonte primária', kind: 'Fonte oficial', paywall: false, official: true, maxAgeHours: 168,
    titleStrip: /^BC\s*-\s*Copom Comunicado\s*-\s*\d+ª Reunião\s*-\s*/i,
    owner: 'Autarquia federal com autonomia garantida em lei (LC 179/2021)', url: 'https://www.bcb.gov.br',
    note: 'Comunicados do Copom, notas à imprensa e estatísticas oficiais. É a fonte primária sobre juros, câmbio e regras bancárias; as interpretações ficam com os veículos.',
    feeds: [
      { url: 'https://www.bcb.gov.br/api/feed/sitebcb/sitefeeds/comunicadoscopom', section: 'mercados' },
      { url: 'https://www.bcb.gov.br/api/feed/sitebcb/sitefeeds/notasImprensa', section: 'mercados' },
      { url: 'https://www.bcb.gov.br/api/feed/sitebcb/sitefeeds/noticias', section: 'economia' },
    ],
  },
  {
    id: 'aosfatos', name: 'Aos Fatos', short: 'Aos Fatos', country: 'BR', lang: 'pt',
    bias: -0.1, rigor: 'muito alto', kind: 'Checagem', paywall: false, maxAgeHours: 168,
    owner: 'Independente (signatário IFCN)', url: 'https://www.aosfatos.org',
    note: 'Checagem de fatos. Use para auditar os demais. Criticado pela direita, que vê mais checagens contra o seu campo.',
    feeds: [{ url: 'https://www.aosfatos.org/noticias/feed/', section: 'checagem' }],
  },
  {
    id: 'lupa', name: 'Agência Lupa', short: 'Lupa', country: 'BR', lang: 'pt',
    bias: -0.1, rigor: 'muito alto', kind: 'Checagem', paywall: false, maxAgeHours: 168,
    owner: 'Independente (signatário IFCN)', url: 'https://www.agencialupa.org',
    note: 'Checagem de fatos. Use para auditar os demais.',
    feeds: [{ url: 'https://lupa.uol.com.br/feed/', section: 'checagem' }],
  },

  // ───────────── Internacional ─────────────
  {
    id: 'reuters', name: 'Reuters', short: 'Reuters', country: 'GB', lang: 'en',
    bias: 0, rigor: 'muito alto', kind: 'Agência', paywall: false, googleNews: true,
    owner: 'Thomson Reuters', url: 'https://www.reuters.com',
    note: 'Centro. Agência de notícias: o mais próximo de "só o fato" que existe. Sem feed público próprio; os títulos chegam via Google Notícias, sem autor.',
    feeds: [
      { url: 'https://news.google.com/rss/search?q=when:2d+site:reuters.com/world&hl=en-US&gl=US&ceid=US:en', section: 'mundo' },
      { url: 'https://news.google.com/rss/search?q=when:2d+site:reuters.com/markets&hl=en-US&gl=US&ceid=US:en', section: 'mercados' },
      { url: 'https://news.google.com/rss/search?q=when:2d+site:reuters.com/business/energy&hl=en-US&gl=US&ceid=US:en', section: 'energia' },
      { url: 'https://news.google.com/rss/search?q=when:2d+site:reuters.com&hl=en-US&gl=US&ceid=US:en', section: 'geral' },
    ],
  },
  {
    id: 'ap', name: 'Associated Press', short: 'AP', country: 'US', lang: 'en',
    bias: -0.15, rigor: 'muito alto', kind: 'Agência', paywall: false, googleNews: true,
    owner: 'Cooperativa sem fins lucrativos', url: 'https://apnews.com',
    note: 'Centro. Agência de notícias cooperativa. Sem feed público próprio; os títulos chegam via Google Notícias, sem autor.',
    feeds: [{ url: 'https://news.google.com/rss/search?q=when:2d+site:apnews.com&hl=en-US&gl=US&ceid=US:en', section: 'geral' }],
  },
  {
    id: 'bbc', name: 'BBC News', short: 'BBC', country: 'GB', lang: 'en',
    bias: -0.1, rigor: 'muito alto', kind: 'Serviço público', paywall: false,
    owner: 'BBC (serviço público britânico)', url: 'https://www.bbc.com/news',
    note: 'Centro. Serviço público financiado pela taxa de licença britânica.',
    feeds: [
      { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', section: 'mundo' },
      { url: 'https://feeds.bbci.co.uk/news/world/latin_america/rss.xml', section: 'mundo' },
      { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', section: 'economia' },
    ],
  },
  {
    id: 'ft', name: 'Financial Times', short: 'FT', country: 'GB', lang: 'en',
    bias: 0, rigor: 'muito alto', kind: 'Jornal', paywall: true,
    owner: 'Nikkei Inc.', url: 'https://www.ft.com',
    note: 'Centro-liberal. A melhor cobertura econômica global. O feed não informa autor.',
    feeds: [
      { url: 'https://www.ft.com/world?format=rss', section: 'mundo' },
      { url: 'https://www.ft.com/global-economy?format=rss', section: 'economia' },
      { url: 'https://www.ft.com/markets?format=rss', section: 'mercados' },
    ],
  },
  {
    id: 'economist', name: 'The Economist', short: 'Economist', country: 'GB', lang: 'en',
    bias: -0.15, rigor: 'muito alto', kind: 'Revista', paywall: true, maxAgeHours: 168, noBylines: true,
    owner: 'The Economist Group (família Agnelli/Exor é a maior acionista)', url: 'https://www.economist.com',
    note: 'Centro (liberalismo clássico). Opinativa, mas transparente sobre isso. Não assina textos por política editorial.',
    feeds: [
      { url: 'https://www.economist.com/leaders/rss.xml', section: 'opiniao' },
      { url: 'https://www.economist.com/international/rss.xml', section: 'mundo' },
      { url: 'https://www.economist.com/the-americas/rss.xml', section: 'mundo' },
      { url: 'https://www.economist.com/finance-and-economics/rss.xml', section: 'economia' },
    ],
  },
  {
    id: 'wsj', name: 'The Wall Street Journal', short: 'WSJ', country: 'US', lang: 'en',
    bias: 0.2, rigor: 'muito alto', kind: 'Jornal', paywall: true,
    owner: 'News Corp (família Murdoch)', url: 'https://www.wsj.com',
    note: 'Reportagem de centro, página editorial de direita: não confunda as duas. O Mirante marca os textos de opinião do WSJ com viés de direita.',
    feeds: [
      { url: 'https://feeds.content.dowjones.io/public/rss/RSSWorldNews', section: 'mundo' },
      { url: 'https://feeds.content.dowjones.io/public/rss/RSSMarketsMain', section: 'mercados' },
      { url: 'https://feeds.content.dowjones.io/public/rss/WSJcomUSBusiness', section: 'economia' },
      { url: 'https://feeds.content.dowjones.io/public/rss/RSSOpinion', section: 'opiniao', bias: 0.7 },
    ],
  },
  {
    id: 'nyt', name: 'The New York Times', short: 'NYT', country: 'US', lang: 'en',
    bias: -0.45, rigor: 'muito alto', kind: 'Jornal', paywall: true,
    owner: 'The New York Times Company (família Sulzberger)', url: 'https://www.nytimes.com',
    note: 'Centro-esquerda, apuração forte.',
    feeds: [
      { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', section: 'mundo' },
      { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Americas.xml', section: 'mundo' },
      { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml', section: 'mundo' },
      { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Economy.xml', section: 'economia' },
    ],
  },
  {
    id: 'bloomberg', name: 'Bloomberg', short: 'Bloomberg', country: 'US', lang: 'en',
    bias: -0.15, rigor: 'muito alto', kind: 'Agência', paywall: true,
    owner: 'Michael Bloomberg', url: 'https://www.bloomberg.com',
    note: 'Centro. Foco em mercados, pouco ideológico.',
    feeds: [
      { url: 'https://feeds.bloomberg.com/markets/news.rss', section: 'mercados' },
      { url: 'https://feeds.bloomberg.com/economics/news.rss', section: 'economia' },
      { url: 'https://feeds.bloomberg.com/politics/news.rss', section: 'mundo' },
    ],
  },
  {
    id: 'guardian', name: 'The Guardian', short: 'Guardian', country: 'GB', lang: 'en',
    bias: -0.55, rigor: 'alto', kind: 'Jornal', paywall: false,
    owner: 'Scott Trust (sem fins lucrativos)', url: 'https://www.theguardian.com',
    note: 'Centro-esquerda. Gratuito, mantido por fundação e doações de leitores.',
    feeds: [
      { url: 'https://www.theguardian.com/world/rss', section: 'mundo' },
      { url: 'https://www.theguardian.com/world/americas/rss', section: 'mundo' },
      { url: 'https://www.theguardian.com/business/rss', section: 'economia' },
    ],
  },
  {
    id: 'telegraph', name: 'The Telegraph', short: 'Telegraph', country: 'GB', lang: 'en',
    bias: 0.5, rigor: 'alto', kind: 'Jornal', paywall: true,
    owner: 'Telegraph Media Group', url: 'https://www.telegraph.co.uk',
    note: 'Centro-direita, próximo ao Partido Conservador britânico.',
    feeds: [
      { url: 'https://www.telegraph.co.uk/rss.xml', section: 'geral' },
      { url: 'https://www.telegraph.co.uk/news/rss.xml', section: 'geral' },
      { url: 'https://www.telegraph.co.uk/business/rss.xml', section: 'economia' },
    ],
  },
  {
    id: 'politico', name: 'Politico', short: 'Politico', country: 'US', lang: 'en',
    bias: -0.3, rigor: 'alto', kind: 'Digital', paywall: false,
    owner: 'Axel Springer', url: 'https://www.politico.com',
    note: 'Centro-esquerda leve. Bastidores de Washington e de Bruxelas (Politico Europe).',
    feeds: [
      { url: 'https://rss.politico.com/politics-news.xml', section: 'mundo' },
      { url: 'https://www.politico.eu/feed/', section: 'mundo' },
    ],
  },
  {
    id: 'aljazeera', name: 'Al Jazeera', short: 'Al Jazeera', country: 'QA', lang: 'en',
    bias: -0.35, rigor: 'bom', kind: 'TV e digital', paywall: false,
    owner: 'Estado do Catar', url: 'https://www.aljazeera.com',
    note: 'Centro-esquerda. Forte em Oriente Médio e Sul Global, mas é financiada pelo governo do Catar: desconfie da cobertura sobre o próprio Catar e seus aliados.',
    feeds: [{ url: 'https://www.aljazeera.com/xml/rss/all.xml', section: 'mundo' }],
  },
  {
    id: 'dw', name: 'Deutsche Welle', short: 'DW', country: 'DE', lang: 'en',
    bias: -0.1, rigor: 'alto', kind: 'Serviço público', paywall: false,
    owner: 'Governo alemão (serviço público)', url: 'https://www.dw.com/en',
    note: 'Centro. Emissora pública internacional da Alemanha.',
    feeds: [
      { url: 'https://rss.dw.com/xml/rss-en-world', section: 'mundo' },
      { url: 'https://rss.dw.com/xml/rss-en-bus', section: 'economia' },
    ],
  },
  {
    id: 'lemonde', name: 'Le Monde (English)', short: 'Le Monde', country: 'FR', lang: 'en',
    bias: -0.35, rigor: 'muito alto', kind: 'Jornal', paywall: true,
    owner: 'Groupe Le Monde (Xavier Niel e outros)', url: 'https://www.lemonde.fr/en/',
    note: 'Centro-esquerda. Edição em inglês do principal jornal francês.',
    feeds: [{ url: 'https://www.lemonde.fr/en/international/rss_full.xml', section: 'mundo' }],
  },
  {
    id: 'foreignpolicy', name: 'Foreign Policy', short: 'Foreign Policy', country: 'US', lang: 'en',
    bias: -0.1, rigor: 'alto', kind: 'Revista', paywall: true, maxAgeHours: 120,
    owner: 'Graham Holdings', url: 'https://foreignpolicy.com',
    note: 'Centro. Análise de política internacional por especialistas; mais análise do que notícia.',
    feeds: [{ url: 'https://foreignpolicy.com/feed/', section: 'mundo', analysis: true }],
  },
  {
    id: 'cnbc', name: 'CNBC', short: 'CNBC', country: 'US', lang: 'en',
    bias: -0.1, rigor: 'alto', kind: 'TV e digital', paywall: false,
    owner: 'NBCUniversal (Comcast)', url: 'https://www.cnbc.com',
    note: 'Centro. Canal de negócios americano: cobertura rápida de Wall Street e das empresas, com tom de mercado.',
    feeds: [
      { url: 'https://www.cnbc.com/id/15839069/device/rss/rss.html', section: 'mercados' },
      { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', section: 'economia' },
    ],
  },
  {
    id: 'fed', name: 'Federal Reserve', short: 'Fed', country: 'US', lang: 'en',
    bias: 0, rigor: 'fonte primária', kind: 'Fonte oficial', paywall: false, official: true, maxAgeHours: 168,
    owner: 'Banco central dos Estados Unidos', url: 'https://www.federalreserve.gov',
    note: 'Comunicados oficiais do banco central americano: decisões de juros, atas e medidas de supervisão bancária.',
    feeds: [{ url: 'https://www.federalreserve.gov/feeds/press_all.xml', section: 'mercados' }],
  },
];

export const COUNTRIES = {
  BR: 'Brasil', US: 'Estados Unidos', GB: 'Reino Unido', DE: 'Alemanha', FR: 'França', QA: 'Catar',
};

// Faixas da régua. Os limites são inclusivos do lado do centro.
export function biasBucket(x) {
  if (x <= -0.6) return 'esquerda';
  if (x <= -0.25) return 'centro-esquerda';
  if (x < 0.25) return 'centro';
  if (x < 0.6) return 'centro-direita';
  return 'direita';
}
