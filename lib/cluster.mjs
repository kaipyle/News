// Agrupa matérias de veículos diferentes sobre o mesmo fato ("mesma pauta").
// TF-IDF sobre título (peso 2) e resumo (peso 1), agrupamento guloso por centróide
// para não encadear assuntos vizinhos.
import { fold } from './text.mjs';

const STOP = new Set(`
a o as os um uma uns umas de da do das dos em na no nas nos por pela pelo pelas pelos para pra com sem sob sobre
entre ate apos ante contra desde e ou mas que se ser sao foi era eram sera seria tem ter teve ha havia como mais
menos muito muita muitos muitas ja nao sim seu sua seus suas ele ela eles elas isso isto esse essa este esta
quem qual quais quando onde porque diz dizem afirma afirmam disse diz-se segundo apos novo nova novos novas hoje
ontem amanha ano anos dia dias vez vezes veja entenda saiba confira leia ao vivo aovivo acompanhe siga fala falam
pode podem deve devem vai vao faz fazer feito sobre durante ainda tambem so apenas agora depois antes
the of and to in on for at by with from as is are was were be been has have had will would could should it its
this that these those after over into about than amid says said say new more most not no yes but or an a
how why what who when where which while up out off live updates update report reports latest
`.split(/\s+/).filter(Boolean));

function stem(t) {
  if (t.length > 4 && t.endsWith('oes')) return t.slice(0, -3) + 'ao';
  if (t.length > 4 && t.endsWith('aes')) return t.slice(0, -3) + 'ao';
  if (t.length > 4 && t.endsWith('s')) return t.slice(0, -1);
  return t;
}

function tokens(s) {
  return fold(s).split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !STOP.has(t)).map(stem);
}

function vectorize(a) {
  const v = new Map();
  for (const t of tokens(a.t)) v.set(t, (v.get(t) || 0) + 2);
  for (const t of tokens(a.x || '').slice(0, 30)) v.set(t, (v.get(t) || 0) + 1);
  return v;
}

function normalize(v) {
  let n = 0;
  for (const x of v.values()) n += x * x;
  n = Math.sqrt(n) || 1;
  for (const [k, x] of v) v.set(k, x / n);
  return v;
}

const dot = (a, b) => {
  if (a.size > b.size) [a, b] = [b, a];
  let s = 0;
  for (const [k, x] of a) { const y = b.get(k); if (y) s += x * y; }
  return s;
};

/**
 * @param articles matérias já filtradas (mesmo idioma, janela de tempo)
 * @param laneOf função matéria → 'e' | 'c' | 'd'
 */
export function clusterStories(articles, laneOf, { threshold = 0.42, minSources = 3 } = {}) {
  if (articles.length < minSources) return [];
  const raw = articles.map((a) => ({ a, v: vectorize(a) }));
  const df = new Map();
  for (const { v } of raw) for (const k of v.keys()) df.set(k, (df.get(k) || 0) + 1);
  const N = raw.length;
  for (const r of raw) {
    for (const [k, x] of r.v) {
      const d = df.get(k);
      // termos de uma matéria só não ajudam a agrupar; termos onipresentes também não
      r.v.set(k, d < 2 ? 0 : x * Math.log(N / d));
    }
    for (const [k, x] of r.v) if (!x) r.v.delete(k);
    normalize(r.v);
  }

  const clusters = [];
  for (const r of raw.sort((x, y) => (y.a.d || 0) - (x.a.d || 0))) {
    if (r.v.size < 2) continue;
    let best = null, bestSim = threshold;
    for (const c of clusters) {
      const sim = dot(r.v, c.centroid);
      if (sim >= bestSim) { best = c; bestSim = sim; }
    }
    if (best) {
      best.members.push(r);
      for (const [k, x] of r.v) best.sum.set(k, (best.sum.get(k) || 0) + x);
      best.centroid = normalize(new Map(best.sum));
    } else {
      clusters.push({ members: [r], sum: new Map(r.v), centroid: new Map(r.v) });
    }
  }

  const stories = [];
  for (const c of clusters) {
    const bySource = new Map();
    for (const m of c.members) if (!bySource.has(m.a.s)) bySource.set(m.a.s, m); // mais recente por veículo
    if (bySource.size < minSources) continue;
    const members = [...bySource.values()];
    const lanes = { e: 0, c: 0, d: 0 };
    for (const m of members) lanes[laneOf(m.a)]++;
    // título de referência: o mais próximo do centro do grupo, preferindo veículos de centro
    const ref = members
      .map((m) => ({ m, score: dot(m.v, c.centroid) + (laneOf(m.a) === 'c' ? 0.15 : 0) }))
      .sort((x, y) => y.score - x.score)[0].m.a;
    stories.push({
      id: ref.id,
      title: ref.t,
      ids: members.sort((x, y) => (y.a.d || 0) - (x.a.d || 0)).map((m) => m.a.id),
      lanes,
      d: Math.max(...members.map((m) => m.a.d || 0)),
    });
  }
  return stories.sort((x, y) => y.ids.length - x.ids.length || y.d - x.d);
}
