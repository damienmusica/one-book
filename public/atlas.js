// 하나의 책 — 도감 엔진. 결정 (137).
//
// 세 가지를 한다. 전부 독자의 브라우저 안에서, 전송 없이.
//
//  1) **준비도(readiness)**: 당신이 읽은 것이 그래프에 불을 켠다. 그 불이 닿은 작가는
//     "지금 읽을 준비가 된" 사람이다. 스포티파이의 축(당신 같은 사람들이 이것도 들었다)이
//     아니라 문학에만 있는 축 — **선행 조건**이다. 카프카를 읽고 읽는 『심판』과 읽지 않고
//     읽는 『심판』은 다른 책이다. 우리 263개 엣지가 정확히 그 구조를, 출처를 달고 담고 있다.
//     사용자 0명이어도 첫날부터 돈다.
//
//  2) **조우(encounter)**: 책이 어느 쪽에서 열린다. 묻지 않는다. 오늘 열리는 쪽은 당신의
//     불빛에서 한 걸음 너머이고, 소개하는 사람은 당신이 아는 사람이다.
//
//  3) **도감 계수**: 만난 작가 N / 전체. 페이지 카운터가 아니라 세계를 얼마나 봤는가다.
//
// 데이터는 /graph.json (산문 0자). 독자의 표시는 lp.reader.v3. 둘이 만나는 자리가 여기다.

const READER_KEY = "lp.reader.v3";
const SEEN_KEY = "lp.seen.v1";

let G = null;

export async function graph() {
  if (G) return G;
  const r = await fetch("/graph.json");
  const raw = await r.json();
  const byId = new Map(raw.authors.map((a) => [a.i, a]));
  const out = new Map();   // a → [{to, type, ev, why}]  (a 가 영향을 준 쪽)
  const inn = new Map();   // a → [{to, type, ev, why}]  (a 에게 영향을 준 쪽)
  const side = new Map();  // 방향 없는 관계
  const push = (m, k, v) => m.set(k, (m.get(k) || []).concat([v]));
  for (const e of raw.edges) {
    const rec = (to) => ({ to, type: e.y, ev: e.v, why: e.m });
    if (e.d) {
      push(out, e.s, rec(e.t));
      push(inn, e.t, rec(e.s));
    } else {
      push(side, e.s, rec(e.t));
      push(side, e.t, rec(e.s));
    }
  }
  G = { raw, byId, out, inn, side };
  return G;
}

const read = (k) => {
  try {
    return JSON.parse(localStorage.getItem(k) || "null");
  } catch {
    return null;
  }
};
const write = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* 저장 실패는 조용히 */
  }
};

/** 작품 id → 작가 id (우리 작품 id 는 `<author>--<work>` 다) */
export const authorOf = (workId) => String(workId).split("--")[0];

/** 독자의 표시에서 "불이 켜진 작가" — 칸이 높을수록 밝다. */
export function litAuthors(readerState) {
  const w = { want: 1, opened: 2, have: 2, read: 3 };
  const lit = new Map();
  for (const [workId, m] of Object.entries(readerState?.state || {})) {
    const a = authorOf(workId);
    lit.set(a, Math.max(lit.get(a) || 0, w[m.s] || 0));
  }
  return lit;
}

// ── 1. 준비도 ────────────────────────────────────────────────────────────────
// 읽은 작가에서 **나가는** 영향 엣지의 끝이 열린다("이 책은 당신이 읽은 것에 대한 답이다").
// 읽은 작가로 **들어오는** 엣지의 시작은 뿌리다("이 사람이 그 책을 가능하게 했다").
// 방향 없는 관계는 곁이다. 셋은 다른 문장이므로 섞지 않는다.
export function readiness(g, lit) {
  const rows = new Map();
  const add = (id, kind, from, ev, why, base) => {
    if (lit.has(id)) return;                       // 이미 만난 사람은 열 것이 없다
    const a = g.byId.get(id);
    if (!a) return;
    const score = base * (0.6 + 0.2 * ev);         // 근거가 강할수록 밝다
    const cur = rows.get(id);
    if (!cur || score > cur.score) rows.set(id, { id, kind, from, ev, why, score });
    else if (cur) cur.score += score * 0.25;       // 여러 선행자가 가리키면 더 밝다
  };
  for (const [src, level] of lit) {
    const base = level;                            // 담기 1 · 펼침/소장 2 · 읽음 3
    for (const e of g.out.get(src) || []) add(e.to, "opens", src, e.ev, e.why, base);
    for (const e of g.inn.get(src) || []) add(e.to, "root", src, e.ev, e.why, base * 0.8);
    for (const e of g.side.get(src) || []) add(e.to, "beside", src, e.ev, e.why, base * 0.6);
  }
  return [...rows.values()].sort((x, y) => y.score - x.score);
}

export const KIND_KO = {
  opens: (from) => `${from}를 읽었으니 이제 열린다`,
  root: (from) => `${from}의 뿌리다`,
  beside: (from) => `${from}의 곁이다`
};

// ── 2. 조우 ──────────────────────────────────────────────────────────────────
// 노출 원장: 같은 사람을 연달아 들이밀지 않는다. 강요는 감쇠항 없이 반복할 때 생긴다.
function seen() {
  return read(SEEN_KEY) || {};
}
export function markSeen(id) {
  const s = seen();
  s[id] = { n: (s[id]?.n || 0) + 1, last: Date.now() };
  write(SEEN_KEY, s);
}
const decay = (s, id) => {
  const r = s[id];
  if (!r) return 1;
  const days = (Date.now() - r.last) / 86400000;
  return (1 / (1 + r.n)) * (1 - Math.exp(-days / 14));
};

/** ISO 주차 — 매주 다른 쪽이 열린다는 것이 "일주일 뒤 돌아온다"의 기제다. */
export function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
}
const hash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
};

/**
 * 책이 오늘 열리는 쪽. 표시가 있으면 준비도 상위에서, 없으면 도판(깊이가 있는 작가)에서.
 * 같은 독자·같은 주는 같은 쪽 — 다시 찾을 수 있어야 오솔길이 된다(『모래의 책』의 교훈).
 */
export function openAt(g, lit) {
  const wk = isoWeek();
  const s = seen();
  const ready = readiness(g, lit);
  if (ready.length) {
    const top = ready.slice(0, 12).map((r) => ({ ...r, w: r.score * decay(s, r.id) * (0.75 + 0.5 * hash(r.id + wk)) }));
    top.sort((a, b) => b.w - a.w);
    return { ...top[0], first: false };
  }
  // 아직 아무 표시도 없다 — 도판 중에서 결정론적으로 한 사람.
  const plates = g.raw.authors.filter((a) => a.d === "plate" && a.w > 0);
  const pick = plates.sort((a, b) => hash(a.i + wk) - hash(b.i + wk))[0];
  return pick ? { id: pick.i, kind: "first", from: null, why: "", score: 0, first: true } : null;
}

// ── 3. 도감 계수 ─────────────────────────────────────────────────────────────
// Etkin(JCR 2016)이 잰 것은 한 권을 읽는 동안의 **페이지 카운터**다. 이것은 다른 수다 —
// 세계가 얼마나 열렸는가. 목표도, 퍼센트도, 남은 개수도, 연속일도 없다.
export function census(g, lit) {
  const total = g.raw.authors.length;
  const met = lit.size;
  const openNow = readiness(g, lit).length;
  const byRegion = new Map();
  for (const a of g.raw.authors) {
    const r = byRegion.get(a.r) || { total: 0, met: 0 };
    r.total++;
    if (lit.has(a.i)) r.met++;
    byRegion.set(a.r, r);
  }
  return { total, met, openNow, byRegion };
}

export const readerState = () => read(READER_KEY) || { v: 3, state: {} };

// ── 문해의 지도 ──────────────────────────────────────────────────────────────
// 배지가 아니다. **당신이 어느 영역을 지도 없이 읽을 수 있는가**를 권역과 시대로
// 말한다. 도감의 "박사"는 모은 개수가 아니라 열린 영역이다.
export const REGION_KO = {
  "western-europe": "서유럽", "central-europe": "중부유럽", "eastern-europe": "동유럽",
  russia: "러시아", "britain-ireland": "영국·아일랜드", nordic: "북유럽", iberia: "이베리아",
  italy: "이탈리아", "north-america": "북미", "latin-america": "라틴아메리카",
  caribbean: "카리브", "east-asia": "동아시아", "south-asia": "남아시아",
  "middle-east-north-africa": "중동·북아프리카", "sub-saharan-africa": "사하라 이남",
  oceania: "오세아니아", "central-asia": "중앙아시아", "southeast-asia": "동남아시아",
  anatolia: "아나톨리아", mesoamerica: "메소아메리카", andes: "안데스",
  "east-africa": "동아프리카", "horn-of-africa": "아프리카의 뿔"
};
export const PERIOD_KO = {
  "antiquity-medieval": "고대·중세", "renaissance-baroque": "르네상스·바로크",
  "enlightenment-romantic": "계몽·낭만", roots: "뿌리층", "early-modernism": "초기 모더니즘",
  "mid-century": "중기 현대", "late-postmodern": "후기·포스트모던", contemporary: "동시대"
};

/** 권역·시대별로 만난 수와 전체. 순위를 매기지 않는다 — 지도이지 점수판이 아니다. */
export function literacy(g, lit) {
  const bucket = () => ({ total: 0, met: 0 });
  const regions = new Map();
  const periods = new Map();
  for (const a of g.raw.authors) {
    const met = lit.has(a.i);
    const r = regions.get(a.r) || bucket();
    r.total++; if (met) r.met++;
    regions.set(a.r, r);
    for (const pid of a.p || []) {
      const q = periods.get(pid) || bucket();
      q.total++; if (met) q.met++;
      periods.set(pid, q);
    }
  }
  const rows = (m, ko) =>
    [...m].map(([k, v]) => ({ id: k, ko: ko[k] || k, ...v })).sort((x, y) => y.met - x.met || y.total - x.total);
  return { regions: rows(regions, REGION_KO), periods: rows(periods, PERIOD_KO) };
}
