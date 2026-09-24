// Promote edition candidates into the ledger — data/editions.json — under one rule set, language by language.
//
//   npx tsx scripts/promote-editions.ts <candidates.json> [--max 3] [--basis <basis.json>] [--only-entry] [--emit picks.json] [--replace] [--write]
//
// A candidates file carries one language (the resolver's provider). Per work: a translation must name its translator
// (self-published public-domain reprints dated this year rarely do), standard series and major publishers rank first,
// items on sale before the rest, exact titles before "…에 수록", then newest. At most --max distinct (publisher,
// translator) pairs per work per language. Editions already in the ledger in that language are left alone unless
// --replace (machine-picked entries may be re-picked by the machine; a ledger a person has touched is not). Other
// languages' entries are always kept. --basis attaches sourceTextBasis (a separate judgment) by ISBN to new and
// existing entries. The ledger's checkedAt becomes today. Nothing is written unless the whole file passes the schema.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { editionsFileSchema } from "../src/schema.js";
import { applyEditionFix } from "./lib/edition-ledgers.ts";

type Raw = Record<string, any>;
const args = process.argv.slice(2);
const flag = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const WRITE = args.includes("--write");
const REPLACE = args.includes("--replace");
const MAX = Number(flag("--max") ?? 3);
const candPath = args.find((a, i) => a.endsWith(".json") && !a.startsWith("--") && !["--basis", "--emit"].includes(args[i - 1] ?? ""));
if (!candPath) throw new Error("usage: promote-editions <candidates.json> [--max N] [--basis basis.json] [--only-entry] [--emit picks.json] [--replace] [--write]");
const today = new Date().toISOString().slice(0, 10);

// 정본 시리즈·주요 출판사 — 배제가 아니라 순서다. 편집·역주가 있는 판을 재간 공장 앞에 둔다.
const PREFERRED: Record<string, string[]> = {
  ko: ["민음사","문학동네","열린책들","을유문화사","문학과지성사","창비","문예출판사","펭귄클래식","시공사","현대문학","한길사","책세상","지식을만드는지식","동서문화사","범우사","솔출판사","새움","더클래식","휴머니스트","아카넷","그린비","나남","서울대학교출판","소명출판","한겨레출판","비채","은행나무","자음과모음","살림","웅진지식하우스","김영사","부북스","마음산책","문학수첩","열림원","푸른숲","이숲","돌베개","글항아리","궁리","까치","한울","도서출판b","읻다","현암사","민음인","작가정신","문학사상","인다","녹색광선","황금가지"],
  fr: ["Gallimard","Pléiade","Folio","Flammarion","GF","Livre de Poche","Pocket","Points","Garnier","Champion","Belles Lettres","Le Seuil","Actes Sud","Grasset","Albin Michel","Bordas","Hatier","Larousse","Minuit","Robert Laffont","Bouquins","Rivages","José Corti","Payot"],
  de: ["Fischer","Suhrkamp","Reclam","dtv","Hanser","Insel","Diogenes","Rowohlt","Wallstein","de Gruyter","Deutscher Klassiker","Aufbau","C.H. Beck","Beck","Piper","Manesse","Kiepenheuer","Ullstein","Luchterhand","Klett-Cotta","Hoffmann und Campe","Schöningh","Königshausen","Stroemfeld","Anaconda","Nikol"],
  ja: ["岩波書店","岩波文庫","新潮社","新潮文庫","角川","講談社","筑摩書房","ちくま","河出書房新社","集英社","中央公論","中公","光文社","文藝春秋","小学館","早川書房","白水社","みすず書房","平凡社","有斐閣","勉誠","汲古書院","笠間書院"],
  en: ["Penguin","Oxford University Press","Oxford World's Classics","Everyman","Norton","New York Review Books","NYRB","Vintage","Modern Library","Harvard University Press","Loeb","Cambridge University Press","Hackett","Dover","Library of America","Yale University Press","Princeton University Press","University of Chicago Press","Farrar","Knopf","Faber","Bloomsbury","Verso","Archipelago","Dalkey Archive","New Directions","Pushkin Press"],
};
// 서점이라면 반드시 꽂아 둘 판 — 세계문학전집·고전 총서를 내는 곳. 평가가 짚었다: 최신순만으로는 『죄와 벌』에서
// 민음사·열린책들이 빠진다.
const CANON_KO = ["민음사","문학동네","열린책들","을유문화사","창비","문학과지성사","펭귄클래식","현대문학","한길사","책세상","아카넷","도서출판숲","숲","문예출판사","시공사","대산세계문학"];
const canon = (lang: string, pub: string) => lang === "ko" && CANON_KO.some((m) => pub.replace(/\s+/g, "") === m || pub.replace(/\s+/g, "").startsWith(m));
const preferred = (lang: string, pub: string) => (PREFERRED[lang] ?? []).some((m) => pub.replace(/\s+/g, "").toLowerCase().includes(m.replace(/\s+/g, "").toLowerCase()));

const read = (d: string) => readdirSync(join("data", d)).filter((f) => f.endsWith(".json")).flatMap((f) => JSON.parse(readFileSync(join("data", d, f), "utf8")) as Raw[]);
const authors = new Map(read("authors").map((a) => [a.id, a]));
const works = new Map(read("works").map((w) => [w.id, w]));
const ledgerPath = join("data", "editions.json");
const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
const cands = JSON.parse(readFileSync(candPath, "utf8"));
const LANG: string = cands.language ?? "ko";
const SOURCE: string = cands.source ?? "카카오 책 검색 API · 제목·저자·ISBN-13 대조";
const basis: Record<string, { sourceTextBasis: string; note?: string }> = flag("--basis") ? JSON.parse(readFileSync(flag("--basis")!, "utf8")).byIsbn ?? {} : {};
const entryOnly = args.includes("--only-entry");
const entryWorks = new Set([...authors.values()].map((a) => a.readingEntry).filter(Boolean));

// 제외 원장 — 조회로 "이건 판본이 아니다"라고 판정된 ISBN(축약·재화, 해설서, 오디오, 전자책, 다른 책). 원장에서 행을 지우면
// 판정도 같이 사라져 다음 승격에 그 행이 되돌아온다(실측: 『일리아스』 재화본). 그래서 판정을 따로 남긴다.
const EXCLUDED: Record<string, unknown> = existsSync(join("qc", "editions-excluded.json")) ? JSON.parse(readFileSync(join("qc", "editions-excluded.json"), "utf8")).excluded ?? {} : {};
// 저본 판정은 ISBN 에 붙은 값이다 — 다시 고를 때 이미 판정된 ISBN 은 그 판정을 들고 간다.
for (const list of Object.values(ledger.editions as Record<string, Raw[]>))
  for (const e of list) if (e.sourceTextBasis && !basis[e.isbn13]) basis[e.isbn13] = { sourceTextBasis: e.sourceTextBasis, ...(e.note ? { note: e.note } : {}) };
// ISBN 은 원장 전체에서 한 번 — 이번에 다시 고를 언어의 항목은 풀어 준다.
const usedIsbn = new Set<string>();
for (const [w, list] of Object.entries(ledger.editions as Record<string, Raw[]>))
  for (const e of list) if (!(REPLACE && (cands.found as Raw)[w] && (e.language ?? "ko") === LANG)) usedIsbn.add(e.isbn13);

let promoted = 0, worksTouched = 0, skippedNoTranslator = 0, skippedHave = 0, basisApplied = 0; const noPick: string[] = []; const emitted: Raw[] = [];
// 판정은 새 항목이든 기존 항목이든 ISBN 으로 붙인다.
for (const list of Object.values(ledger.editions as Record<string, Raw[]>))
  for (const e of list) { const b = basis[e.isbn13]; if (b?.sourceTextBasis && !e.sourceTextBasis) { e.sourceTextBasis = b.sourceTextBasis; if (b.note && !e.note) e.note = b.note; basisApplied++; } }

// 한 ISBN 은 원장에서 한 자리 — 합본(『변신·시골의사』)은 제목이 정확히 맞는 작품에 먼저 간다. 그래서 두 번 돈다:
// 1차는 정확 제목 후보만, 2차는 나머지로 채운다.
const pools = new Map<string, { w: Raw; a: Raw | undefined; pool: Raw[]; picked: Raw[]; seen: Set<string> }>();
for (const [workId, list] of Object.entries(cands.found as Record<string, Raw[]>)) {
  const w = works.get(workId); if (!w) continue;
  if (entryOnly && !entryWorks.has(workId)) continue;
  const existing: Raw[] = ledger.editions[workId] ?? [];
  const sameLang = existing.filter((e) => (e.language ?? "ko") === LANG);
  if (sameLang.length && !REPLACE) { skippedHave++; continue; }
  const a = authors.get(w.authorId);
  const translation = !(a?.languages ?? []).includes(LANG);
  // 조회로 판정된 표준판(pinned)은 거르지 않는다 — 목록에 역자가 비었거나 자동 메모가 붙었다고 사람이 확인한 판을
  // 떨어뜨리면, 이백 「정야사」처럼 「아직 검수하지 않았다」가 선다(2026-09-24 감사: 핀 244개 중 17개가 쪽에 닿지 못했다).
  let pool = list.filter((c) => c.pinned || !translation || c.translator);
  if (translation && !pool.length && list.length) skippedNoTranslator++;
  pool = pool.filter((c) => c.pinned || !c.note); // 어린이·축약 표시가 붙은 것은 판정 없이 올리지 않는다
  pool.sort((x, y) => Number(y.pinned ?? 0) - Number(x.pinned ?? 0) || Number(canon(LANG, y.publisher)) - Number(canon(LANG, x.publisher)) || Number(preferred(LANG, y.publisher)) - Number(preferred(LANG, x.publisher))
    || Number((y.status ?? "정상판매") === "정상판매") - Number((x.status ?? "정상판매") === "정상판매")
    || Number(y.exact) - Number(x.exact) || y.year - x.year);
  pools.set(workId, { w, a, pool, picked: [], seen: new Set() });
}
// 도서관 목록의 출판사 칸에는 주소·괄호·오타가 딸려 온다. 판정 원장(qc/publisher-fixes.json)이 아는 것은 고치고,
// 괄호로 시작하거나 우편번호가 든 것은 고쳐지지 않은 채로는 올리지 않는다 — 표지에 찍힌 이름만 표에 선다.
const PUB_FIX: Record<string, string> = JSON.parse(readFileSync("qc/publisher-fixes.json", "utf8"));
const cleanPublisher = (raw: string): string | undefined => {
  const p = PUB_FIX[raw] ?? raw;
  if (/^[\(\[]/.test(p) || /\b[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}\b/.test(p)) return undefined;
  return p;
};
const take = (c: Raw, st: { picked: Raw[]; seen: Set<string> }) => {
  if (!/^97[89]\d{10}$/.test(String(c.isbn13))) return; // 유통 바코드(480…)는 ISBN 이 아니다
  const pub = cleanPublisher(String(c.publisher ?? "").trim());
  if (!pub || !String(c.title ?? "").trim()) return; // 출판사·제목 없는(또는 목록 찌꺼기인) 레코드는 올리지 않는다
  c = { ...c, publisher: pub };
  if (basis[c.isbn13]?.sourceTextBasis === "adaptation") return; // 축약·재화로 판정된 판은 「구하기」에 올리지 않는다
  if (EXCLUDED[c.isbn13]) return;
  const k = `${c.publisher}|${c.translator ?? ""}`;
  if (st.seen.has(k) || usedIsbn.has(c.isbn13)) return;
  st.seen.add(k); usedIsbn.add(c.isbn13);
  const b = basis[c.isbn13];
  const rec: Raw = {
    isbn13: c.isbn13, title: c.title, publisher: c.publisher, ...(c.translator ? { translator: c.translator } : {}), year: c.year, language: LANG,
    ...(b?.sourceTextBasis ? { sourceTextBasis: b.sourceTextBasis } : {}),
    verifiedFrom: SOURCE, verifiedAt: today, ...(b?.note ? { note: b.note } : {}),
  };
  applyEditionFix(rec as Record<string, unknown>); // 목록이 틀리게 준 역자·연도·역할 — qc/edition-fixes.json
  st.picked.push(rec);
};
for (const pass of ["exact", "rest"] as const)
  for (const st of pools.values())
    for (const c of st.pool) { const ex = Boolean(c.exact || c.pinned); if (st.picked.length >= MAX) break; if (pass === "exact" ? !ex : ex) continue; if (pass === "rest" && st.picked.length >= 2) break; take(c, st); } // 합본·수록은 정확 제목이 둘 미만일 때만 — 고정판(pinned)은 조회로 판정된 것이라 정확 제목과 같이 먼저 간다
for (const [workId, st] of pools) {
  const existing: Raw[] = ledger.editions[workId] ?? [];
  if (!st.picked.length) { noPick.push(workId); continue; }
  ledger.editions[workId] = [...existing.filter((e) => (e.language ?? "ko") !== LANG), ...st.picked];
  promoted += st.picked.length; worksTouched++;
  for (const e of st.picked) emitted.push({ workId, titleKo: st.w.titleKo, titleOriginal: st.w.titleOriginal, workLanguages: st.a?.languages ?? [], entry: entryWorks.has(workId), language: LANG, isbn13: e.isbn13, title: e.title, publisher: e.publisher, translator: e.translator, year: e.year });
}
if (flag("--emit")) { writeFileSync(flag("--emit")!, JSON.stringify({ picks: emitted }, null, 2) + "\n"); console.log(`  선택 ${emitted.length}건 → ${flag("--emit")}`); }
ledger.checkedAt = today;
const parsed = editionsFileSchema.safeParse(ledger);
console.log(`승격(${LANG}): 작품 ${worksTouched} · 판본 ${promoted} · 이미 있음 ${skippedHave} · 판정 덧붙임 ${basisApplied} · 번역자 없는 후보만 ${skippedNoTranslator} · 고를 것 없음 ${noPick.length}`);
if (!parsed.success) { console.error("원장 스키마 빨강 — 쓰지 않았다:"); for (const i of parsed.error.issues.slice(0, 8)) console.error("  ", i.path.join("."), i.message); process.exit(1); }
if (WRITE) { writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + "\n"); console.log(`  → 썼다 ${ledgerPath} (checkedAt ${today})`); }
else console.log("(--write 없이 실행 — 파일을 쓰지 않았다)");
