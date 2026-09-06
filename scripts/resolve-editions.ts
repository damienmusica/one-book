// Find Korean editions of works through the Aladin TTB API — maintainer-local key, never committed.
//
//   npx tsx scripts/resolve-editions.ts [--authors a,b | --works w1,w2 | --plates] [--limit N] --out <candidates.json>
//   npx tsx scripts/resolve-editions.ts --fixture <ttb-response.json> --work <workId>   (matching logic only, no network)
//
// The key comes from $ALADIN_TTB_KEY or ~/.config/one-book/keys.env (ALADIN_TTB_KEY=...). Without it the
// script stops and says where to get one. Output is a CANDIDATES ledger, not data/editions.json: the API
// tells us an ISBN, a publisher, a year and a translator, but not whether the translation is from the
// original, a relay, or an adaptation — that field is a judgment, and the editions ledger requires it.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { isbn13Valid } from "../src/schema.js";

type Raw = Record<string, any>;
const args = process.argv.slice(2);
const flag = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function loadKey(): string {
  if (process.env.ALADIN_TTB_KEY) return process.env.ALADIN_TTB_KEY;
  const f = join(homedir(), ".config", "one-book", "keys.env");
  if (existsSync(f)) { const m = /^ALADIN_TTB_KEY=(.+)$/m.exec(readFileSync(f, "utf8")); if (m?.[1]) return m[1].trim(); }
  console.error(`알라딘 TTB 키가 없다. 발급: https://www.aladin.co.kr/ttb/wblog_manage.aspx (알라딘 로그인 → TTB 키 발급, 즉시).
그 키를 ${f} 에 ALADIN_TTB_KEY=... 한 줄로 두거나 환경변수로 준다. 레포에는 절대 넣지 않는다.`);
  process.exit(2);
}

const norm = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
const stripVolume = (t: string) => t.replace(/\s*[\(\[][^)\]]*[\)\]]\s*/g, " ").replace(/\s*(세트|전집|합본|상|중|하|\d+권?|[상중하]권)\s*$/u, "").trim();
const translators = (author: string): string[] => [...author.matchAll(/([^,()]+?)\s*\((?:옮긴이|번역|역)\)/g)].map((m) => (m[1] ?? "").trim()).filter(Boolean);

export function matchItems(work: Raw, author: Raw, items: Raw[]) {
  const wantTitle = norm(work.titleKo ?? "");
  const koTokens = String(author.names?.ko ?? "").split(/\s+/).filter((t) => t.length >= 2);
  const surname = String(author.names?.original ?? "").split(/\s+/).pop() ?? "";
  const out: Raw[] = [];
  for (const it of items) {
    if (it.mallType && it.mallType !== "BOOK") continue;            // 전자책·음반 제외
    const title = String(it.title ?? "");
    if (/세트|전집|합본/.test(title)) continue;
    const t = norm(stripVolume(title));
    if (!wantTitle || !(t.startsWith(wantTitle) || t.includes(wantTitle))) continue;
    const authorField = String(it.author ?? "");
    const authorOk = koTokens.some((k) => authorField.includes(k)) || (surname.length >= 3 && authorField.toLowerCase().includes(surname.toLowerCase()));
    if (!authorOk) continue;
    const isbn13 = String(it.isbn13 ?? "");
    if (!isbn13Valid(isbn13)) continue;
    const year = Number(String(it.pubDate ?? "").slice(0, 4));
    if (!(year >= 1900)) continue;
    const tr = translators(authorField);
    out.push({
      workId: work.id, isbn13, title: title.trim(), publisher: String(it.publisher ?? "").trim(), year,
      ...(tr.length ? { translator: tr.join(", ") } : {}), language: "ko",
      categoryName: it.categoryName, exact: t === wantTitle,
      ...(/어린이|청소년|만화|축약|다이제스트/.test(String(it.categoryName ?? "") + title) ? { note: "어린이·청소년·축약 분류 — 번안일 수 있다" } : {}),
    });
  }
  out.sort((a, b) => Number(b.exact) - Number(a.exact) || b.year - a.year);
  return out;
}

function parseTtb(text: string): Raw {
  // Output=js 는 JSON 이지만 오래된 이스케이프(\')가 섞여 온다.
  try { return JSON.parse(text); } catch { return JSON.parse(text.replace(/\\'/g, "'").replace(/;\s*$/, "")); }
}

async function search(key: string, q: string): Promise<Raw[]> {
  const u = new URL("https://www.aladin.co.kr/ttb/api/ItemSearch.aspx");
  for (const [k, v] of Object.entries({ ttbkey: key, Query: q, QueryType: "Title", SearchTarget: "Book", MaxResults: "30", Cover: "None", Output: "js", Version: "20131101" })) u.searchParams.set(k, v);
  const r = await fetch(u); const j = parseTtb(await r.text());
  if (j.errorCode) throw new Error(`ttb ${j.errorCode} ${j.errorMessage}`);
  return j.item ?? [];
}

function loadAll() {
  const read = (d: string) => readdirSync(join("data", d)).filter((f) => f.endsWith(".json")).flatMap((f) => JSON.parse(readFileSync(join("data", d, f), "utf8")) as Raw[]);
  const authors = read("authors"); const works = read("works");
  return { authors: new Map(authors.map((a) => [a.id, a])), works };
}

async function main() {
  const { authors, works } = loadAll();
  if (flag("--fixture")) {
    const w = works.find((x) => x.id === flag("--work")); if (!w) throw new Error(`작품 ${flag("--work")} 없음`);
    const items = parseTtb(readFileSync(flag("--fixture")!, "utf8")).item ?? [];
    const got = matchItems(w, authors.get(w.authorId)!, items);
    console.log(JSON.stringify(got, null, 1)); return;
  }
  const out = flag("--out"); if (!out) throw new Error("--out <candidates.json> 이 필요하다");
  const key = loadKey();
  let todo = works;
  if (flag("--works")) { const s = new Set(flag("--works")!.split(",")); todo = works.filter((w) => s.has(w.id)); }
  else if (flag("--authors")) { const s = new Set(flag("--authors")!.split(",")); todo = works.filter((w) => s.has(w.authorId)); }
  else if (args.includes("--plates")) todo = works.filter((w) => { const a = authors.get(w.authorId); return a && (a.depth ?? "plate") === "plate"; });
  if (flag("--limit")) todo = todo.slice(0, Number(flag("--limit")));
  console.log(`작품 ${todo.length}편 조회`);
  const found: Record<string, Raw[]> = {}; const none: string[] = []; let calls = 0;
  for (const w of todo) {
    const a = authors.get(w.authorId); if (!a || !w.titleKo) { none.push(`${w.id}: 작가 또는 한국어 제목 없음`); continue; }
    try {
      const items = await search(key, w.titleKo); calls++;
      if (calls === 1) console.log(`  첫 응답 표본: ${JSON.stringify(items[0] ?? null).slice(0, 300)}`);
      const m = matchItems(w, a, items);
      if (m.length) found[w.id] = m; else none.push(`${w.id}: 검색 ${items.length}건 중 일치 0`);
    } catch (e) { none.push(`${w.id}: ${(e as Error).message}`); if (/ttb 9/.test(String(e))) break; } // 일일 한도
    await sleep(400);
  }
  const ledger = { generatedAt: new Date().toISOString().slice(0, 10), source: "aladin-ttb ItemSearch (QueryType=Title)", calls, found, none };
  writeFileSync(out, JSON.stringify(ledger, null, 2) + "\n");
  console.log(`후보 있음 ${Object.keys(found).length} · 없음 ${none.length} · 호출 ${calls} → ${out}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
