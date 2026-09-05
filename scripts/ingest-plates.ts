// 도판 승급 인제스트 — docs/plate-wave.md.
//
// 스케치를 도판으로 올린다: 입문작과 순서 · 난도 · 작품별 의의 · 출처 있는 관계.
// 한 작가는 **전부 통과하거나 전부 버려진다** — 반쪽 도판은 없다.
// 승급된 도판은 `reviewStatus: draft` 로 남는다. 검토는 사람의 일이다.
//
//   npx tsx scripts/ingest-plates.ts <candidates.json> --key <name> [--write]
//
// 입력: { plates: [ … ] } (생성 워크플로우 출력)
// 출력(--write): 작가·기존 작품은 제자리 승급, 새 작품·관계·출처는 data/*/plate-<key>.json,
//               registry 에 배차 행 추가.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadRawCollections, PKG_ROOT } from "./lib/load-node.ts";
import { assembleDataset } from "../src/data/assemble.ts";
import { GENRE_DEFS, RELATION_DEFS } from "../src/types.ts";

const file = process.argv[2];
const write = process.argv.includes("--write");
const keyArg = process.argv[process.argv.indexOf("--key") + 1];
const KEY = process.argv.includes("--key") && keyArg ? keyArg : "wave";
if (!file) throw new Error("usage: ingest-plates <candidates.json> --key <name> [--write]");

type Raw = Record<string, any>;
const raw = loadRawCollections();
// 이 실행이 쓸 파일은 이 실행의 코퍼스가 아니다.
for (const p of [`works/plate-${KEY}.json`, `relations/plate-${KEY}.json`, `sources/plate-${KEY}.json`]) {
  const dir = p.split("/")[0]!;
  const bag = (raw as any)[`${dir.replace(/s$/, "")}Files`] ?? (raw as any)[`${dir}Files`];
  if (bag && p in bag) delete bag[p];
}
const { dataset } = assembleDataset(raw);
if (!dataset) throw new Error("기존 코퍼스가 조립되지 않는다 — 먼저 그것부터 고쳐라");

const byId = new Map(dataset.authors.map((a) => [a.id, a]));
const workById = new Map(dataset.works.map((w) => [w.id, w]));
const sourceIds = new Set(dataset.sources.map((s) => s.id));
const relationIds = new Set(dataset.relations.map((r) => r.id));
const GENRES = new Set(GENRE_DEFS.map((g) => g.id as string));
const TYPES = new Map(RELATION_DEFS.map((t) => [t.id as string, t]));
const SUPERLATIVE = /처음|최초|유일|가장 이른|첫 번째|시초|효시/;
const SOURCE_ID = /^src--[a-z0-9]+(-[a-z0-9]+)*$/;
const WORK_ID = /^[a-z0-9]+(-[a-z0-9]+)*--[a-z0-9]+(-[a-z0-9]+)*$/;

const parsed = JSON.parse(readFileSync(file, "utf8"));
const candidates: Raw[] = Array.isArray(parsed) ? parsed : (parsed.plates ?? []);

// 이 웨이브에서 도판이 될 사람 — 관계 상대로 허용된다(같은 웨이브 안에서 서로 잇는다).
const waveIds = new Set(candidates.map((c) => String(c.id)));
const plateIds = new Set(dataset.authors.filter((a) => (a.depth ?? "plate") === "plate").map((a) => a.id));

// 새 출처는 웨이브 전체가 공유하는 풀이다. 한 배치가 한 컨텍스트에서 여섯 명을 쓰면 같은
// 문헌을 여럿이 인용하고, 정의는 한 사람 밑에만 적힌다 (실측: 66명 중 5명이 이 이유로 탈락).
// 정의자가 탈락해도 참조하는 사람이 남으면 그 출처는 남는다 — 최종 파일엔 참조된 것만 쓴다.
const sourcePool = new Map<string, Raw>();
for (const c of candidates)
  for (const s of Array.isArray(c.newSources) ? c.newSources : []) {
    const sid = String(s.id ?? "");
    if (!SOURCE_ID.test(sid) || !String(s.title ?? "").trim() || !String(s.publisherOrInstitution ?? "").trim()) continue;
    if (s.url && !/^https:\/\//.test(String(s.url))) continue;
    if (!sourcePool.has(sid)) sourcePool.set(sid, { id: sid, title: String(s.title).trim(), publisherOrInstitution: String(s.publisherOrInstitution).trim(),
      ...(s.citation ? { citation: String(s.citation).trim() } : {}), ...(s.url ? { url: String(s.url) } : {}) });
  }

const dropped: { id: string; why: string }[] = [];
const accepted: {
  author: Raw;
  works: { existing: Raw[]; fresh: Raw[] };
  relations: Raw[];
  sources: Raw[];
}[] = [];
let superlatives = 0;

const relId = (type: string, s: string, t: string) =>
  `${type === "documented_influence" ? "influence" : type}--${s}--${t}`;

for (const c of candidates) {
  const id = String(c.id ?? "");
  const a = byId.get(id);
  const fail = (why: string) => dropped.push({ id, why });
  if (!a) { fail("작가가 코퍼스에 없다"); continue; }
  if (a.depth !== "sketch") { fail(`${a.depth ?? "plate"} 다`); continue; }
  if (accepted.some((x) => x.author.id === id)) { fail("같은 작가의 후보가 둘"); continue; }

  const reason = String(c.importanceReason ?? "").trim();
  if (reason.length < 60 || reason.length > 450) { fail(`importanceReason 길이 ${reason.length}`); continue; }
  if (SUPERLATIVE.test(reason)) superlatives++;

  const genres = (c.genres ?? []).filter((g: string) => GENRES.has(g));
  if (!genres.length) { fail("장르 없음"); continue; }
  const difficulty = Number(c.difficulty);
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) { fail("난도 범위"); continue; }
  const diffReason = String(c.difficultyReason ?? "").trim();
  if (diffReason.length < 10) { fail("난도 이유 없음"); continue; }

  // 작품 — 기존 실루엣 작품은 제자리 승급, 새 작품은 추가. 전부 의의가 있어야 한다.
  const works: Raw[] = Array.isArray(c.works) ? c.works : [];
  if (works.length < 3) { fail(`작품 ${works.length}편 (3 미만)`); continue; }
  const existing: Raw[] = [], fresh: Raw[] = [];
  let bad = "";
  const seenW = new Set<string>();
  for (const w of works) {
    const wid = String(w.id ?? "");
    if (!WORK_ID.test(wid) || !wid.startsWith(`${id}--`)) { bad = `작품 id 형식 ${wid}`; break; }
    if (seenW.has(wid)) { bad = `작품 id 중복 ${wid}`; break; }
    seenW.add(wid);
    const sig = String(w.significance ?? "").trim();
    if (sig.length < 30) { bad = `${wid} 의의 ${sig.length}자`; break; }
    if (!GENRES.has(String(w.genre))) { bad = `${wid} 장르`; break; }
    if (!Number.isInteger(w.year)) { bad = `${wid} 연도`; break; }
    const prior = workById.get(wid);
    if (prior) {
      if (prior.authorId !== id) { bad = `${wid} 는 다른 작가의 작품`; break; }
      existing.push({ id: wid, significance: sig });
    } else {
      const titleKo = String(w.titleKo ?? "").trim(), titleOriginal = String(w.titleOriginal ?? "").trim();
      if (!titleKo || !titleOriginal) { bad = `${wid} 제목 누락`; break; }
      fresh.push({ id: wid, authorId: id, titleKo, titleOriginal, year: w.year,
        ...(w.yearBasis ? { yearBasis: w.yearBasis } : {}), genre: w.genre, significance: sig, sourceIds: [] });
    }
  }
  if (bad) { fail(bad); continue; }

  const entry = String(c.readingEntry ?? "");
  const order: string[] = Array.isArray(c.readingOrder) ? c.readingOrder.map(String) : [];
  if (!seenW.has(entry)) { fail("입문작이 작품 목록에 없다"); continue; }
  if (order.length < 3 || order.length > 5) { fail(`입문 순서 ${order.length}편`); continue; }
  if (order[0] !== entry) { fail("입문 순서의 첫 항목이 입문작이 아니다"); continue; }
  if (new Set(order).size !== order.length || order.some((o) => !seenW.has(o))) { fail("입문 순서에 모르는 작품"); continue; }
  const entryReason = String(c.readingEntryReason ?? "").trim();
  if (entryReason.length < 10) { fail("입문 이유 없음"); continue; }

  // 출처 — 기존 id 또는 웨이브 풀의 새 출처. 이 후보가 낸 정의가 형식에 어긋나면 그 후보 탈락.
  const newSources: Raw[] = Array.isArray(c.newSources) ? c.newSources : [];
  for (const s of newSources) {
    const sid = String(s.id ?? "");
    if (!SOURCE_ID.test(sid)) { bad = `출처 id 형식 ${sid}`; break; }
    if (!String(s.title ?? "").trim() || !String(s.publisherOrInstitution ?? "").trim()) { bad = `${sid} 제목·기관 누락`; break; }
    if (s.url && !/^https:\/\//.test(String(s.url))) { bad = `${sid} url`; break; }
  }
  if (bad) { fail(bad); continue; }
  const hasSrc = (sid: string) => sourceIds.has(sid) || sourcePool.has(sid);
  const profileSrc: string[] = (c.sourceIds ?? []).map(String);
  if (!profileSrc.length || profileSrc.some((s: string) => !hasSrc(s))) { fail("프로필 출처 없음/미정의"); continue; }

  // 관계 — 도판 사이에만, editorial_inference 금지, 근거 문서 실명은 QC 가 본다
  const rels: Raw[] = Array.isArray(c.relations) ? c.relations : [];
  if (!rels.length) { fail("관계 0"); continue; }
  const outRels: Raw[] = [];
  for (const r of rels) {
    const def = TYPES.get(String(r.type));
    if (!def) { bad = `관계 종류 ${r.type}`; break; }
    const ev = String(r.evidenceLevel);
    if (ev === "editorial_inference") { bad = "editorial_inference 는 이 웨이브에서 금지"; break; }
    if (!(def.levels as readonly string[]).includes(ev)) { bad = `${r.type} 에 ${ev} 불가`; break; }
    const s = String(r.sourceId), t = String(r.targetId);
    if (s !== id && t !== id) { bad = "관계의 한쪽은 이 작가여야 한다"; break; }
    const other = s === id ? t : s;
    if (!plateIds.has(other) && !waveIds.has(other)) { bad = `관계 상대 ${other} 는 도판이 아니다`; break; }
    if (s === t) { bad = "자기 관계"; break; }
    const summary = String(r.summary ?? "").trim();
    if (summary.length < 10) { bad = "관계 요약 없음"; break; }
    const rs: string[] = (r.sourceIds ?? []).map(String);
    if (!rs.length || rs.some((x) => !hasSrc(x))) { bad = `관계 출처 없음/미정의 (${s}→${t})`; break; }
    const weight = Number(r.weight);
    if (!(weight >= 0 && weight <= 1)) { bad = "weight 범위"; break; }
    const rid = relId(def.id, s, t);
    const reverse = relId(def.id, t, s);
    if (relationIds.has(rid) || relationIds.has(reverse)) continue; // 이미 있는 선은 다시 긋지 않는다
    outRels.push({ id: rid, sourceId: s, targetId: t, type: def.id, direction: def.direction,
      weight, summary, evidenceLevel: ev, sourceIds: rs });
  }
  if (bad) { fail(bad); continue; }

  accepted.push({
    author: { ...c, id, importanceReason: reason, genres, difficulty, difficultyReason: diffReason,
      readingEntry: entry, readingEntryReason: entryReason, readingOrder: order,
      readingWarning: c.readingWarning ? String(c.readingWarning) : undefined, sourceIds: profileSrc },
    works: { existing, fresh },
    relations: outRels,
    sources: [...new Set([...profileSrc, ...outRels.flatMap((r) => r.sourceIds as string[])])]
      .filter((sid) => !sourceIds.has(sid))
      .map((sid) => sourcePool.get(sid)!)
  });
}

// 웨이브 내부 관계의 상대가 결국 승급에 실패했으면 그 관계는 도판 사이가 아니다 — 지운다.
const promoted = new Set(accepted.map((x) => x.author.id));
let orphanRels = 0;
for (const x of accepted) {
  const keep = x.relations.filter((r) => {
    const other = r.sourceId === x.author.id ? r.targetId : r.sourceId;
    const ok = plateIds.has(other) || promoted.has(other);
    if (!ok) orphanRels++;
    return ok;
  });
  x.relations = keep;
}
// 같은 선을 두 작가가 각자 냈으면 하나만 — 양방향 관계는 반대 방향으로 낸 것도 같은 선이다
// (실측: 디포↔스위프트 contrast, 사르트르↔파농 dialogue 가 양쪽에서 한 번씩 왔다).
const seenRel = new Set<string>();
for (const x of accepted)
  x.relations = x.relations.filter((r) => {
    const rev = relId(r.type, r.targetId, r.sourceId);
    if (seenRel.has(r.id) || (r.direction === "bidirectional" && seenRel.has(rev))) return false;
    seenRel.add(r.id);
    return true;
  });
const seenSrc = new Set<string>();
for (const x of accepted) x.sources = x.sources.filter((s) => (sourceIds.has(s.id) || seenSrc.has(s.id) ? false : (seenSrc.add(s.id), true)));

const nRel = accepted.reduce((n, x) => n + x.relations.length, 0);
const nSrc = accepted.reduce((n, x) => n + x.sources.length, 0);
const nFresh = accepted.reduce((n, x) => n + x.works.fresh.length, 0);
const nExisting = accepted.reduce((n, x) => n + x.works.existing.length, 0);
console.log(
  `도판 승급 ${accepted.length}명 · 버림 ${dropped.length} · 관계 ${nRel} (상대 탈락으로 지움 ${orphanRels}) · 새 출처 ${nSrc} · 작품 승급 ${nExisting} + 신규 ${nFresh} · 최초형 ${superlatives}`
);
if (dropped.length) {
  const why = new Map<string, number>();
  for (const dd of dropped) { const k = dd.why.replace(/\(.*\)|\d+/g, "").trim(); why.set(k, (why.get(k) ?? 0) + 1); }
  console.log("버린 이유:");
  for (const [k, n] of [...why].sort((a, b) => b[1] - a[1])) console.log(`  ${n.toString().padStart(4)} ${k}`);
}
if (!write) { console.log("(--write 없이 실행 — 파일을 쓰지 않았다)"); process.exit(0); }

// ── 쓰기: 먼저 메모리에서 조립해 검증기가 초록인지 본다. 빨강이면 아무것도 쓰지 않는다. ──
const files = loadRawCollections();
for (const x of accepted) {
  for (const [, rows] of Object.entries(files.authorFiles)) {
    const row = (rows as Raw[]).find((r) => r.id === x.author.id);
    if (!row) continue;
    row.depth = "plate";
    row.importanceReason = x.author.importanceReason;
    row.genres = x.author.genres;
    row.difficulty = x.author.difficulty;
    row.difficultyReason = x.author.difficultyReason;
    row.readingEntry = x.author.readingEntry;
    row.readingEntryReason = x.author.readingEntryReason;
    row.readingOrder = x.author.readingOrder;
    if (x.author.readingWarning) row.readingWarning = x.author.readingWarning;
    row.sourceIds = x.author.sourceIds;
    row.reviewStatus = "draft";
  }
  for (const e of x.works.existing)
    for (const [, rows] of Object.entries(files.workFiles)) {
      const row = (rows as Raw[]).find((r) => r.id === e.id);
      if (!row) continue;
      delete row.depth;
      row.significance = e.significance;
    }
}
const freshWorks = accepted.flatMap((x) => x.works.fresh);
const newRels = accepted.flatMap((x) => x.relations);
const newSrcs = accepted.flatMap((x) => x.sources);
if (freshWorks.length) (files.workFiles as any)[`works/plate-${KEY}.json`] = freshWorks;
if (newRels.length) (files.relationFiles as any)[`relations/plate-${KEY}.json`] = newRels;
if (newSrcs.length) (files.sourceFiles as any)[`sources/plate-${KEY}.json`] = newSrcs;
const registry = files.registry as Raw[];
for (const x of accepted) {
  const a = byId.get(x.author.id)!;
  if (!registry.some((r) => r.id === a.id))
    registry.push({ id: a.id, ko: a.names.ko, original: a.names.original, layer: a.periods[0], tier: a.tier, batch: `plate-${KEY}` });
}
const check = assembleDataset(files);
if (check.errors.length) {
  console.log(`\n검증기 빨강 ${check.errors.length}건 — 아무것도 쓰지 않았다:`);
  for (const e of check.errors.slice(0, 20)) console.log("  " + e);
  process.exit(1);
}
for (const [p, rows] of Object.entries(files.authorFiles)) writeFileSync(join(PKG_ROOT, "data", p), JSON.stringify(rows, null, 2) + "\n");
for (const [p, rows] of Object.entries(files.workFiles)) writeFileSync(join(PKG_ROOT, "data", p), JSON.stringify(rows, null, 2) + "\n");
if (newRels.length) writeFileSync(join(PKG_ROOT, "data", `relations/plate-${KEY}.json`), JSON.stringify(newRels, null, 2) + "\n");
if (newSrcs.length) writeFileSync(join(PKG_ROOT, "data", `sources/plate-${KEY}.json`), JSON.stringify(newSrcs, null, 2) + "\n");
writeFileSync(join(PKG_ROOT, "data", "registry.json"), JSON.stringify(registry, null, 2) + "\n");
console.log(`  → 작가 ${accepted.length} 승급 · works/plate-${KEY}.json ${freshWorks.length} · relations ${newRels.length} · sources ${newSrcs.length} · registry +${accepted.length}`);
