// Mirante — app de leitura. Sem dependências: lê data/feed.json e desenha tudo no cliente.

const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const store = {
  get(k, d) { try { const v = localStorage.getItem('mirante:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('mirante:' + k, JSON.stringify(v)); } catch {} },
};

// ───────────────────────── Vocabulário ─────────────────────────

const ICONS = {
  inicio: '<path d="M4 5h13v14H6a2 2 0 0 1-2-2V5Z"/><path d="M17 9h3v8a2 2 0 0 1-2 2"/><path d="M7.5 9h6M7.5 12.5h6M7.5 16h4"/>',
  brasil: '<path d="M12 4v16M8 20h8M5 7.5h14"/><path d="M5 7.5 2.5 13a2.6 2.6 0 0 0 5 0L5 7.5ZM19 7.5 16.5 13a2.6 2.6 0 0 0 5 0L19 7.5Z"/>',
  mundo: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.6 3.5 5.4 3.5 8.5s-1.1 5.9-3.5 8.5c-2.4-2.6-3.5-5.4-3.5-8.5s1.1-5.9 3.5-8.5Z"/>',
  economia: '<path d="M4 19.5h16"/><path d="m5 15 4-4 3 3 6.5-6.5"/><path d="M14.5 7.5h4v4"/>',
  fontes: '<path d="M4 6.5h16M4 12h16M4 17.5h16"/><path d="M14 4.5v4M9 10v4M16 15.5v4"/>',
  back: '<path d="M15 5 8 12l7 7"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  close: '<path d="M7 7l10 10M17 7 7 17"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  out: '<path d="M14 5h5v5M19 5l-8 8M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4"/>',
};
const icon = (name, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

const VIEWS = [
  { id: 'inicio', label: 'Início' },
  { id: 'brasil', label: 'Brasil' },
  { id: 'mundo', label: 'Mundo' },
  { id: 'economia', label: 'Economia' },
  { id: 'fontes', label: 'Fontes' },
];

const BUCKETS = [
  { id: 'esquerda', label: 'Esquerda' },
  { id: 'centro-esquerda', label: 'Centro-esquerda' },
  { id: 'centro', label: 'Centro' },
  { id: 'centro-direita', label: 'Centro-direita' },
  { id: 'direita', label: 'Direita' },
];
const bucketOf = (x) => (x <= -0.6 ? 'esquerda' : x <= -0.25 ? 'centro-esquerda' : x < 0.25 ? 'centro' : x < 0.6 ? 'centro-direita' : 'direita');
const bucketLabel = (x) => BUCKETS.find((b) => b.id === bucketOf(x)).label;
const laneOf = (x) => (x <= -0.25 ? 'e' : x >= 0.25 ? 'd' : 'c');
const LANES = { e: 'Esquerda', c: 'Centro', d: 'Direita' };

const VIEW_CHIPS = {
  inicio: ['ultima-hora', 'guerras', 'petroleo', 'mercados', 'politica-int', 'economia-int', 'eleicoes', 'justica', 'tecnologia', 'clima', 'checagem'],
  brasil: ['eleicoes', 'justica', 'economia-br', 'checagem'],
  mundo: ['guerras', 'r:eua', 'r:america-latina', 'r:europa', 'r:russia-ucrania', 'r:oriente-medio', 'r:china', 'r:africa', 'economia-int'],
  economia: ['mercados', 'petroleo', 'economia-br', 'economia-int', 'tecnologia'],
};
const ECON = ['economia-br', 'economia-int', 'mercados', 'petroleo'];
const HOUR = 3600e3;

// ───────────────────────── Estado ─────────────────────────

const state = {
  data: null,
  src: {},
  route: null,
  limit: 30,
  read: new Set(store.get('read', [])),
  translate: store.get('translate', false), // matérias em inglês exibidas em português
  subs: new Set(store.get('subs', [])), // veículos pagos que o leitor assina
  readable: store.get('readable', false), // mostrar só gratuitos + assinaturas
  pending: null, // feed novo aguardando o leitor tocar em "novas matérias"
  lastCheck: 0,
  lastFocus: null,
  stack: [],
  renderedHash: null,
};

function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const p = new URLSearchParams(query);
  const list = (k) => (p.get(k) ? p.get(k).split(',').filter(Boolean) : []);
  const view = VIEWS.some((v) => v.id === path) ? path : 'inicio';
  return {
    view,
    tema: list('tema'),
    lado: list('lado'),
    pais: list('pais'),
    idioma: p.get('idioma') || '',
    tipo: p.get('tipo') || '',
    fonte: p.get('fonte') || '',
    autor: p.get('autor') || '',
    q: p.get('q') || '',
    lane: p.get('lane') || 'todos',
  };
}

function buildHash(r) {
  const p = new URLSearchParams();
  for (const k of ['tema', 'lado', 'pais']) if (r[k]?.length) p.set(k, r[k].join(','));
  for (const k of ['idioma', 'tipo', 'fonte', 'autor', 'q']) if (r[k]) p.set(k, r[k]);
  if (r.view === 'brasil' && r.lane && r.lane !== 'todos') p.set('lane', r.lane);
  const qs = p.toString().replace(/%2C/g, ',');
  return `#/${r.view === 'inicio' ? '' : r.view}${qs ? '?' + qs : ''}`;
}

const EMPTY = { tema: [], lado: [], pais: [], idioma: '', tipo: '', fonte: '', autor: '', q: '', lane: 'todos' };

function go(patch, { replace = false, fresh = false } = {}) {
  const base = fresh ? { ...EMPTY, view: state.route.view } : state.route;
  const next = buildHash({ ...base, ...patch });
  if (next === location.hash || (next === '#/' && !location.hash)) return render();
  if (replace) history.replaceState(null, '', next);
  else history.pushState(null, '', next);
  onRoute({ replace });
}

const filterCount = (r) => r.tema.length + r.lado.length + r.pais.length + (r.idioma ? 1 : 0) + (r.tipo ? 1 : 0) + (state.readable ? 1 : 0);
const canRead = (s) => !s.paywall || state.subs.has(s.id);

// ───────────────────────── Dados ─────────────────────────

const biasOf = (a) => a.b ?? state.src[a.s].bias;
const has = (a, t) => a.tp?.includes(t);
const FOREIGN = ['eua', 'america-latina', 'europa', 'russia-ucrania', 'oriente-medio', 'china', 'africa'];
const isForeign = (a) => a.rg?.some((r) => FOREIGN.includes(r));
const hay = (a) => (a._hay ||= fold(`${a.t} ${a.x || ''} ${a.tt || ''} ${a.tx || ''} ${(a.by || []).join(' ')} ${state.src[a.s].name}`));

// Tradução: títulos e resumos vêm traduzidos da coleta; a matéria abre pelo Google Tradutor.
const translated = (a) => state.translate && !!a.tt;
const titleOf = (a) => (translated(a) ? a.tt : a.t);
const excerptOf = (a) => (translated(a) ? a.tx || a.x : a.x);
function linkOf(a) {
  if (!translated(a) || state.src[a.s].googleNews) return a.u;
  try {
    const u = new URL(a.u);
    const host = u.hostname.replace(/-/g, '--').replace(/\./g, '-');
    const qs = new URLSearchParams(u.search);
    qs.set('_x_tr_sl', 'en'); qs.set('_x_tr_tl', 'pt'); qs.set('_x_tr_hl', 'pt-BR'); qs.set('_x_tr_pto', 'wapp');
    return `https://${host}.translate.goog${u.pathname}?${qs}`;
  } catch {
    return a.u;
  }
}
const storyTitle = (st) => { const ref = state.byId.get(st.id); return ref ? titleOf(ref) : st.title; };

function matchTema(a, t) {
  if (t === 'ultima-hora') return Date.now() - a.d < 3 * HOUR;
  if (t.startsWith('r:')) return a.rg?.includes(t.slice(2));
  return has(a, t);
}

function inView(a, view) {
  if (view === 'brasil') return has(a, 'politica-br');
  if (view === 'mundo') return (has(a, 'politica-int') || has(a, 'guerras')) && (!has(a, 'politica-br') || isForeign(a));
  if (view === 'economia') return ECON.some((t) => has(a, t));
  return true;
}

function select(r, { ignoreView = false } = {}) {
  const terms = fold(r.q).split(/\s+/).filter(Boolean);
  const scoped = !(r.fonte || r.autor) && !ignoreView;
  return state.data.articles.filter((a) => {
    const s = state.src[a.s];
    if (scoped && !inView(a, r.view)) return false;
    if (r.fonte && a.s !== r.fonte) return false;
    if (r.autor && !a.by?.includes(r.autor)) return false;
    if (r.tema.length && !r.tema.some((t) => matchTema(a, t))) return false;
    if (r.lado.length && !r.lado.includes(bucketOf(biasOf(a)))) return false;
    if (r.pais.length && !r.pais.includes(s.country)) return false;
    if (r.idioma && s.lang !== r.idioma) return false;
    if (r.tipo === 'opiniao' && !(a.op || a.an)) return false;
    if (r.tipo === 'noticia' && (a.op || a.an)) return false;
    // "só o que consigo ler" vale para as listas; quem abre um veículo ou autor quer ver tudo dele
    if (state.readable && !(r.fonte || r.autor) && !canRead(s)) return false;
    if (terms.length && !terms.every((t) => hay(a).includes(t))) return false;
    return true;
  });
}

function chipLabel(id) {
  if (id === 'ultima-hora') return 'Última hora';
  if (id.startsWith('r:')) return state.data.regions.find((r) => r.id === id.slice(2))?.label || id;
  return state.data.topics.find((t) => t.id === id)?.short || id;
}
function temaLabel(id) {
  if (id === 'ultima-hora') return 'Última hora';
  if (id.startsWith('r:')) return state.data.regions.find((r) => r.id === id.slice(2))?.label || id;
  return state.data.topics.find((t) => t.id === id)?.label || id;
}

// ───────────────────────── Formatação ─────────────────────────

const fmtTime = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const fmtDay = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
const fmtWeekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });
const fmtFull = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeStyle: 'short' });
const fmtDayLong = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

function when(t) {
  const now = Date.now();
  const hm = fmtTime.format(t);
  const today = startOfDay(now);
  if (t >= today) return `Hoje, ${hm}`;
  if (t >= today - 86400e3) return `Ontem, ${hm}`;
  if (t >= today - 6 * 86400e3) return `${fmtWeekday.format(t).replace('.', '')}, ${fmtDay.format(t).replace('.', '')}, ${hm}`;
  return `${fmtDay.format(t).replace('.', '')}, ${hm}`;
}

function dayLabel(t) {
  const today = startOfDay(Date.now());
  if (t >= today) return 'Hoje';
  if (t >= today - 86400e3) return 'Ontem';
  return fmtDayLong.format(t);
}

function ago(t) {
  const mins = Math.round((Date.now() - t) / 60e3);
  if (mins < 2) return 'agora há pouco';
  if (mins < 60) return `há ${mins} min`;
  const h = Math.round(mins / 60);
  return h < 24 ? `há ${h} h` : `há ${Math.round(h / 24)} dia${h >= 48 ? 's' : ''}`;
}

const plural = (n, one, many) => `${n.toLocaleString('pt-BR')} ${n === 1 ? one : many}`;

// ───────────────────────── Peças ─────────────────────────

// Régua: medidor de pan esquerda ↔ direita. 9 marcas, a central mais alta; a agulha é o veículo.
function ruler(bias, { w = 52, h = 14, label = true } = {}) {
  const pad = 2, span = w - pad * 2, lane = laneOf(bias);
  let ticks = '';
  for (let i = 0; i <= 8; i++) {
    const x = pad + (span * i) / 8;
    const th = i === 4 ? h : i === 0 || i === 8 ? h * 0.6 : h * 0.38;
    ticks += `<line class="tick${i === 4 ? ' mid' : ''}" x1="${x}" x2="${x}" y1="${(h - th) / 2 + 0.5}" y2="${(h + th) / 2 - 0.5}"/>`;
  }
  const nx = pad + ((Math.max(-1, Math.min(1, bias)) + 1) / 2) * span;
  const cx = pad + span / 2;
  const nw = Math.max(3, h * 0.26);
  // barra do centro até a agulha: o comprimento mostra o quanto o veículo se afasta do centro
  const fh = Math.max(3, h * 0.34);
  const fill = Math.abs(nx - cx) > nw / 2 ? `<rect class="fill" x="${Math.min(nx, cx).toFixed(1)}" y="${((h - fh) / 2).toFixed(1)}" width="${Math.abs(nx - cx).toFixed(1)}" height="${fh.toFixed(1)}" rx="${(fh / 2).toFixed(1)}"/>` : '';
  const aria = label ? `role="img" aria-label="Linha editorial: ${bucketLabel(bias)}"` : 'aria-hidden="true"';
  return `<svg class="ruler lane-${lane}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" ${aria}>${ticks}${fill}<rect class="needle" x="${(nx - nw / 2).toFixed(1)}" y="0" width="${nw}" height="${h}" rx="${nw / 2}"/></svg>`;
}

function authorsHtml(a, s) {
  if (a.by?.length) {
    const shown = a.by.slice(0, 2).map((n) => (n === 'Redação' ? 'Redação' : `<button class="by-btn" data-autor="${esc(n)}">${esc(n)}</button>`));
    const extra = a.by.length > 2 ? ` <span title="${esc(a.by.slice(2).join(', '))}">+${a.by.length - 2}</span>` : '';
    return `<span>${shown.join(a.by.length === 2 ? ' e ' : ', ')}${extra}</span>`;
  }
  if (s.noBylines) return `<span class="by-none">Sem assinatura</span>`;
  return `<span class="by-none">Autor não informado</span>`;
}

// O separador fica no fim do item anterior: quando a linha quebra, a nova não começa com "·".
const metaLine = (parts) => parts.map((p, i) => `<span class="mg">${p}${i < parts.length - 1 ? '<span class="sep" aria-hidden="true">·</span>' : ''}</span>`).join(' ');

function card(a) {
  const s = state.src[a.s];
  const bias = biasOf(a);
  const flags = a.live ? [`<span class="now is-live">Ao vivo</span>`] : [];
  const tags = [];
  if (translated(a)) tags.push(`<span class="tag-soft" title="Original: ${esc(a.t)}">Traduzido</span>`);
  if (a.op) tags.push(`<span class="tag">Opinião</span>`);
  else if (a.an) tags.push(`<span class="tag">Análise</span>`);
  if (!canRead(s)) tags.push(`<span class="pay" title="Exige assinatura" aria-label="Exige assinatura">${icon('lock')}</span>`);
  const read = state.read.has(a.id) ? ' is-read' : '';
  return `<article class="card${read}" data-id="${a.id}">
    <div class="card-main">
      <h3 class="hl"${translated(a) ? ` lang="pt-BR" title="${esc(a.t)}"` : ''}><a href="${esc(linkOf(a))}" target="_blank" rel="noopener" data-read="${a.id}">${esc(titleOf(a))}</a></h3>
      ${excerptOf(a) ? `<p class="excerpt">${esc(excerptOf(a))}</p>` : ''}
    </div>
    <div class="lean">${ruler(bias)}<button class="src-btn" data-fonte="${s.id}">${esc(s.name)}</button><span class="lean-label lane-${laneOf(bias)}">${bucketLabel(bias)}${a.b != null ? ' (opinião)' : ''}</span></div>
    <div class="meta">${metaLine([...flags, authorsHtml(a, s), `<time datetime="${new Date(a.d).toISOString()}" title="${esc(fmtFull.format(a.d))}">${when(a.d)}</time>`, ...tags])}</div>
    ${a.img ? `<img class="thumb" src="${esc(a.img)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}
  </article>`;
}

function spread(lanes) {
  const total = lanes.e + lanes.c + lanes.d || 1;
  const seg = (k) => (lanes[k] ? `<i class="${k}" style="flex:${lanes[k] / total}"></i>` : '');
  return `<span class="spread" aria-hidden="true">${seg('e')}${seg('c')}${seg('d')}</span>`;
}
const spreadText = (l) => `E ${l.e} · C ${l.c} · D ${l.d}`;
const dot = (k) => `<i class="dot lane-${k}" aria-hidden="true"></i>`;
const spreadAria = (l) => `${l.e} à esquerda, ${l.c} de centro, ${l.d} à direita`;

function storyCard(st) {
  return `<button class="story" data-story="${st.id}">
    <span class="story-title">${esc(storyTitle(st))}</span>
    <span class="story-foot"><span>${plural(st.ids.length, 'veículo', 'veículos')}</span>
      <span class="spread-legend" aria-label="${spreadAria(st.lanes)}">${spread(st.lanes)}<span aria-hidden="true">${spreadText(st.lanes)}</span></span></span>
  </button>`;
}

function notice(html, dismissKey) {
  return `<div class="notice"${dismissKey ? ` data-notice="${dismissKey}"` : ''}><p>${html}</p>${dismissKey ? `<button class="icon-btn" data-action="dismiss" data-key="${dismissKey}" aria-label="Dispensar">${icon('close')}</button>` : ''}</div>`;
}

// ───────────────────────── Lista com rolagem infinita ─────────────────────────

let observer = null;

function mountFeed(el, list, { lanesTag = false } = {}) {
  let shown = 0, lastDay = null;
  const page = () => {
    const chunk = list.slice(shown, shown + state.limit);
    let html = '';
    for (const a of chunk) {
      if (!lanesTag) {
        const k = dayKey(a.d);
        if (k !== lastDay) { html += `<h2 class="day">${esc(dayLabel(a.d))}</h2>`; lastDay = k; }
      }
      html += card(a);
    }
    shown += chunk.length;
    el.querySelector('.sentinel')?.remove();
    el.querySelector('.end')?.remove();
    el.insertAdjacentHTML('beforeend', html);
    if (shown < list.length) {
      el.insertAdjacentHTML('beforeend', '<div class="sentinel"></div>');
      observer.observe(el.querySelector('.sentinel'));
    } else if (list.length) {
      el.insertAdjacentHTML('beforeend', `<p class="end">Você chegou ao fim: ${plural(list.length, 'matéria', 'matérias')}${state.route.q ? ' encontradas' : ' das últimas 72 horas'}.</p>`);
    }
  };
  el._more = page;
  page();
}

function resetObserver() {
  observer?.disconnect();
  observer = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      observer.unobserve(e.target);
      e.target.parentElement?._more?.();
    }
  }, { rootMargin: '900px 0px' });
}

// ───────────────────────── Telas ─────────────────────────

function renderChrome() {
  const r = state.route;
  const tabs = VIEWS.map((v) => `<a class="tab" href="#/${v.id === 'inicio' ? '' : v.id}" ${r.view === v.id && !r.fonte && !r.autor ? 'aria-current="page"' : ''}><span class="tab-ico">${icon(v.id)}</span><span>${v.label}</span></a>`).join('');
  $('.tabs-bottom').innerHTML = tabs;
  $('.tabs-top').innerHTML = tabs;

  const chips = VIEW_CHIPS[r.view];
  const row = $('.chips-row');
  if (!state.data || !chips || r.fonte || r.autor) row.innerHTML = '';
  else {
    const single = r.tema.length <= 1 ? r.tema[0] || '' : null;
    row.innerHTML = [`<button class="chip" data-chip="" aria-pressed="${single === ''}">Tudo</button>`]
      .concat(chips.map((c) => `<button class="chip" data-chip="${c}" aria-pressed="${single === c || (single === null && r.tema.includes(c))}">${esc(chipLabel(c))}</button>`))
      .join('');
    const on = row.querySelector('[aria-pressed="true"]');
    if (on && on.dataset.chip) on.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }
  const n = filterCount(r);
  const badge = $('[data-action="filters"] .badge');
  badge.hidden = !n;
  badge.textContent = n;
  const q = $('#q');
  if (document.activeElement !== q) q.value = r.q;
  if (r.q) $('.search-row').hidden = false;
  requestAnimationFrame(measureHead);
}

function activeFilterPills(r) {
  const pills = [];
  const pill = (label, patch) => pills.push(`<button class="pill" data-patch='${esc(JSON.stringify(patch))}'>${esc(label)} ${icon('close')}</button>`);
  for (const t of r.tema) pill(temaLabel(t), { tema: r.tema.filter((x) => x !== t) });
  for (const l of r.lado) pill(BUCKETS.find((b) => b.id === l)?.label || l, { lado: r.lado.filter((x) => x !== l) });
  for (const c of r.pais) pill(state.data.countries[c] || c, { pais: r.pais.filter((x) => x !== c) });
  if (r.idioma) pill(r.idioma === 'pt' ? 'Em português' : 'Em inglês', { idioma: '' });
  if (r.tipo) pill(r.tipo === 'opiniao' ? 'Só opinião e análise' : 'Só notícias', { tipo: '' });
  if (state.readable) pills.push(`<button class="pill" data-action="readable-off">Só o que consigo ler ${icon('close')}</button>`);
  if (r.q) pill(`“${r.q}”`, { q: '' });
  if (!pills.length) return '';
  if (pills.length > 1) pills.push(`<button class="pill pill-clear" data-action="clear-filters">Limpar tudo</button>`);
  return `<div class="active-filters" aria-label="Filtros ativos">${pills.join('')}</div>`;
}

function emptyState(r) {
  const any = filterCount(r) || r.q;
  return `<div class="empty"><h2>Nenhuma matéria aqui</h2>
    <p>${any ? 'Os filtros escolhidos não deixaram nenhuma matéria das últimas 72 horas.' : 'Ainda não há matérias nesta seção. A próxima coleta acontece em alguns minutos.'}</p>
    ${any ? `<button class="btn" data-action="clear-filters">Limpar filtros</button>` : ''}
    ${r.q && r.view !== 'inicio' ? ` <a class="btn btn-ghost" href="${buildHash({ ...r, view: 'inicio' })}">Buscar em todas as seções</a>` : ''}</div>`;
}

function headerNotices() {
  let html = '';
  const age = Date.now() - state.data.updatedAt;
  if (age > 3 * HOUR) html += notice(`<strong>Coleta atrasada.</strong> A última atualização foi ${ago(state.data.updatedAt)}. As matérias abaixo podem estar desatualizadas.`);
  if (!navigator.onLine) html += notice(`<strong>Sem conexão.</strong> Mostrando as notícias salvas da última atualização (${fmtTime.format(state.data.updatedAt)}).`);
  return html;
}

function renderInicio(main, r) {
  const list = select(r);
  const filtered = filterCount(r) || r.q;
  let html = headerNotices();
  if (!filtered && !store.get('tip-done', false)) {
    html += notice(`<strong>Dica:</strong> toque no nome do jornal ou do autor para ver só as matérias dele. A régua abaixo do título mostra a linha editorial do veículo. <button class="text-btn" data-action="help">Como funciona</button>`, 'tip-done');
  }
  if (!filtered) {
    const top = state.data.stories.filter((s) => Date.now() - s.d < 14 * HOUR).slice(0, 8);
    if (top.length) {
      html += `<section class="stories" aria-labelledby="h-stories"><div class="section-head intro" style="padding:16px var(--gutter) 8px"><p class="eyebrow" id="h-stories">Mais cobertas agora</p></div>
        <div class="stories-track">${top.map(storyCard).join('')}</div></section>`;
    }
  }
  html += activeFilterPills(r);
  html += list.length ? `<div class="feed" id="feed"></div>` : emptyState(r);
  main.innerHTML = html;
  if (list.length) mountFeed($('#feed'), list);
}

function renderSimpleSection(main, r, { title, sub }) {
  const list = select(r);
  let html = headerNotices();
  html += `<div class="section-head"><p class="eyebrow">${plural(list.length, 'matéria', 'matérias')} · últimas 72 h</p><h1 class="section-title">${title}</h1>${sub ? `<p class="section-sub">${sub}</p>` : ''}</div>`;
  html += activeFilterPills(r);
  html += list.length ? `<div class="feed" id="feed"></div>` : emptyState(r);
  main.innerHTML = html;
  if (list.length) mountFeed($('#feed'), list);
}

function compareCard(st) {
  const members = st.ids.map((id) => state.byId.get(id)).filter(Boolean);
  const byLane = { e: [], c: [], d: [] };
  for (const a of members) byLane[laneOf(biasOf(a))].push(a);
  const block = (k) => {
    const items = byLane[k].slice(0, 2);
    const body = items.length
      ? items.map((a) => `<a class="mini" href="${esc(linkOf(a))}" target="_blank" rel="noopener" data-read="${a.id}"><span class="mini-title">${esc(titleOf(a))}</span><span class="mini-src">${esc(state.src[a.s].name)} <span>· ${fmtTime.format(a.d)}</span></span></a>`).join('')
      : `<p class="lane-empty">Nenhum veículo ${k === 'e' ? 'à esquerda' : k === 'd' ? 'à direita' : 'de centro'} noticiou ainda.</p>`;
    return `<div class="lane-block"><p class="lane-name">${dot(k)}${LANES[k]}${byLane[k].length > 2 ? ` <span>+${byLane[k].length - 2}</span>` : ''}</p>${body}</div>`;
  };
  return `<article class="compare">
    <div class="compare-head"><h3>${esc(storyTitle(st))}</h3>
      <div class="story-foot"><span class="spread-legend" aria-label="${spreadAria(st.lanes)}">${spread(st.lanes)}</span><span>${plural(members.length, 'veículo', 'veículos')} · ${spreadText(st.lanes)}</span></div></div>
    <div class="compare-lanes">${block('e')}${block('c')}${block('d')}</div>
    <button class="compare-more" data-story="${st.id}">Ver as ${members.length} versões lado a lado</button>
  </article>`;
}

function renderBrasil(main, r) {
  const list = select(r);
  const lanes = { e: [], c: [], d: [] };
  for (const a of list) lanes[laneOf(biasOf(a))].push(a);
  const day = list.filter((a) => Date.now() - a.d < 24 * HOUR);
  const dayLanes = { e: 0, c: 0, d: 0 };
  for (const a of day) dayLanes[laneOf(biasOf(a))]++;

  const stories = state.data.stories
    .filter((s) => s.br)
    // prioriza pautas cobertas por mais campos, sem esconder as que muitos veículos deram
    .map((s) => ({ s, score: ['e', 'c', 'd'].filter((k) => s.lanes[k]).length + Math.min(s.ids.length, 10) / 4 }))
    .sort((x, y) => y.score - x.score || y.s.d - x.s.d)
    .slice(0, 4)
    .map((x) => x.s);

  const filtered = filterCount(r) || r.q;
  let html = headerNotices();
  html += `<div class="section-head intro"><p class="eyebrow">Política brasileira</p><h1 class="section-title">Os dois lados</h1>
    <p class="section-sub">As mesmas notícias por veículos de linhas editoriais diferentes. A régua mede o veículo, não cada texto: veículo de esquerda também faz reportagem factual, e vice-versa.</p></div>`;
  if (stories.length && !filtered) {
    html += `<p class="eyebrow" style="margin-top:18px">Mesma pauta, ângulos diferentes</p><div class="compare-grid">${stories.map(compareCard).join('')}</div>`;
  }
  html += `<div class="lanes intro" role="group" aria-label="Filtrar por campo">
    <div class="seg">${[['todos', 'Equilibrado'], ['e', 'Esquerda'], ['c', 'Centro'], ['d', 'Direita']].map(([k, l]) => `<button data-lane="${k}" aria-pressed="${r.lane === k}">${k === 'todos' ? '' : dot(k)}${l}</button>`).join('')}</div>
    <p class="balance">Últimas 24 h: <b>${dayLanes.e}</b> matérias de veículos à esquerda, <b>${dayLanes.c}</b> de centro e <b>${dayLanes.d}</b> à direita.</p></div>`;
  html += activeFilterPills(r);

  if (!list.length) { main.innerHTML = html + emptyState(r); return; }

  const wide = matchMedia('(min-width: 960px)').matches;
  if (wide) setWide(true);
  if (r.lane !== 'todos') {
    html += `<div class="feed" id="feed"></div>`;
    main.innerHTML = html;
    mountFeed($('#feed'), lanes[r.lane]);
  } else if (wide) {
    html += `<div class="cols">${['e', 'c', 'd'].map((k) => `<section class="col"><h2 class="col-head lane-${k}">${dot(k)}${LANES[k]} <span style="color:var(--ink-3)">${lanes[k].length}</span></h2><div class="feed" id="col-${k}"></div></section>`).join('')}</div>`;
    main.innerHTML = html;
    for (const k of ['e', 'c', 'd']) mountFeed($(`#col-${k}`), lanes[k], { lanesTag: true });
  } else {
    // Celular: intercala os três campos para que nenhum lado some do topo.
    const mixed = [];
    const idx = { e: 0, c: 0, d: 0 };
    while (mixed.length < list.length) {
      for (const k of ['e', 'c', 'd']) if (idx[k] < lanes[k].length) mixed.push(lanes[k][idx[k]++]);
    }
    html += `<div class="feed" id="feed"></div>`;
    main.innerHTML = html;
    mountFeed($('#feed'), mixed, { lanesTag: true });
  }
}

function contextFonte(r) {
  const s = state.src[r.fonte];
  if (!s) return '';
  const total = state.data.articles.filter((a) => a.s === s.id).length;
  const host = new URL(s.url).host.replace(/^www\./, '');
  const h = state.data.health?.[s.id];
  const down = h && h.ok === 0;
  return `<div class="context">
    <button class="back" data-action="back">${icon('back')} Voltar</button>
    <h1 class="context-title">${esc(s.name)}</h1>
    <p class="context-line">${esc(s.kind)} · ${esc(state.data.countries[s.country] || s.country)} · ${s.lang === 'pt' ? 'em português' : 'em inglês'}</p>
    <div class="profile">
      <div class="scale" role="img" aria-label="Linha editorial: ${bucketLabel(s.bias)}">
        <div class="scale-labels" aria-hidden="true"><span>Esquerda</span><span>Centro</span><span>Direita</span></div>
        ${ruler(s.bias, { w: 320, h: 22, label: false }).replace('width="320"', 'width="100%" preserveAspectRatio="none"')}
      </div>
      <dl class="facts">
        <dt>Linha editorial</dt><dd>${bucketLabel(s.bias)}</dd>
        <dt>Rigor de apuração</dt><dd>${esc(s.rigor[0].toUpperCase() + s.rigor.slice(1))}</dd>
        <dt>Dono</dt><dd>${esc(s.owner)}</dd>
        <dt>Acesso</dt><dd>${s.paywall ? `Exige assinatura <button class="chip chip-sm" data-sub="${s.id}" aria-pressed="${state.subs.has(s.id)}">${state.subs.has(s.id) ? 'Você assina' : 'Eu assino'}</button>` : 'Gratuito'}</dd>
        <dt>No Mirante</dt><dd>${plural(total, 'matéria', 'matérias')}${down ? ' · <span class="src-down">feed fora do ar na última coleta</span>' : ''}</dd>
      </dl>
      <p class="note">${esc(s.note)}</p>
      <a class="link-out" href="${esc(s.url)}" target="_blank" rel="noopener">Abrir ${esc(host)} ${icon('out', 'i')}</a>
    </div>
    ${activeFilterPills(r)}
  </div>`;
}

function contextAutor(r, list) {
  const srcs = [...new Set(state.data.articles.filter((a) => a.by?.includes(r.autor)).map((a) => a.s))].map((id) => state.src[id]);
  return `<div class="context">
    <button class="back" data-action="back">${icon('back')} Voltar</button>
    <p class="eyebrow">Jornalista</p>
    <h1 class="context-title">${esc(r.autor)}</h1>
    <p class="context-line">${plural(list.length, 'matéria', 'matérias')} nas últimas 72 h · ${srcs.map((s) => `<button class="src-btn" data-fonte="${s.id}" style="font-weight:600">${esc(s.name)}</button> <span class="lean-label">(${bucketLabel(s.bias).toLowerCase()})</span>`).join(', ')}</p>
    ${activeFilterPills(r)}
  </div>`;
}

function renderScoped(main, r) {
  const list = select(r);
  let html = r.fonte ? contextFonte(r) : contextAutor(r, list);
  html += list.length ? `<div class="feed" id="feed"></div>` : emptyState(r);
  main.innerHTML = html;
  if (list.length) mountFeed($('#feed'), list);
}

// Assinaturas: os veículos pagos que o leitor consegue abrir. Fica salvo neste aparelho.
function subscriptionsBox(where) {
  const paid = state.data.sources.filter((s) => s.paywall).sort((a, b) => a.short.localeCompare(b.short));
  const n = state.subs.size;
  return `<section class="subs${where === 'fontes' ? ' subs-card' : ''}" aria-labelledby="subs-${where}">
    <h3 id="subs-${where}" class="${where === 'fontes' ? 'group-title' : ''}">O que você consegue ler</h3>
    <label class="switch"><span>Só gratuitos e minhas assinaturas</span><input type="checkbox" data-action="toggle-readable" ${state.readable ? 'checked' : ''}></label>
    <p class="fhint">Toque nos jornais pagos que você assina${n ? ` (${n} marcado${n > 1 ? 's' : ''})` : ''}:</p>
    <div class="fchips">${paid.map((s) => `<button class="chip" data-sub="${s.id}" aria-pressed="${state.subs.has(s.id)}">${esc(s.short)}</button>`).join('')}</div>
  </section>`;
}

function renderFontes(main) {
  const all = state.data.sources;
  const counts = {};
  for (const a of state.data.articles) if (Date.now() - a.d < 24 * HOUR) counts[a.s] = (counts[a.s] || 0) + 1;
  const group = (title, list) => `
    <div class="src-scale"><h2 class="group-title">${title}</h2><span class="scale-labels" aria-hidden="true"><span>Esq.</span><span>Centro</span><span>Dir.</span></span></div>
    <ul class="src-list">${[...list].sort((a, b) => a.bias - b.bias || a.name.localeCompare(b.name)).map((s) => {
      const down = state.data.health?.[s.id]?.ok === 0;
      return `<li class="src-item"><button class="src-row" data-fonte="${s.id}">
        <span class="src-text"><span class="src-name">${esc(s.name)}</span>
        <span class="src-sub"><span class="lean-label lane-${laneOf(s.bias)}">${bucketLabel(s.bias)}</span> · rigor ${esc(s.rigor)}${s.paywall ? (state.subs.has(s.id) ? ' · <span class="subbed">assinante</span>' : ` · ${icon('lock', 'lock')}`) : ''} · ${down ? '<span class="src-down">fora do ar</span>' : `${counts[s.id] || 0} hoje`}</span></span>
        <span class="src-meter">${ruler(s.bias, { w: 120, h: 16 })}</span>
        ${icon('chevron', 'chev')}
      </button></li>`;
    }).join('')}</ul>`;
  main.innerHTML = `
    <div class="section-head"><p class="eyebrow">${all.length} veículos</p><h1 class="section-title">Fontes</h1>
    <p class="section-sub">Escolhidas por rigor de apuração, com linhas editoriais diferentes de propósito. Toque num veículo para ver o perfil e só as matérias dele.</p></div>
    ${subscriptionsBox('fontes')}
    ${group('Brasil', all.filter((s) => s.country === 'BR'))}
    ${group('Internacional', all.filter((s) => s.country !== 'BR'))}
    <h2 class="group-title" style="margin-top:32px">Como classificamos</h2>
    <div class="prose">
      <p><strong>A régua mede o veículo, não a matéria.</strong> Ela resume a linha editorial: escolha de pautas, enquadramento, editoriais e colunistas. Um jornal de centro publica colunas de esquerda e de direita; um veículo de esquerda também faz reportagem factual.</p>
      <p><strong>Internacionais:</strong> posição baseada nas avaliações públicas do AllSides e do Ad Fontes Media. <strong>Brasileiros:</strong> não existe auditoria independente equivalente; a posição é uma avaliação editorial do Mirante, explicada no perfil de cada veículo.</p>
      <p><strong>Rigor</strong> é outra coisa: mede checagem, correções públicas e histórico de acertos. Ficaram de fora veículos de alto alcance com histórico de sensacionalismo ou desinformação.</p>
      <p>O WSJ tem duas réguas: reportagem perto do centro, página de opinião à direita. As matérias de opinião dele aparecem marcadas como tal.</p>
    </div>`;
}

function setWide(on) {
  $('#main').classList.toggle('wide', on);
  document.body.classList.toggle('is-wide', on);
}

function render() {
  if (!state.data) return;
  const r = state.route;
  renderChrome();
  resetObserver();
  const main = $('#main');
  setWide(false);
  if (r.fonte || r.autor) renderScoped(main, r);
  else if (r.view === 'fontes') renderFontes(main);
  else if (r.view === 'brasil') renderBrasil(main, r);
  else if (r.view === 'mundo') renderSimpleSection(main, r, { title: 'Mundo', sub: 'Política internacional, guerras e conflitos. Matérias sobre o Brasil ficam na aba Brasil.' });
  else if (r.view === 'economia') renderSimpleSection(main, r, { title: 'Economia', sub: 'Mercado financeiro, petróleo e energia, economia brasileira e global.' });
  else renderInicio(main, r);
  document.title = r.fonte ? `${state.src[r.fonte]?.name} · Mirante` : r.autor ? `${r.autor} · Mirante` : r.view === 'inicio' ? 'Mirante' : `${VIEWS.find((v) => v.id === r.view).label} · Mirante`;
}

function onRoute({ replace = false } = {}) {
  const hash = location.hash || '#/';
  if (state.data && hash === state.renderedHash) return;
  state.renderedHash = hash;
  // pilha de navegação interna: decide se "Voltar" usa o histórico ou vai para o início
  const st = state.stack;
  if (replace && st.length) st[st.length - 1] = hash;
  else if (st.length > 1 && st[st.length - 2] === hash) st.pop();
  else if (st[st.length - 1] !== hash) st.push(hash);
  const prev = state.route;
  state.route = parseRoute();
  state.limit = 30;
  render();
  const r = state.route;
  const moved = !prev || prev.view !== r.view || prev.fonte !== r.fonte || prev.autor !== r.autor;
  if (moved) window.scrollTo(0, 0);
  else if (window.scrollY > 0) {
    const head = $('#main .feed, #main .cols');
    if (head && head.getBoundingClientRect().top < 0) window.scrollTo(0, 0);
  }
}

// ───────────────────────── Folhas (filtros, pauta, ajuda) ─────────────────────────

function openSheet(title, body, foot = '') {
  const sheet = $('#sheet');
  state.lastFocus = document.activeElement;
  $('#sheet-title').textContent = title;
  $('.sheet-body', sheet).innerHTML = body;
  $('.sheet-foot', sheet).innerHTML = foot;
  $('.sheet-foot', sheet).hidden = !foot;
  sheet.hidden = false;
  document.body.style.overflow = 'hidden';
  $('.sheet-body', sheet).scrollTop = 0;
  $('.sheet-head .icon-btn', sheet).focus();
}
function closeSheet() {
  const sheet = $('#sheet');
  if (sheet.hidden) return;
  sheet.hidden = true;
  sheet.dataset.kind = '';
  document.body.style.overflow = '';
  state.lastFocus?.focus?.();
}

function filtersBody() {
  const r = state.route;
  const fchip = (group, id, label, on) => `<button class="chip" data-fgroup="${group}" data-fval="${esc(id)}" aria-pressed="${on}">${esc(label)}</button>`;
  const temas = ['ultima-hora', ...state.data.topics.map((t) => t.id)];
  const countries = [...new Set(state.data.sources.map((s) => s.country))];
  return `
    <div class="fgroup">${subscriptionsBox('filtros')}</div>
    <div class="fgroup"><h3>Linha editorial do veículo</h3><div class="fchips">${BUCKETS.map((b) => fchip('lado', b.id, b.label, r.lado.includes(b.id))).join('')}</div></div>
    <div class="fgroup"><h3>Temas</h3><div class="fchips">${temas.map((t) => fchip('tema', t, temaLabel(t), r.tema.includes(t))).join('')}</div></div>
    <div class="fgroup"><h3>Região da notícia</h3><div class="fchips">${state.data.regions.map((g) => fchip('tema', 'r:' + g.id, g.label, r.tema.includes('r:' + g.id))).join('')}</div></div>
    <div class="fgroup"><h3>País do veículo</h3><div class="fchips">${countries.map((c) => fchip('pais', c, state.data.countries[c] || c, r.pais.includes(c))).join('')}</div></div>
    <div class="fgroup"><h3>Idioma</h3><div class="fchips">${fchip('idioma', 'pt', 'Português', r.idioma === 'pt')}${fchip('idioma', 'en', 'Inglês', r.idioma === 'en')}</div></div>
    <div class="fgroup"><h3>Tipo de texto</h3><div class="fchips">${fchip('tipo', 'noticia', 'Só notícias', r.tipo === 'noticia')}${fchip('tipo', 'opiniao', 'Só opinião e análise', r.tipo === 'opiniao')}</div></div>
`;
}
function filtersFoot() {
  const n = state.route.view === 'fontes' ? select({ ...state.route, view: 'inicio' }).length : select(state.route).length;
  return `<button class="btn btn-ghost" data-action="clear-filters">Limpar</button><button class="btn" data-action="close-sheet">Ver ${plural(n, 'matéria', 'matérias')}</button>`;
}
function openFilters() {
  openSheet('Filtros', filtersBody(), filtersFoot());
  $('#sheet').dataset.kind = 'filters';
}
function refreshFilters() {
  if ($('#sheet').dataset.kind !== 'filters') return;
  const body = $('#sheet .sheet-body');
  const top = body.scrollTop;
  body.innerHTML = filtersBody();
  body.scrollTop = top;
  $('#sheet .sheet-foot').innerHTML = filtersFoot();
}

function openStory(id) {
  const st = state.data.stories.find((s) => s.id === id);
  if (!st) return;
  const members = st.ids.map((x) => state.byId.get(x)).filter(Boolean);
  const byLane = { e: [], c: [], d: [] };
  for (const a of members) byLane[laneOf(biasOf(a))].push(a);
  const body = `<p class="section-sub" style="margin:0 0 6px">${plural(members.length, 'veículo noticiou', 'veículos noticiaram')} este assunto. Compare os títulos: o enquadramento costuma dizer mais que o fato.</p>
    <p class="balance" style="margin:0 0 4px">${spread(st.lanes)} ${spreadText(st.lanes)}</p>
    ${['e', 'c', 'd'].map((k) => `<h3 class="lane-tag" style="margin:18px 0 0">${dot(k)}${LANES[k]} · ${byLane[k].length}</h3>
      ${byLane[k].length ? `<div class="story-list">${byLane[k].map(card).join('')}</div>` : `<p class="lane-empty" style="margin:8px 0 0">Nenhum veículo deste campo noticiou até agora. Ausência também é escolha editorial.</p>`}`).join('')}`;
  const title = storyTitle(st);
  openSheet(title.length > 60 ? 'Mesma pauta' : title, body);
  $('#sheet').dataset.kind = 'story';
}

function openHelp() {
  const updated = state.data ? `${fmtFull.format(state.data.updatedAt)} (${ago(state.data.updatedAt)})` : '—';
  const body = `<div class="prose">
    <h3 class="lane-tag" style="margin:4px 0 8px">A régua</h3>
    <div class="help-ruler">${ruler(-0.45)}<span>piauí · Centro-esquerda</span></div>
    <p>Fica logo abaixo do título e mostra a <strong>linha editorial do veículo</strong>, da esquerda para a direita. A marca central é o centro. Ela não julga cada matéria: veículo de esquerda também faz reportagem factual, e o contrário vale para a direita.</p>
    <p>As cores seguem o campo: <span class="lean-label lane-e">roxo à esquerda</span>, <span class="lean-label lane-c">cinza no centro</span> e <span class="lean-label lane-d">laranja à direita</span>. A barra cresce do centro até a agulha: quanto mais longa, mais distante do centro. Não usamos vermelho e azul porque significam coisas opostas no Brasil e nos EUA.</p>
    <h3 class="lane-tag" style="margin:20px 0 8px">Navegar</h3>
    <p><strong>Toque no título</strong> para abrir a matéria no site do veículo. <strong>Toque no nome do jornal</strong> para ver o perfil (dono, linha editorial, rigor) e só as matérias dele. <strong>Toque no autor</strong> para ver tudo o que ele publicou.</p>
    <p>Os <strong>temas</strong> logo abaixo do topo filtram a seção com um toque. O botão de <strong>filtros</strong> combina linha editorial, tema, região, país, idioma e tipo de texto.</p>
    <h3 class="lane-tag" style="margin:20px 0 8px">Brasil: os dois lados</h3>
    <p>A aba Brasil mostra a política nacional separada por campo. <strong>Mesma pauta</strong> junta o mesmo fato contado por veículos diferentes; quando um lado não noticia, isso aparece.</p>
    <h3 class="lane-tag" style="margin:20px 0 8px">Sinais nos cartões</h3>
    <p><span class="now">Ao vivo</span> cobertura em tempo real (o tema <strong>Última hora</strong> mostra só as últimas 3 horas). <span class="tag">Opinião</span> coluna, editorial ou análise. <span class="pay">${icon('lock')}</span> o veículo cobra assinatura.</p>
    <p>Reuters e AP não têm feed público: os títulos chegam pelo Google Notícias, sem autor. The Economist não assina textos por política própria.</p>
    <h3 class="lane-tag" style="margin:20px 0 8px">Atualização</h3>
    <p>As fontes são lidas a cada 15 minutos. Última coleta: ${esc(updated)}. Quando chegam matérias novas, um aviso aparece no topo.</p>
    <h3 class="lane-tag" style="margin:20px 0 8px">Minhas assinaturas</h3>
    <p>Em <strong>Filtros</strong> (ou na aba Fontes), toque nos jornais pagos que você assina e ligue <strong>Só gratuitos e minhas assinaturas</strong>: o app passa a mostrar só o que você consegue abrir, e o cadeado some dos jornais que você assina. A escolha fica salva neste aparelho; no computador e no celular ela é feita separadamente.</p>
    <h3 class="lane-tag" style="margin:20px 0 8px">Tradução</h3>
    <p>O botão <strong>文A</strong> no topo mostra as matérias em inglês em português: título e resumo traduzidos automaticamente (marcados com "Traduzido") e a matéria abre pelo Google Tradutor. Toque de novo para voltar ao original. Sites com paywall podem não abrir traduzidos; no iPhone, o Safari também traduz pelo botão <strong>aA</strong> da barra de endereço.</p>
    <h3 class="lane-tag" style="margin:20px 0 8px">Colocar na tela do celular</h3>
    <p><strong>iPhone (Safari):</strong> botão Compartilhar → Adicionar à Tela de Início.<br><strong>Android (Chrome):</strong> menu ⋮ → Instalar app ou Adicionar à tela inicial.</p>
  </div>`;
  openSheet('Como funciona', body);
  $('#sheet').dataset.kind = 'help';
}

// ───────────────────────── Eventos ─────────────────────────

function toggleIn(list, v) { return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]; }

document.addEventListener('click', (ev) => {
  const t = ev.target.closest('button, a');
  if (!t) return;

  if (t.dataset.read) {
    state.read.add(t.dataset.read);
    store.set('read', [...state.read].slice(-3000));
    t.closest('.card')?.classList.add('is-read');
    return;
  }
  if (t.dataset.fonte) { closeSheet(); return go({ ...EMPTY, view: 'inicio', fonte: t.dataset.fonte }); }
  if (t.dataset.autor) { closeSheet(); return go({ ...EMPTY, view: 'inicio', autor: t.dataset.autor }); }
  if (t.dataset.story) return openStory(t.dataset.story);
  if (t.dataset.sub) {
    const id = t.dataset.sub, name = state.src[id].short;
    if (state.subs.has(id)) state.subs.delete(id); else state.subs.add(id);
    store.set('subs', [...state.subs]);
    toast(state.subs.has(id) ? `${name} marcado como assinatura` : `${name} removido das assinaturas`);
    render();
    return refreshFilters();
  }
  if (t.dataset.chip != null) {
    const c = t.dataset.chip;
    return go({ tema: c ? (state.route.tema.length === 1 && state.route.tema[0] === c ? [] : [c]) : [] }, { replace: true });
  }
  if (t.dataset.lane) return go({ lane: t.dataset.lane }, { replace: true });
  if (t.dataset.patch) return go(JSON.parse(t.dataset.patch), { replace: true });
  if (t.dataset.fgroup) {
    const g = t.dataset.fgroup, v = t.dataset.fval;
    const patch = ['lado', 'tema', 'pais'].includes(g) ? { [g]: toggleIn(state.route[g], v) } : { [g]: state.route[g] === v ? '' : v };
    go(patch, { replace: true });
    return refreshFilters();
  }

  switch (t.dataset.action) {
    case 'filters': return openFilters();
    case 'help': return openHelp();
    case 'translate':
      state.translate = !state.translate;
      store.set('translate', state.translate);
      syncTranslateButton();
      toast(state.translate ? 'Matérias em inglês agora aparecem em português' : 'Mostrando os textos no idioma original');
      return render();
    case 'close-sheet': return closeSheet();
    case 'readable-off':
      setReadable(false);
      return;
    case 'clear-filters':
      if (state.readable) setReadable(false, { quiet: true });
      go({ tema: [], lado: [], pais: [], idioma: '', tipo: '', q: '' }, { replace: true });
      $('#q').value = '';
      return refreshFilters();
    case 'dismiss':
      store.set(t.dataset.key, true);
      t.closest('.notice')?.remove();
      return;
    case 'back':
      if (state.stack.length > 1) return history.back();
      return go({ ...EMPTY, view: 'inicio' }, { replace: true });
    case 'search': {
      const row = $('.search-row');
      row.hidden = !row.hidden;
      t.setAttribute('aria-expanded', String(!row.hidden));
      if (!row.hidden) $('#q').focus();
      requestAnimationFrame(measureHead);
      return;
    }
    case 'search-close':
      $('.search-row').hidden = true;
      $('[data-action="search"]').setAttribute('aria-expanded', 'false');
      if (state.route.q) go({ q: '' }, { replace: true });
      requestAnimationFrame(measureHead);
      return;
    case 'apply-fresh': return applyPending();
  }
});

document.addEventListener('change', (ev) => {
  if (ev.target.dataset.action === 'toggle-readable') setReadable(ev.target.checked);
});

let searchTimer;
$('#q').addEventListener('input', (ev) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => go({ q: ev.target.value.trim() }, { replace: true }), 180);
});
$('#q').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') ev.target.blur(); });

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') closeSheet();
  if (ev.key === '/' && document.activeElement?.tagName !== 'INPUT') {
    ev.preventDefault();
    $('.search-row').hidden = false;
    $('#q').focus();
    measureHead();
  }
});

window.addEventListener('popstate', () => { closeSheet(); onRoute(); });
window.addEventListener('hashchange', () => onRoute());
window.addEventListener('online', render);
window.addEventListener('offline', render);
let lastWide = matchMedia('(min-width: 960px)').matches;
matchMedia('(min-width: 960px)').addEventListener('change', (e) => { if (e.matches !== lastWide) { lastWide = e.matches; render(); } });

function setReadable(on, { quiet = false } = {}) {
  state.readable = on;
  store.set('readable', on);
  if (!quiet) {
    toast(on
      ? (state.subs.size ? 'Mostrando só gratuitos e suas assinaturas' : 'Mostrando só veículos gratuitos. Marque suas assinaturas para incluí-las')
      : 'Mostrando todos os veículos');
  }
  render();
  refreshFilters();
}

function syncTranslateButton() {
  const b = $('[data-action="translate"]');
  b.setAttribute('aria-pressed', String(state.translate));
  b.setAttribute('aria-label', state.translate ? 'Tradução ligada: mostrar textos originais' : 'Traduzir matérias em inglês para o português');
  b.title = state.translate ? 'Tradução ligada' : 'Traduzir para o português';
}

let toastTimer;
function toast(msg) {
  const el = $('.toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

function measureHead() {
  const h = $('.top').getBoundingClientRect().height;
  document.documentElement.style.setProperty('--head-h', `${Math.round(h)}px`);
}
new ResizeObserver(measureHead).observe($('.top'));

// ───────────────────────── Carga e atualização ─────────────────────────

function ingest(data) {
  state.data = data;
  state.src = Object.fromEntries(data.sources.map((s) => [s.id, s]));
  state.byId = new Map(data.articles.map((a) => [a.id, a]));
  data.articles = data.articles.filter((a) => state.src[a.s]);
}

async function load() {
  try {
    const res = await fetch('data/feed.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    ingest(await res.json());
    state.lastCheck = Date.now();
    state.renderedHash = null;
    onRoute();
  } catch (e) {
    $('#main').innerHTML = `<div class="empty"><h2>Não foi possível carregar as notícias</h2>
      <p>${navigator.onLine ? 'O arquivo de notícias não respondeu. Se você acabou de instalar, a primeira coleta pode levar alguns minutos.' : 'Você está sem conexão e ainda não há notícias salvas neste aparelho.'}</p>
      <button class="btn" onclick="location.reload()">Tentar de novo</button></div>`;
  }
}

async function checkFresh() {
  if (!state.data || document.hidden) return;
  state.lastCheck = Date.now();
  try {
    const meta = await (await fetch('data/meta.json', { cache: 'no-cache' })).json();
    if (meta.updatedAt <= (state.pending?.updatedAt || state.data.updatedAt)) return;
    const data = await (await fetch('data/feed.json', { cache: 'no-cache' })).json();
    const known = new Set(state.data.articles.map((a) => a.id));
    const fresh = data.articles.filter((a) => !known.has(a.id) && inView(a, state.route.view)).length;
    const sheetOpen = !$('#sheet').hidden;
    if (!fresh || (window.scrollY < 120 && !sheetOpen)) {
      ingest(data);
      render();
      return;
    }
    state.pending = data;
    const pill = $('.fresh');
    pill.textContent = `${plural(fresh, 'matéria nova', 'matérias novas')}`;
    pill.hidden = false;
  } catch {}
}

function applyPending() {
  if (!state.pending) return;
  ingest(state.pending);
  state.pending = null;
  $('.fresh').hidden = true;
  state.limit = 30;
  render();
  window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

setInterval(checkFresh, 4 * 60e3);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && Date.now() - state.lastCheck > 60e3) checkFresh();
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

state.route = parseRoute();
syncTranslateButton();
renderChrome();
load();
