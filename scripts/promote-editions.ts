// Promote edition candidates into the ledger — data/editions.json — under one rule set, with the judgment
// field (sourceTextBasis) coming from a separate file when a lookup pass has produced it.
//
//   npx tsx scripts/promote-editions.ts <candidates.json> [--max 3] [--basis <basis.json>] [--only-entry] [--emit picks.json] [--write]
//
// Per work: candidates whose title matches, whose author matched, ISBN valid, not e-book/set (the resolver did that);
// here we add the reader's filters — a translation must name its translator (self-published public-domain reprints
// dated this year rarely do), items on sale come first, exact titles before "…에 수록", then newest. At most --max
// distinct (publisher, translator) pairs per work. Works that already have editions are left alone. The ledger's
// checkedAt becomes today. Nothing is written unless the whole file still passes editionsFileSchema.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { editionsFileSchema } from "../src/schema.js";

type Raw = Record<string, any>;
const args = process.argv.slice(2);
const flag = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const WRITE = args.includes("--write");
const MAX = Number(flag("--max") ?? 3);
const candPath = args.find((a) => a.endsWith(".json") && !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--basis");
if (!candPath) throw new Error("usage: promote-editions <candidates.json> [--max N] [--basis basis.json] [--only-entry] [--write]");
const today = new Date().toISOString().slice(0, 10);
const MAJOR_PUBLISHERS = ["민음사","문학동네","열린책들","을유문화사","문학과지성사","창비","문예출판사","펭귄클래식","시공사","현대문학","한길사","책세상","지식을만드는지식","동서문화사","범우사","솔출판사","새움","더클래식","휴머니스트","아카넷","그린비","나남","서울대학교출판","소명출판","한겨레출판","비채","은행나무","자음과모음","살림","웅진지식하우스","김영사","부북스","마음산책","문학수첩","열림원","푸른숲","이숲","돌베개","글항아리","궁리","까치","한울","도서출판b","읻다","현암사","민음인","작가정신","문학사상","인다","녹색광선","황금가지","시공주니어"].map((m) => m.replace(/\s+/g, ""));

const read = (d: string) => readdirSync(join("data", d)).filter((f) => f.endsWith(".json")).flatMap((f) => JSON.parse(readFileSync(join("data", d, f), "utf8")) as Raw[]);
const authors = new Map(read("authors").map((a) => [a.id, a]));
const works = new Map(read("works").map((w) => [w.id, w]));
const ledgerPath = join("data", "editions.json");
const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
const cands = JSON.parse(readFileSync(candPath, "utf8"));
const basis: Record<string, { sourceTextBasis: string; note?: string }> = flag("--basis") ? JSON.parse(readFileSync(flag("--basis")!, "utf8")).byIsbn ?? {} : {};
const entryOnly = args.includes("--only-entry");
const entryWorks = new Set([...authors.values()].map((a) => a.readingEntry).filter(Boolean));

const usedIsbn = new Set<string>(Object.values(ledger.editions as Record<string, Raw[]>).flat().map((e) => e.isbn13));
let promoted = 0, worksTouched = 0, skippedNoTranslator = 0, skippedHave = 0, basisApplied = 0; const noPick: string[] = []; const emitted: Raw[] = [];
for (const [workId, list] of Object.entries(cands.found as Record<string, Raw[]>)) {
  const w = works.get(workId); if (!w) continue;
  if (entryOnly && !entryWorks.has(workId)) continue;
  if (ledger.editions[workId]?.length) {
    // 이미 오른 판본에는 판정만 덧붙인다 — 저본 판정은 승격 뒤에 따로 오는 값이다.
    for (const e of ledger.editions[workId] as Raw[]) { const b = basis[e.isbn13]; if (b?.sourceTextBasis && !e.sourceTextBasis) { e.sourceTextBasis = b.sourceTextBasis; if (b.note && !e.note) e.note = b.note; basisApplied++; } }
    skippedHave++; continue;
  }
  const a = authors.get(w.authorId);
  const translation = !(a?.languages ?? []).includes("ko");
  let pool = list.filter((c) => !translation || c.translator);
  if (translation && !pool.length && list.length) skippedNoTranslator++;
  pool = pool.filter((c) => !c.note); // 어린이·축약 표시가 붙은 것은 판정 없이 올리지 않는다
  // 주요 출판사 먼저 — 편집·역주가 있는 판을 자가출판 재간보다 앞에 둔다(배제가 아니라 순서다).
  const major = (pub: string) => MAJOR_PUBLISHERS.some((m) => pub.replace(/\s+/g, "").includes(m));
  pool.sort((x, y) => Number(major(y.publisher)) - Number(major(x.publisher)) || Number((y.status ?? "정상판매") === "정상판매") - Number((x.status ?? "정상판매") === "정상판매") || Number(y.exact) - Number(x.exact) || y.year - x.year);
  const picked: Raw[] = []; const seen = new Set<string>();
  for (const c of pool) {
    const k = `${c.publisher}|${c.translator ?? ""}`;
    if (seen.has(k) || usedIsbn.has(c.isbn13)) continue;
    seen.add(k); usedIsbn.add(c.isbn13);
    const b = basis[c.isbn13];
    picked.push({
      isbn13: c.isbn13, title: c.title, publisher: c.publisher, ...(c.translator ? { translator: c.translator } : {}), year: c.year, language: "ko",
      ...(b?.sourceTextBasis ? { sourceTextBasis: b.sourceTextBasis } : {}),
      verifiedFrom: `카카오 책 검색 API · 제목·저자·ISBN-13 대조${c.via === "title+author" ? " (저자 질의)" : ""}`, verifiedAt: today,
      ...(b?.note ? { note: b.note } : {}),
    });
    if (picked.length >= MAX) break;
  }
  if (!picked.length) { noPick.push(workId); continue; }
  ledger.editions[workId] = picked; promoted += picked.length; worksTouched++;
  for (const e of picked) emitted.push({ workId, titleKo: w.titleKo, titleOriginal: w.titleOriginal, workLanguages: a?.languages ?? [], entry: entryWorks.has(workId), isbn13: e.isbn13, title: e.title, publisher: e.publisher, translator: e.translator, year: e.year });
}
if (flag("--emit")) { writeFileSync(flag("--emit")!, JSON.stringify({ picks: emitted }, null, 2) + "\n"); console.log(`  선택 ${emitted.length}건 → ${flag("--emit")}`); }
ledger.checkedAt = today;
const parsed = editionsFileSchema.safeParse(ledger);
console.log(`승격: 작품 ${worksTouched} · 판본 ${promoted} · 이미 있음 ${skippedHave}(판정 덧붙임 ${basisApplied}) · 번역자 없는 후보만 ${skippedNoTranslator} · 고를 것 없음 ${noPick.length}`);
if (!parsed.success) { console.error("원장 스키마 빨강 — 쓰지 않았다:"); for (const i of parsed.error.issues.slice(0, 8)) console.error("  ", i.path.join("."), i.message); process.exit(1); }
if (WRITE) { writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + "\n"); console.log(`  → 썼다 ${ledgerPath} (checkedAt ${today})`); }
else console.log("(--write 없이 실행 — 파일을 쓰지 않았다)");
