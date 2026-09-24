// 하나의 책 — 도감 동기화 클라이언트. 결정 (136), docs/backend-design.md.
//
// 의존성 0. Supabase 의 두 REST(GoTrue 인증 · PostgREST 데이터)를 fetch 로 직접 부른다.
// anon 키는 공개 설계다 — 지키는 것은 키가 아니라 서버의 RLS(user_id = auth.uid()).
//
// 원칙: **로컬이 먼저다.** 이 파일이 없어도, 서버가 죽어도, 로그인 전이어도 도감은
// localStorage(lp.reader.v3) 에서 그대로 동작한다. 여기서 하는 일은 셋뿐이다 —
// 로그인(이메일 매직링크), 로그인 순간 로컬과 서버를 합치기, 이후 변경을 서버에도 쓰기.

export const SUPABASE_URL = "https://ianojiicjdskogzjeuqw.supabase.co";
export const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlhbm9qaWljamRza29nempldXF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxOTA4MzEsImV4cCI6MjA5ODc2NjgzMX0.h81XtHiLSl7hdiiSFuAD5alC5doUHHDdxwklN4WOrHM";
const SESSION_KEY = "lp.session.v1";
const READER_KEY = "lp.reader.v3";
const SCHEMA = "book";

// ── 합침 규칙 (순수 함수 — 유닛 계약이 이걸 잰다) ─────────────────────────────
// 작품마다 `at` 이 늦은 쪽이 이긴다. 삭제(모르는 책으로 되돌림)도 `at` 을 가진 사실이라
// 같은 규칙으로 판정된다 — 그래서 로컬은 삭제도 tombstone 으로 기억한다.
//   local : { state: { [workId]: {s, at} }, gone?: { [workId]: at } }
//   server: [ { work_id, state, at(ISO) } ]
// 반환: { state, gone, toServer: [{work_id, state|null, at(ms)}] } — toServer 는 서버에
// 없거나 서버보다 늦은 로컬 사실만.
export function mergeMarks(local, server) {
  const state = {};
  const gone = {};
  const toServer = [];
  const srv = new Map();
  for (const row of server || []) srv.set(row.work_id, { s: row.state, at: Date.parse(row.at) });
  const ids = new Set([
    ...Object.keys(local?.state || {}),
    ...Object.keys(local?.gone || {}),
    ...srv.keys()
  ]);
  for (const id of ids) {
    const l = local?.state?.[id];
    const g = local?.gone?.[id];
    const lAt = Math.max(l?.at ?? -Infinity, g ?? -Infinity);
    const lS = l && (g == null || l.at >= g) ? l.s : null; // 로컬의 최신 사실
    const sv = srv.get(id);
    if (sv && sv.at >= lAt) {
      if (sv.s) state[id] = { s: sv.s, at: sv.at }; // 서버가 늦다 → 서버가 이긴다
      else gone[id] = sv.at;
    } else if (lAt > -Infinity) {
      if (lS) state[id] = { s: lS, at: lAt };
      else gone[id] = lAt;
      if (!sv || sv.at < lAt) toServer.push({ work_id: id, state: lS, at: lAt });
    }
  }
  return { state, gone, toServer };
}

// ── 저장소 ──────────────────────────────────────────────────────────────────
const load = (k) => {
  try {
    return JSON.parse(localStorage.getItem(k) || "null");
  } catch {
    return null;
  }
};
const save = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* 저장 실패는 조용히 — 로컬은 편의지 진실이 아니다 */
  }
};

// ── 인증 (GoTrue REST) ──────────────────────────────────────────────────────
const authHeaders = () => ({ apikey: SUPABASE_ANON, "Content-Type": "application/json" });
const PENDING_KEY = "lp.auth.pending.v1";

export async function requestMagicLink(email, redirectTo) {
  // GoTrue 는 돌아올 주소를 본문이 아니라 쿼리(redirect_to)에서 읽는다. 본문에만 두면 Referer 의 도메인 루트로,
  // Referer 가 없으면 이 Supabase 프로젝트의 Site URL(다른 앱)로 토큰이 간다.
  const r = await fetch(`${SUPABASE_URL}/auth/v1/otp?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, create_user: true, options: { email_redirect_to: redirectTo } })
  });
  if (!r.ok) throw new Error(`otp ${r.status}: ${await r.text()}`);
  // 이 브라우저가 링크를 청했다는 표 — 청하지 않은 브라우저는 주소에 실려 온 토큰을 받지 않는다(아래).
  save(PENDING_KEY, { at: Date.now() });
}

/**
 * 매직링크로 돌아온 URL 의 #access_token… 을 세션으로 굽고 해시를 지운다.
 * **링크를 청한 브라우저에서만** 받는다. 아무 링크에나 실린 토큰을 받으면, 남이 만든 링크 하나로 독자가 모르는
 * 계정에 로그인되고 이 브라우저의 표시가 그 계정으로 올라간다(2026-09-24 감사). 다른 브라우저에서 열린 링크는
 * 여기의 표시를 올리지도 못한다 — 그래서 받지 않고, 왜 받지 않았는지 말한다.
 * 반환: 세션 | { refused: "…" } | null
 */
export function absorbCallback() {
  const h = location.hash;
  const clear = () => history.replaceState(null, "", location.pathname + location.search);
  if (h.includes("error=")) {
    const p = new URLSearchParams(h.slice(1));
    clear();
    return { refused: /expired|invalid/i.test(`${p.get("error_code")} ${p.get("error_description")}`) ? "로그인 링크가 만료됐거나 이미 쓰였다. 다시 받아 달라." : "로그인하지 못했다. 다시 받아 달라." };
  }
  if (!h.includes("access_token=")) return null;
  const p = new URLSearchParams(h.slice(1));
  clear();
  const pending = load(PENDING_KEY);
  if (!pending || Date.now() - pending.at > 2 * 3600_000) {
    return { refused: "이 브라우저에서 청한 로그인이 아니라서 받지 않았다. 표시가 있는 브라우저에서 링크를 받아, 그 브라우저에서 열어 달라." };
  }
  const s = {
    access_token: p.get("access_token"),
    refresh_token: p.get("refresh_token"),
    expires_at: Date.now() + Number(p.get("expires_in") || 3600) * 1000
  };
  if (!s.access_token) return null;
  save(SESSION_KEY, s);
  try { localStorage.removeItem(PENDING_KEY); } catch { /* 없다 */ }
  return load(SESSION_KEY) ? s : { refused: "이 브라우저는 저장을 막고 있어 로그인을 기억하지 못한다(사이트 데이터 차단)." };
}

async function refresh(s) {
  let r;
  try {
    r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ refresh_token: s.refresh_token })
    });
  } catch {
    return null; // 오프라인 — 세션은 그대로 둔다. 다음 방문에 다시 새로 고친다.
  }
  if (!r.ok) {
    // 토큰이 죽었을 때만 로그아웃이다. 서버가 잠시 아프거나(5xx) 한도에 걸렸다고(429) 독자를 내보내지 않는다.
    if (r.status === 400 || r.status === 401) localStorage.removeItem(SESSION_KEY);
    return null;
  }
  const j = await r.json();
  const n = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + j.expires_in * 1000 };
  save(SESSION_KEY, n);
  return n;
}

export async function session() {
  const s = load(SESSION_KEY);
  if (!s) return null;
  return s.expires_at - Date.now() < 60_000 ? refresh(s) : s;
}

/** 로그인한 주소 — 토큰의 본문에서. 누구로 로그인했는지 보이지 않으면 남의 계정에 들어가 있어도 모른다. */
export function sessionEmail(s) {
  try {
    const b = s.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(escape(atob(b)))).email || "";
  } catch {
    return "";
  }
}

export async function signOut() {
  const s = load(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
  // 서버의 세션도 끊는다 — 브라우저에서 토큰만 지우면 새로 고침 토큰은 서버에서 계속 산다.
  if (s?.access_token) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout?scope=local`, { method: "POST", headers: { ...authHeaders(), Authorization: `Bearer ${s.access_token}` } }).catch(() => {});
  }
}

// ── 데이터 (PostgREST, 스키마 book) ────────────────────────────────────────
async function rest(path, s, init = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${s.access_token}`,
      "Content-Type": "application/json",
      "Accept-Profile": SCHEMA,
      "Content-Profile": SCHEMA,
      ...(init.headers || {})
    }
  });
  if (!r.ok) throw new Error(`${path} ${r.status}: ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

export const serverMarks = (s) => rest("marks?select=work_id,state,at", s);
export const serverSet = (s, workId, state, atMs) =>
  rest("rpc/mark_set", s, {
    method: "POST",
    body: JSON.stringify({ p_work_id: workId, p_state: state, p_at: new Date(atMs).toISOString() })
  });
export const serverMerge = (s, toServer) =>
  rest("rpc/marks_merge", s, { method: "POST", body: JSON.stringify({ p_local: toServer }) });
export const serverErase = (s) => rest("rpc/account_erase", s, { method: "POST", body: "{}" });

// ── 페이지 결합 ─────────────────────────────────────────────────────────────
// 페이지의 lpSet/lpPaint(생성기 인라인) 는 그대로 두고, 여기서 두 가지만 얹는다:
//  1) 로그인 상태면 lpSet 뒤에 서버에도 쓴다(실패해도 로컬은 이미 썼다).
//  2) 로드 시 로그인 상태면 서버와 합쳐 로컬을 갱신하고 다시 그린다.
async function syncOnLoad(note) {
  let s = null;
  try {
    s = await session();
  } catch {
    s = null;
  }
  paintAuth(s, s ? "pending" : note ? "refused" : "", note);
  if (!s) return;
  try {
    const server = await serverMarks(s);
    // 서버를 기다리는 동안 독자가 한 표시를 덮지 않는다 — 합치기 직전의 로컬을 다시 읽는다.
    const m = mergeMarks(load(READER_KEY) || { v: 3, state: {} }, server);
    if (m.toServer.length) await serverMerge(s, m.toServer);
    const latest = mergeMarks(load(READER_KEY) || { v: 3, state: {} }, server);
    save(READER_KEY, { v: 3, state: latest.state, gone: latest.gone });
    window.lpPaint?.();
    paintAuth(s, "ok");
  } catch (e) {
    console.warn("sync", e);
    paintAuth(s, "failed");
  }
}

// 「서버에도 있다」는 서버가 대답한 뒤에만 말한다 — 토큰이 있다는 것은 도감이 거기 있다는 뜻이 아니다.
const SYNC_KO = { pending: "서버와 맞추는 중…", ok: "표시가 서버에도 있다.", failed: "서버에 닿지 못했다 — 표시는 이 브라우저에 있다." };
function paintAuth(s, sync = "", note = "") {
  const box = document.getElementById("lp-auth");
  if (!box) return;
  box.hidden = false;
  if (s) {
    const who = sessionEmail(s);
    box.innerHTML =
      `<span class="sig">${who ? `${esc(who)}로 로그인했다. ` : ""}${SYNC_KO[sync] || ""}</span> ` +
      '<button class="want" id="lp-signout">나가기</button>';
    box.querySelector("#lp-signout").onclick = async () => {
      await signOut();
      box.innerHTML =
        '<p class="sig">나갔다. 이 브라우저의 표시는 남아 있다. 함께 쓰는 기기라면 — <button class="want" id="lp-wipe">이 브라우저의 표시도 지우기</button></p>';
      box.querySelector("#lp-wipe").onclick = () => {
        try { localStorage.removeItem(READER_KEY); localStorage.removeItem("lp.shelf.v1"); } catch { /* 없다 */ }
        window.lpPaint?.();
        box.innerHTML = '<p class="sig">이 브라우저의 표시를 지웠다. 서버의 기록은 <a href="/privacy/">처리방침</a>에서 지운다.</p>';
      };
    };
    return;
  }
  // 로그인은 관문이 아니다 — 무엇을 위한 것인지, 누가 쓸 수 있는지, 무엇이 저장되는지를 같은 자리에서 말한다.
  // 접어 둔다 — 모든 쪽의 바닥에 펼쳐 두면 그 쪽의 그려진 글자 예산을 로그인이 먹는다.
  box.innerHTML =
    (note ? `<p class="sig">${esc(note)}</p>` : "") +
    '<details class="auth-d"' + (note ? " open" : "") + '><summary>다른 기기에서 이어 보기</summary>' +
    '<p class="sig">이메일로 로그인 링크를 보낸다. 시험 중이라 지금은 운영자 주소로만 메일이 간다. ' +
    '다른 브라우저로 옮기기만 하려면 <a href="/shelf/#move">서재의 옮기기 주소</a>를 쓴다.</p>' +
    '<form id="lp-login"><input type="email" required placeholder="이메일" autocomplete="email" aria-label="이메일">' +
    ' <button class="want" type="submit">링크 받기</button>' +
    '<p class="sig">서버에 남는 것: 이메일 주소, 어떤 책을 어느 칸에 언제 두었는지. <a href="/privacy/">처리방침</a></p></form></details>';
  box.querySelector("#lp-login").onsubmit = async (e) => {
    e.preventDefault();
    const email = e.target.querySelector("input").value.trim();
    try {
      await requestMagicLink(email, location.origin + location.pathname);
      box.innerHTML = '<p class="sig">메일을 보냈다. <b>이 브라우저에서</b> 링크를 열어야 여기의 표시가 서버에 올라간다.</p>';
    } catch (err) {
      box.innerHTML = `<p class="sig">보내지 못했다 — ${sendErrorKo(String(err.message))}</p>`;
    }
  };
}
const esc = (x) => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// 서버의 원문(JSON)을 독자에게 보이지 않는다. 기본 메일러는 프로젝트 팀 주소에만 보낸다 — 그 거절은 사실대로 말한다.
function sendErrorKo(msg) {
  if (/not authori[sz]ed|not allowed/i.test(msg)) return "이 주소로는 아직 메일을 보낼 수 없다(시험 중). 표시는 이 브라우저에 그대로 있다.";
  if (/429|rate limit|too many/i.test(msg)) return "지금은 메일을 보낼 수 없다 — 이 사이트 전체의 시간당 발송 한도에 걸렸다. 한 시간 뒤에 다시.";
  if (/invalid|email/i.test(msg)) return "이메일 주소를 다시 확인해 달라.";
  return "잠시 뒤에 다시 시도해 달라. 표시는 이 브라우저에 그대로 있다.";
}

// ── 준비도 배지 (결정 (137)) ────────────────────────────────────────────────
// 작가 페이지 상단에 한 줄. "지금 이 사람이 열려 있는가"는 도감의 핵심 감각이고,
// 그 답은 독자가 읽은 것에서만 나온다 — 서버도 모델도 필요 없다.
async function paintReadiness() {
  const el = document.getElementById("lp-ready");
  if (!el) return;
  const id = el.getAttribute("data-author");
  // 표시가 하나도 없으면 이 사람에게 닿은 불도 없다 — 그래프(수백 KB)를 받을 까닭이 없다.
  if (!Object.keys(load(READER_KEY)?.state || {}).length) return;
  try {
    // 지정자를 계산해 둔다 — vite 의 정적 스캔이 public/ 절대경로 import 를 거부하고,
  // 그 거부가 이 파일을 Node 에서 아예 못 읽게 만든다(합침 규칙 계약이 여기 있다).
  const ATLAS = "/atlas" + ".js";
  const A = await import(/* @vite-ignore */ ATLAS);
    const g = await A.graph();
    const lit = A.litAuthors(A.readerState());
    if (lit.has(id)) {
      el.textContent = "이미 만난 사람이다.";
      el.hidden = false;
      return;
    }
    const row = A.readiness(g, lit).find((r) => r.id === id);
    if (!row) return;                       // 아직 아무 불도 이 사람에게 닿지 않았다
    const from = g.byId.get(row.from);
    const name = from ? from.k : row.from;
    el.textContent = A.KIND_KO[row.kind] ? A.KIND_KO[row.kind](name, lit.get(row.from)) + "." : "";
    if (row.why) el.textContent += " " + row.why;
    el.hidden = false;
  } catch {
    /* 엔진이 없으면 배지도 없다 — 페이지는 그대로다 */
  }
}

// ── 앱 안의 브라우저 ────────────────────────────────────────────────────────
// 카카오톡·네이버·인스타그램 안의 브라우저는 사파리·크롬과 저장소가 다르다. 여기서 한 표시는 그 앱 안에만 남고,
// 일주일 뒤 사파리로 돌아온 독자에게는 없다(2026-09-24 감사). 모르게 두지 않는다.
function inAppNotice() {
  const ua = navigator.userAgent || "";
  const app = /KAKAOTALK/i.test(ua) ? "카카오톡" : /NAVER\(inapp/i.test(ua) ? "네이버 앱" : /DaumApps/i.test(ua) ? "다음 앱"
    : /Instagram/i.test(ua) ? "인스타그램" : /FBAN|FBAV/i.test(ua) ? "페이스북" : /\bLine\//i.test(ua) ? "라인" : "";
  if (!app) return;
  const url = location.href;
  const open = app === "카카오톡" ? `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`
    : app === "라인" ? `${url}${url.includes("?") ? "&" : "?"}openExternalBrowser=1` : "";
  const bar = document.createElement("p");
  bar.className = "inapp sig";
  bar.innerHTML = `지금은 ${app} 안의 브라우저다. 여기서 한 표시는 이 앱 안에만 남는다 — ` +
    (open ? `<a href="${esc(open)}">브라우저에서 열기</a>` : "오른쪽 위 메뉴의 「다른 브라우저로 열기」로 옮겨 달라.");
  document.querySelector(".wrap")?.prepend(bar);
}

// ── 처리방침 쪽의 내려받기·지우기 ────────────────────────────────────────────
async function paintErase() {
  const box = document.getElementById("lp-erase");
  if (!box) return;
  let s = null;
  try { s = await session(); } catch { s = null; }
  if (!s) return;
  box.innerHTML = `<p class="sig">${esc(sessionEmail(s) || "이 계정")}의 서버 기록.</p>` +
    '<div class="doors"><button type="button" class="want" id="lp-export">내려받기</button><button type="button" class="want" id="lp-erase-go">서버의 표시와 이력 지우기</button></div><p class="sig" id="lp-erase-msg" role="status"></p>';
  const msg = box.querySelector("#lp-erase-msg");
  box.querySelector("#lp-export").onclick = async () => {
    try {
      const j = await rest("rpc/account_export", s, { method: "POST", body: "{}" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(j, null, 2)], { type: "application/json" }));
      a.download = "one-book-export.json";
      a.click();
      msg.textContent = "내려받았다.";
    } catch { msg.textContent = "서버에 닿지 못했다. 잠시 뒤에 다시."; }
  };
  box.querySelector("#lp-erase-go").onclick = async () => {
    if (!confirm("서버의 표시와 이력을 모두 지운다. 이 브라우저의 표시는 남는다.")) return;
    try { await serverErase(s); msg.textContent = "지웠다. 서버에 남은 것은 로그인 주소뿐이다 — 그것도 지우려면 아래 주소로 요청한다."; }
    catch { msg.textContent = "지우지 못했다 — 서버에 닿지 못했다. 잠시 뒤에 다시."; }
  };
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  const note = absorbCallback();
  // lpSet 을 감싼다 — 로컬 쓰기는 원래 함수가, 서버 쓰기는 여기가.
  const orig = window.lpSet;
  if (typeof orig === "function") {
    window.lpSet = function (id, st, el) {
      orig(id, st, el);
      const at = Date.now();
      // tombstone: 되돌림도 시각을 가진 사실이다
      const p = load(READER_KEY) || { v: 3, state: {} };
      if (!st) {
        p.gone = p.gone || {};
        p.gone[id] = at;
        save(READER_KEY, p);
      }
      session().then((s) => s && serverSet(s, id, st || null, at)).catch((e) => console.warn("set", e));
    };
  }
  const go = () => {
    syncOnLoad(note && note.refused ? note.refused : "");
    paintReadiness();
    inAppNotice();
    paintErase();
  };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", go) : go();
}
