// Temas e regiões. A classificação combina a seção do feed com palavras-chave no título e
// no resumo. As palavras são comparadas sem acento e em minúsculas, sempre como palavra
// inteira (um `*` no fim aceita qualquer sufixo: "bombarde*" casa "bombardeio", "bombardeiam").
// `cased`: termos que só valem com a caixa exata (ex.: "IA" e não "ia").
// `not`: expressões descartadas antes de procurar o tema ("guerra comercial" não é guerra).
// `scope`: 'br' = só vale por palavra-chave em veículos brasileiros; 'int' = só em internacionais.
//   Fora do escopo, o tema ainda pode vir da seção do feed ou exigir a região certa (ver classify).

export const TOPICS = [
  {
    id: 'politica-br', label: 'Política brasileira', short: 'Política BR',
    words: [
      'lula', 'bolsonaro', 'bolsonarismo', 'bolsonarista*', 'petista*', 'stf', 'tse', 'congresso nacional',
      'camara dos deputados', 'senado federal', 'planalto', 'alckmin', 'haddad', 'tarcisio', 'alexandre de moraes',
      'hugo motta', 'alcolumbre', 'governo federal', 'governo lula', 'esplanada', 'centrao', 'deputado federal',
      'deputada federal', 'michelle bolsonaro', 'flavio bolsonaro', 'eduardo bolsonaro', 'zanin', 'flavio dino',
      'gilmar mendes', 'pgr', 'brasilia',
    ],
    cased: ['PT', 'PL', 'MDB', 'PSD', 'PSOL', 'União Brasil'],
  },
  {
    id: 'eleicoes', label: 'Eleições', short: 'Eleições',
    words: [
      'eleicao', 'eleicoes', 'eleitoral', 'eleitorais', 'eleitor*', 'segundo turno', '2o turno', 'primeiro turno',
      'urna*', 'apuracao', 'candidat*', 'pesquisa eleitoral', 'reeleicao', 'reeleit*', 'election*', 'ballot*',
      'runoff', 'midterm*', 'polling station*', 'voters', 'turnout', 're-election', 're-elected',
    ],
  },
  {
    id: 'justica', label: 'Justiça e STF', short: 'Justiça',
    words: [
      'stf', 'supremo', 'tse', 'stj', 'pgr', 'policia federal', 'delacao', 'julgamento', 'inquerito', 'tribunal',
      'ministro do stf', 'ministra do stf', 'alexandre de moraes', 'zanin', 'andre mendonca', 'supreme court',
      'indictment', 'indicted', 'on trial', 'stands trial', 'prosecutors', 'court ruling',
    ],
  },
  {
    id: 'politica-int', label: 'Política internacional', short: 'Internacional',
    words: [
      'trump', 'casa branca', 'white house', 'putin', 'kremlin', 'xi jinping', 'netanyahu', 'zelensky', 'milei',
      'maduro', 'onu', 'united nations', 'otan', 'nato', 'uniao europeia', 'european union', 'g20', 'g7', 'brics',
      'diplomac*', 'sancao', 'sancoes', 'sanction*', 'embaixad*', 'chanceler', 'foreign minister', 'parliament*',
      'parlamento', 'primeiro-ministro', 'prime minister', 'von der leyen', 'macron', 'starmer', 'merz', 'erdogan',
      'modi', 'cupula', 'summit', 'geopolitic*',
    ],
  },
  {
    id: 'guerras', label: 'Guerras e conflitos', short: 'Guerras',
    words: [
      'guerra', 'guerras', 'conflito armado', 'bombarde*', 'ataque aereo', 'ataques aereos', 'missil', 'misseis',
      'cessar-fogo', 'cessar fogo', 'ofensiva militar', 'tropas', 'drones', 'hamas', 'hezbollah', 'houthi*', 'huti*',
      'gaza', 'cisjordania', 'ucrania', 'ucraniano*', 'frente de batalha', 'genocidio', 'refens', 'war', 'wars',
      'warfare', 'ceasefire', 'missile*', 'airstrike*', 'air strike*', 'troops', 'invasion', 'shelling', 'frontline',
      'front line', 'hostage*', 'militant*', 'insurgen*', 'west bank', 'ukraine', 'ukrainian*', 'el fasher',
      'paramilitar*', 'paramilitary', 'terror attack', 'ataque terrorista', 'military strike*',
    ],
    not: ['guerra comercial', 'guerra tarifaria', 'guerra fiscal', 'guerra de precos', 'guerra cultural', 'guerra as drogas', 'trade war*', 'price war*', 'culture war*', 'war on drugs', 'star wars'],
  },
  {
    id: 'petroleo', label: 'Petróleo e energia', short: 'Petróleo',
    words: [
      'petroleo', 'petrobras', 'opep', 'brent', 'wti', 'barril', 'barris', 'combustivel', 'combustiveis', 'gasolina',
      'diesel', 'pre-sal', 'refinaria*', 'gas natural', 'gnl', 'oil', 'crude', 'opec', 'barrels', 'gasoline',
      'refiner*', 'lng', 'natural gas', 'oilfield*', 'oil pipeline*', 'oleoduto*', 'gasoduto*', 'energy prices',
      'precos de energia', 'fuel prices', 'fuel supplies', 'aramco', 'exxon', 'chevron',
    ],
  },
  {
    id: 'mercados', label: 'Bolsa, juros e câmbio', short: 'Bolsa',
    words: [
      'ibovespa', 'b3', 'bolsa de valores', 'bolsa brasileira', 'dolar', 'cambio', 'selic', 'copom', 'juros futuros',
      'dividendo*', 'fundos imobiliarios', 'renda fixa', 'debenture*', 'cvm', 'proventos', 'follow-on', 'small caps',
      'curva de juros', 'tesouro direto', 'titulos publicos', 'circuit breaker', 'investidor*', 'mercado financeiro',
      'wall street', 's&p 500', 'nasdaq', 'dow jones', 'stocks', 'stock market', 'stock exchange', 'share price*',
      'bonds', 'bond market', 'bond yield*', 'treasuries', 'treasury yield*', 'federal reserve', 'rate cut*',
      'rate hike*', 'interest rate*', 'ipo', 'hedge fund*', 'equities', 'forex', 'bitcoin', 'cripto*', 'crypto*',
      'banco central', 'central bank*', 'ecb', 'bce', 'investors', 'valuation', 'earnings',
    ],
    cased: ['Fed'],
  },
  {
    id: 'economia-int', label: 'Economia internacional', short: 'Economia int.', scope: 'int',
    words: [
      'inflation', 'gdp', 'recession', 'tariff*', 'trade war', 'imf', 'world bank', 'economy', 'economic*',
      'fmi', 'banco mundial', 'tarifa*', 'guerra comercial', 'recessao', 'economia global', 'economia mundial',
      'global economy', 'supply chain*', 'exports', 'imports', 'exportac*', 'importac*',
    ],
  },
  {
    id: 'economia-br', label: 'Economia brasileira', short: 'Economia BR', scope: 'br',
    words: [
      'pib', 'inflacao', 'ipca', 'arcabouco fiscal', 'meta fiscal', 'deficit', 'superavit', 'divida publica',
      'reforma tributaria', 'imposto de renda', 'orcamento', 'gasto publico', 'gastos publicos', 'desemprego',
      'salario minimo', 'ministerio da fazenda', 'receita federal', 'bndes', 'agronegocio', 'safra',
    ],
  },
  {
    id: 'tecnologia', label: 'Tecnologia e IA', short: 'Tecnologia',
    words: [
      'inteligencia artificial', 'artificial intelligence', 'big tech*', 'openai', 'anthropic', 'nvidia', 'chatgpt',
      'semicondutor*', 'semiconductor*', 'chipmaker*', 'microchip*', 'algoritmo*', 'algorithm*', 'ciberataque*',
      'cyberattack*', 'hacker*', 'data center*', 'datacenter*', 'startup*', 'deepmind', 'microsoft', 'alphabet',
    ],
    cased: ['IA', 'AI'],
  },
  {
    id: 'clima', label: 'Clima e meio ambiente', short: 'Clima',
    words: [
      'mudanca climatica', 'mudancas climaticas', 'crise climatica', 'climatic*', 'aquecimento global',
      'desmatamento', 'amazonia', 'cop30', 'cop31', 'enchente*', 'queimada*', 'incendio florestal', 'estiagem',
      'emissoes', 'carbono', 'climate', 'emissions', 'wildfire*', 'floods', 'flooding', 'hurricane*', 'furacao',
      'heatwave*', 'onda de calor', 'deforestation', 'renewable*', 'renovave*',
    ],
  },
  {
    id: 'checagem', label: 'Checagem de fatos', short: 'Checagem',
    words: ['e falso', 'e enganoso', 'checagem', 'fact-check*', 'fact check*', 'desinformacao', 'disinformation', 'misinformation'],
  },
];

// Regiões das notícias (não do veículo).
export const REGIONS = [
  { id: 'brasil', label: 'Brasil', words: ['brasil', 'brazil', 'brazilian*', 'brasileir*', 'lula', 'bolsonaro', 'sao paulo', 'rio de janeiro', 'brasilia'] },
  { id: 'eua', label: 'EUA', words: ['eua', 'estados unidos', 'norte-american*', 'trump', 'casa branca', 'washington', 'white house', 'republicans', 'democrats', 'pentagon', 'pentagono', 'gop'], cased: ['US', 'U.S.'] },
  { id: 'america-latina', label: 'América Latina', words: ['argentina', 'argentin*', 'milei', 'venezuela*', 'maduro', 'colombia*', 'chile', 'chilen*', 'chilean*', 'mexico', 'mexican*', 'mexicano*', 'peru', 'bolivia*', 'uruguai', 'uruguay', 'paraguai', 'paraguay', 'equador', 'ecuador', 'cuba', 'america latina', 'latin america*', 'latam'] },
  { id: 'europa', label: 'Europa', words: ['europa', 'europe', 'european*', 'europeu*', 'europeia*', 'reino unido', 'britain', 'british', 'alemanha', 'germany', 'german', 'franca', 'france', 'french', 'italia', 'italy', 'espanha', 'spain', 'bruxelas', 'brussels', 'londres', 'london', 'berlim', 'berlin', 'polonia', 'poland', 'serbia'], cased: ['UK', 'UE', 'EU'] },
  { id: 'russia-ucrania', label: 'Rússia e Ucrânia', words: ['russia', 'russo', 'russos', 'russa', 'russas', 'russian*', 'ucrania', 'ucraniano*', 'ukraine', 'ukrainian*', 'putin', 'zelensky', 'kremlin', 'kiev', 'kyiv', 'moscou', 'moscow'] },
  { id: 'oriente-medio', label: 'Oriente Médio', words: ['israel', 'israelense*', 'israeli*', 'gaza', 'ira', 'iran*', 'arabia saudita', 'saudi*', 'iemen', 'yemen*', 'libano', 'lebanon', 'siria', 'syria*', 'catar', 'qatar', 'houthi*', 'hamas', 'hezbollah', 'palestin*', 'oriente medio', 'middle east', 'jordania', 'iraque', 'iraq', 'egito', 'egypt', 'tehran', 'teera'] },
  { id: 'china', label: 'China e Ásia', words: ['china', 'chines*', 'chinese', 'pequim', 'beijing', 'xi jinping', 'taiwan', 'hong kong', 'japao', 'japan*', 'india', 'indian', 'indonesia*', 'coreia', 'korea*', 'asia', 'asian'] },
  { id: 'africa', label: 'África', words: ['africa', 'african*', 'africano*', 'sudao', 'sudan*', 'nigeria*', 'etiopia', 'ethiopia*', 'congo', 'mali', 'sahel', 'quenia', 'kenya', 'somalia'] },
];

// Seção do feed → temas de partida (a origem do veículo decide BR x internacional).
export const SECTION_TOPICS = {
  politica: { BR: ['politica-br'], INT: ['politica-int'] },
  mundo: { BR: ['politica-int'], INT: ['politica-int'] },
  economia: { BR: ['economia-br'], INT: ['economia-int'] },
  mercados: { BR: ['mercados'], INT: ['mercados', 'economia-int'] },
  energia: { BR: ['petroleo'], INT: ['petroleo'] },
  checagem: { BR: ['checagem'], INT: ['checagem'] },
  opiniao: { BR: [], INT: [] },
  geral: { BR: [], INT: [] },
};

// Trechos de URL que indicam a seção real da matéria (vale mais que a seção do feed).
export const URL_SECTIONS = [
  { re: /\/(poder|politica|eleicoes|eleicoes-\d{4}|poder-eleicoes-\d{4}|republica|brasilia)\//i, section: 'politica' },
  { re: /\/(mundo|internacional|world|international)\//i, section: 'mundo' },
  { re: /\/(einvestidor|investimentos|mercados|markets|financas)\//i, section: 'mercados' },
  { re: /\/(economia|mercado|business|economy|negocios|agronegocio)\//i, section: 'economia' },
  { re: /\/(verificacao|checamos|fato-ou-fake)\//i, section: 'checagem' },
];

// Matérias fora do escopo de um hub de notícias (esporte, entretenimento, serviço local).
export const EXCLUDE_URL = /\/(esportes?|futebol|sport|sports|football|celebridades|entretenimento|famosos|horoscopo|receitas?|recipes?|novelas|bbb\d*|casual|pop-arte|tv-e-lazer|lifestyle|travel|viagem|turismo|fashion|moda|beauty|puzzles|crosswords?|gastronomia|kogut|rioshow|loterias|bem-estar|games|culture|film|music|tv-and-radio|books|gardening|family|cars|motoring|health-fitness|luxury|podcasts?|videos?|newsletters?|horoscopes?|obituaries)\//i;
