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
      state[id] = { s: sv.s, at: sv.at }; // 서버가 늦다 → 서버가 이긴다
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

export async function requestMagicLink(email, redirectTo) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, create_user: true, options: { email_redirect_to: redirectTo } })
  });
  if (!r.ok) throw new Error(`otp ${r.status}: ${await r.text()}`);
}

/** 매직링크로 돌아온 URL 의 #access_token… 을 세션으로 굽고 해시를 지운다. */
export function absorbCallback() {
  const h = location.hash;
  if (!h.includes("access_token=")) return null;
  const p = new URLSearchParams(h.slice(1));
  const s = {
    access_token: p.get("access_token"),
    refresh_token: p.get("refresh_token"),
    expires_at: Date.now() + Number(p.get("expires_in") || 3600) * 1000
  };
  if (!s.access_token) return null;
  save(SESSION_KEY, s);
  history.replaceState(null, "", location.pathname + location.search);
  return s;
}

async function refresh(s) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ refresh_token: s.refresh_token })
  });
  if (!r.ok) {
    localStorage.removeItem(SESSION_KEY);
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

export function signOut() {
  localStorage.removeItem(SESSION_KEY);
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

// ── 페이지 결합 ─────────────────────────────────────────────────────────────
// 페이지의 lpSet/lpPaint(생성기 인라인) 는 그대로 두고, 여기서 두 가지만 얹는다:
//  1) 로그인 상태면 lpSet 뒤에 서버에도 쓴다(실패해도 로컬은 이미 썼다).
//  2) 로드 시 로그인 상태면 서버와 합쳐 로컬을 갱신하고 다시 그린다.
async function syncOnLoad() {
  const s = await session();
  paintAuth(s);
  if (!s) return;
  try {
    const local = load(READER_KEY) || { v: 3, state: {} };
    const server = await serverMarks(s);
    const m = mergeMarks(local, server);
    if (m.toServer.length) await serverMerge(s, m.toServer);
    save(READER_KEY, { v: 3, state: m.state, gone: m.gone });
    window.lpPaint?.();
  } catch (e) {
    console.warn("sync", e);
  }
}

function paintAuth(s) {
  const box = document.getElementById("lp-auth");
  if (!box) return;
  box.hidden = false;
  if (s) {
    box.innerHTML =
      '<span class="sig">도감이 서버에도 있다.</span> ' +
      '<button class="want" id="lp-signout">나가기</button>';
    box.querySelector("#lp-signout").onclick = () => {
      signOut();
      paintAuth(null);
    };
  } else {
    box.innerHTML =
      '<form id="lp-login"><input type="email" required placeholder="이메일" autocomplete="email">' +
      ' <button class="want" type="submit">도감 지키기</button>' +
      '<p class="sig">저장은 어떤 책을 어느 칸에, 언제 — 그것뿐.</p></form>';
    box.querySelector("#lp-login").onsubmit = async (e) => {
      e.preventDefault();
      const email = e.target.querySelector("input").value.trim();
      try {
        await requestMagicLink(email, location.origin + location.pathname);
        box.innerHTML = '<p class="sig">메일을 보냈다. 링크를 열면 이 도감이 서버에 남는다.</p>';
      } catch (err) {
        box.innerHTML = `<p class="sig">보내지 못했다 — ${String(err.message).slice(0, 80)}</p>`;
      }
    };
  }
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  absorbCallback();
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
  const go = () => syncOnLoad();
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", go) : go();
}
