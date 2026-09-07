// Find Korean editions of works — maintainer-local key, never committed. Aladin's OpenAPI closed to new keys on
// 2026-09-04 and shuts down 2026-10-30, so the providers are Kakao book search and the National Library's ISBN
// registry (서지정보유통지원시스템). Both give ISBN-13, publisher, date and — Kakao explicitly, NLK in the author
// string — the translator.
//
//   npx tsx scripts/resolve-editions.ts [--provider kakao|nlk] [--authors a,b | --works w1,w2 | --plates] [--limit N] --out <candidates.json>
//   npx tsx scripts/resolve-editions.ts --provider kakao --fixture <response.json> --work <workId>   (matching only, no network)
//
// Keys come from the environment or ~/.config/one-book/keys.env: KAKAO_REST_KEY (developers.kakao.com → 내 애플리케이션 →
// REST API 키) and/or NLK_SEOJI_KEY (seoji.nl.go.kr → Open API 인증키). Without a key for the chosen provider the
// script stops and says so. Output is a CANDIDATES ledger, not data/editions.json: no API can say whether a
// translation is from the original, a relay or an adaptation, and the editions ledger requires that judgment.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { isbn13Valid } from "../src/schema.js";

type Raw = Record<string, any>;
interface Item { title: string; author: string; translators: string[]; publisher: string; year: number; isbn13: string; category?: string; ebook?: boolean }
const args = process.argv.slice(2);
const flag = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const KEYS_FILE = join(homedir(), ".config", "one-book", "keys.env");
function keyFor(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  if (existsSync(KEYS_FILE)) { const m = new RegExp(`^${name}=(.+)$`, "m").exec(readFileSync(KEYS_FILE, "utf8")); if (m?.[1]) return m[1].trim(); }
  return undefined;
}

const norm = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
const stripVolume = (t: string) => t.replace(/\s*[\(\[][^)\]]*[\)\]]\s*/g, " ").replace(/\s*(세트|전집|합본|상|중|하|\d+권?|[상중하]권)\s*$/u, "").trim();
const isbn13Of = (s: string) => (String(s).match(/\d{13}/) ?? [""])[0];

// ── providers ──────────────────────────────────────────────────────────────────────────────────────────────
const PROVIDERS: Record<string, { key: string; issue: string; search: (key: string, q: string) => Promise<Raw>; normalize: (raw: Raw) => Item[] }> = {
  kakao: {
    key: "KAKAO_REST_KEY",
    issue: "https://developers.kakao.com/console/app → 애플리케이션 추가 → 앱 키 → REST API 키",
    async search(key, q) {
      const u = new URL("https://dapi.kakao.com/v3/search/book");
      u.searchParams.set("target", "title"); u.searchParams.set("query", q); u.searchParams.set("size", "50");
      const r = await fetch(u, { headers: { Authorization: `KakaoAK ${key}` } });
      if (!r.ok) throw new Error(`kakao ${r.status} ${(await r.text()).slice(0, 120)}`);
      return r.json();
    },
    normalize(raw) {
      return (raw.documents ?? []).map((d: Raw): Item => ({
        title: String(d.title ?? ""), author: (d.authors ?? []).join(", "), translators: (d.translators ?? []).map(String),
        publisher: String(d.publisher ?? ""), year: Number(String(d.datetime ?? "").slice(0, 4)), isbn13: isbn13Of(d.isbn ?? ""),
        ebook: /e-?book|전자책/i.test(String(d.title ?? "")),
      }));
    },
  },
  nlk: {
    key: "NLK_SEOJI_KEY",
    issue: "https://www.nl.go.kr/seoji/ → 회원가입 → Open API → 인증키 신청",
    async search(key, q) {
      const u = new URL("https://www.nl.go.kr/seoji/SearchApi.do");
      for (const [k, v] of Object.entries({ cert_key: key, result_style: "json", page_no: "1", page_size: "50", title: q })) u.searchParams.set(k, v);
      const r = await fetch(u);
      if (!r.ok) throw new Error(`nlk ${r.status}`);
      return r.json();
    },
    normalize(raw) {
      return (raw.docs ?? []).map((d: Raw): Item => {
        const author = String(d.AUTHOR ?? "");
        const translators = [...author.matchAll(/([^;,:]+?)\s*(?:옮김|역)(?=\s*[;,]|\s*$)/g)].map((m) => (m[1] ?? "").replace(/^(옮긴이|역자)\s*[:：]?\s*/, "").trim()).filter(Boolean);
        return { title: String(d.TITLE ?? ""), author, translators, publisher: String(d.PUBLISHER ?? ""),
          year: Number(String(d.PUBLISH_PREDATE ?? "").slice(0, 4)), isbn13: isbn13Of(d.EA_ISBN ?? ""), category: d.SUBJECT ? `KDC ${d.SUBJECT}` : undefined,
          ebook: /^\d[5]/.test(String(d.EA_ADD_CODE ?? "")) || /e-?book|전자책/i.test(String(d.TITLE ?? "")) };
      });
    },
  },
};

// ── matching — same rule for every provider ─────────────────────────────────────────────────────────────────
export function matchItems(work: Raw, author: Raw, items: Item[]) {
  const wantTitle = norm(work.titleKo ?? "");
  const koTokens = String(author.names?.ko ?? "").split(/\s+/).filter((t) => t.length >= 2);
  const surname = String(author.names?.original ?? "").split(/\s+/).pop() ?? "";
  const out: Raw[] = [];
  for (const it of items) {
    if (it.ebook) continue;
    if (/세트|전집|합본/.test(it.title)) continue;
    const t = norm(stripVolume(it.title));
    if (!wantTitle || !(t.startsWith(wantTitle) || t.includes(wantTitle))) continue;
    const authorOk = koTokens.some((k) => it.author.includes(k)) || (surname.length >= 3 && it.author.toLowerCase().includes(surname.toLowerCase()));
    if (!authorOk) continue;
    if (!isbn13Valid(it.isbn13)) continue;
    if (!(it.year >= 1900)) continue;
    out.push({
      workId: work.id, isbn13: it.isbn13, title: it.title.trim(), publisher: it.publisher.trim(), year: it.year,
      ...(it.translators.length ? { translator: it.translators.join(", ") } : {}), language: "ko",
      ...(it.category ? { category: it.category } : {}), exact: t === wantTitle,
      ...(/어린이|청소년|만화|축약|다이제스트/.test((it.category ?? "") + it.title) ? { note: "어린이·청소년·축약 표시 — 번안일 수 있다" } : {}),
    });
  }
  out.sort((a, b) => Number(b.exact) - Number(a.exact) || b.year - a.year);
  return out;
}

function loadAll() {
  const read = (d: string) => readdirSync(join("data", d)).filter((f) => f.endsWith(".json")).flatMap((f) => JSON.parse(readFileSync(join("data", d, f), "utf8")) as Raw[]);
  const authors = read("authors"); const works = read("works");
  return { authors: new Map(authors.map((a) => [a.id, a])), works };
}

async function main() {
  const { authors, works } = loadAll();
  const pname = flag("--provider") ?? (Object.keys(PROVIDERS).find((p) => keyFor(PROVIDERS[p]!.key)) ?? "kakao");
  const P = PROVIDERS[pname]; if (!P) throw new Error(`provider ${pname}? (${Object.keys(PROVIDERS).join("|")})`);
  if (flag("--fixture")) {
    const w = works.find((x) => x.id === flag("--work")); if (!w) throw new Error(`작품 ${flag("--work")} 없음`);
    console.log(JSON.stringify(matchItems(w, authors.get(w.authorId)!, P.normalize(JSON.parse(readFileSync(flag("--fixture")!, "utf8")))), null, 1)); return;
  }
  const out = flag("--out"); if (!out) throw new Error("--out <candidates.json> 이 필요하다");
  const key = keyFor(P.key);
  if (!key) { console.error(`${pname} 키(${P.key})가 없다. 발급: ${P.issue}\n그 키를 ${KEYS_FILE} 에 ${P.key}=... 한 줄로 두거나 환경변수로 준다. 레포에는 절대 넣지 않는다.`); process.exit(2); }
  let todo = works;
  if (flag("--works")) { const s = new Set(flag("--works")!.split(",")); todo = works.filter((w) => s.has(w.id)); }
  else if (flag("--authors")) { const s = new Set(flag("--authors")!.split(",")); todo = works.filter((w) => s.has(w.authorId)); }
  else if (args.includes("--plates")) todo = works.filter((w) => { const a = authors.get(w.authorId); return a && (a.depth ?? "plate") === "plate"; });
  if (flag("--limit")) todo = todo.slice(0, Number(flag("--limit")));
  console.log(`${pname}: 작품 ${todo.length}편 조회`);
  const found: Record<string, Raw[]> = {}; const none: string[] = []; let calls = 0;
  for (const w of todo) {
    const a = authors.get(w.authorId); if (!a || !w.titleKo) { none.push(`${w.id}: 작가 또는 한국어 제목 없음`); continue; }
    try {
      const raw = await P.search(key, w.titleKo); calls++;
      if (calls === 1) console.log(`  첫 응답 표본: ${JSON.stringify(raw).slice(0, 400)}`);
      const m = matchItems(w, a, P.normalize(raw));
      if (m.length) found[w.id] = m; else none.push(`${w.id}: 검색 ${P.normalize(raw).length}건 중 일치 0`);
    } catch (e) { none.push(`${w.id}: ${(e as Error).message}`); if (/429|quota|한도/i.test(String(e))) break; }
    await sleep(350);
  }
  const ledger = { generatedAt: new Date().toISOString().slice(0, 10), source: `${pname} book search (title query)`, calls, found, none };
  writeFileSync(out, JSON.stringify(ledger, null, 2) + "\n");
  console.log(`후보 있음 ${Object.keys(found).length} · 없음 ${none.length} · 호출 ${calls} → ${out}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
