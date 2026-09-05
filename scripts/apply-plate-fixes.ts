// 도판 QC 되돌림 적용 — docs/plate-wave.md.
//
// QC 가 되돌린 것을 고친다: 산문 필드 교체 · 작품 의의 교체 · 관계 삭제 · 그로써 아무도
// 참조하지 않게 된 새 출처 삭제. 승급 자체는 되돌리지 않는다 — 도판의 값(입문·관계·난도)이
// 하나라도 남아 있으면 도판이고, 관계가 0 이 되면 검증기가 그것을 잡아 write 를 막는다.
//
//   npx tsx scripts/apply-plate-fixes.ts <fixes.json> --key <wave> [--write]
//
// 입력: { fixes: [ { id, importanceReason?, difficulty?, difficultyReason?, readingEntry?,
//   readingEntryReason?, readingOrder?, readingWarning?, works?: [{ id, significance }],
//   relations?: [{ id, summary?, evidenceLevel?, sourceIds?, weight? }],
//   dropRelations?: [relationId], dropSources?: [sourceId]  ← 이 작가의 참조에서 뺀다,
//   unresolvable?: "why"  ← 관계를 하나도 못 지킨다: 스케치로 되돌린다 } ] }
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadRawCollections, PKG_ROOT } from "./lib/load-node.ts";
import { assembleDataset } from "../src/data/assemble.ts";
import { RELATION_DEFS } from "../src/types.ts";

const file = process.argv[2];
const write = process.argv.includes("--write");
const keyArg = process.argv[process.argv.indexOf("--key") + 1];
const KEY = process.argv.includes("--key") && keyArg ? keyArg : "wave1";
if (!file) throw new Error("usage: apply-plate-fixes <fixes.json> --key <wave> [--write]");

type Raw = Record<string, any>;
const files = loadRawCollections();
const before = assembleDataset(files);
if (!before.dataset) throw new Error("기존 코퍼스가 조립되지 않는다");
const byId = new Map(before.dataset.authors.map((a) => [a.id, a]));

const parsed = JSON.parse(readFileSync(file, "utf8"));
const fixes: Raw[] = Array.isArray(parsed) ? parsed : parsed.fixes ?? [];

const SUPERLATIVE = /처음|최초|유일|가장 이른|첫 번째|시초|효시/;
const log: string[] = [];
const skipped: { id: string; why: string }[] = [];
let fieldEdits = 0, workEdits = 0, relEdits = 0, relDrops = 0, demoted = 0, superlatives = 0;

const findRow = (bag: Record<string, unknown>, id: string): Raw | undefined => {
  for (const rows of Object.values(bag)) {
    const r = (rows as Raw[]).find((x) => x.id === id);
    if (r) return r;
  }
  return undefined;
};
// 양방향 관계는 한쪽 방향의 id 로만 저장된다 — 반대 방향 id 로 와도 같은 선이다.
const reverseRelId = (id: string): string | undefined => {
  const m = id.match(/^([a-z_]+)--([a-z0-9-]+)--([a-z0-9-]+)$/);
  return m ? `${m[1]}--${m[3]}--${m[2]}` : undefined;
};
const findRel = (id: string): { row: Raw; path: string; index: number } | undefined => {
  for (const cand of [id, reverseRelId(id)].filter(Boolean) as string[])
    for (const [path, rows] of Object.entries(files.relationFiles)) {
      const arr = rows as Raw[];
      const i = arr.findIndex((r) => r.id === cand);
      if (i >= 0) return { row: arr[i]!, path, index: i };
    }
  return undefined;
};

for (const f of fixes) {
  const id = String(f.id ?? "");
  const a = byId.get(id);
  if (!a) { skipped.push({ id, why: "작가가 코퍼스에 없다" }); continue; }
  if ((a.depth ?? "plate") !== "plate") { skipped.push({ id, why: `${a.depth} 다 — 도판이 아니다` }); continue; }
  const row = findRow(files.authorFiles, id);
  if (!row) { skipped.push({ id, why: "원본 파일에서 못 찾음" }); continue; }

  for (const k of ["importanceReason", "difficultyReason", "readingEntryReason", "readingWarning"] as const) {
    if (typeof f[k] === "string" && f[k].trim()) {
      const v = f[k].trim();
      if (SUPERLATIVE.test(v)) superlatives++;
      row[k] = v; fieldEdits++; log.push(`${id}.${k}`);
    }
  }
  if (Number.isInteger(f.difficulty) && f.difficulty >= 1 && f.difficulty <= 5) { row.difficulty = f.difficulty; fieldEdits++; log.push(`${id}.difficulty=${f.difficulty}`); }
  if (Array.isArray(f.readingOrder) && f.readingOrder.length >= 3) {
    row.readingOrder = f.readingOrder.map(String);
    row.readingEntry = String(f.readingEntry ?? f.readingOrder[0]);
    fieldEdits++; log.push(`${id}.readingOrder`);
  } else if (typeof f.readingEntry === "string") {
    skipped.push({ id, why: "readingEntry 만 바꾸면 순서와 어긋난다 — readingOrder 를 함께 줘라" });
  }
  for (const w of Array.isArray(f.works) ? f.works : []) {
    const wr = findRow(files.workFiles, String(w.id));
    if (!wr) { skipped.push({ id, why: `작품 ${w.id} 없음` }); continue; }
    const sig = String(w.significance ?? "").trim();
    if (sig.length < 30) { skipped.push({ id, why: `작품 ${w.id} 의의 ${sig.length}자` }); continue; }
    if (SUPERLATIVE.test(sig)) superlatives++;
    wr.significance = sig; workEdits++; log.push(`${w.id}.significance`);
  }
  // 관계 부분 교체 — QC 가 근거 문서의 세부를 고쳐 준 경우. 빈 sourceIds 는 "바꾸지 않음"이다
  // (빈 배열을 그대로 쓰면 검증기가 출처 요구로 막는다 — 그건 재작성이 아니라 삭제 의도다).
  for (const r of Array.isArray(f.relations) ? f.relations : []) {
    const hit = findRel(String(r.id));
    if (!hit) { skipped.push({ id, why: `관계 ${r.id} 없음` }); continue; }
    const rr = hit.row;
    if (typeof r.summary === "string" && r.summary.trim().length >= 10) rr.summary = r.summary.trim();
    if (typeof r.evidenceLevel === "string") {
      // 그 타입이 허용하지 않는 수준으로 낮췄다 = 허용되는 근거가 없다는 판정이다. 그 관계는 없는 것.
      const def = RELATION_DEFS.find((d) => d.id === rr.type);
      if (def && !(def.levels as readonly string[]).includes(r.evidenceLevel)) {
        ((files.relationFiles as any)[hit.path] as Raw[]).splice(hit.index, 1);
        relDrops++; log.push(`-${rr.id} (${rr.type} 에 ${r.evidenceLevel} 불가 → 삭제)`);
        continue;
      }
      rr.evidenceLevel = r.evidenceLevel;
    }
    if (Array.isArray(r.sourceIds) && r.sourceIds.length) rr.sourceIds = r.sourceIds.map(String);
    if (typeof r.weight === "number") rr.weight = r.weight;
    relEdits++; log.push(`${r.id}.summary`);
  }
  for (const rid of Array.isArray(f.dropRelations) ? f.dropRelations.map(String) : []) {
    const hit = findRel(rid);
    if (!hit) { skipped.push({ id, why: `관계 ${rid} 없음` }); continue; }
    ((files.relationFiles as any)[hit.path] as Raw[]).splice(hit.index, 1);
    relDrops++; log.push(`-${hit.row.id} (${hit.path})`);
  }
  // (b) dropSources 는 "이 작가가 그 출처를 근거로 삼지 않는다"다 — 기존 출처(239)를 지우는 것이
  // 아니라 이 작가의 프로필·관계 참조에서 뺀다. 웨이브 출처가 고아가 되면 아래에서 정리된다.
  for (const sid of Array.isArray(f.dropSources) ? f.dropSources.map(String) : []) {
    const before = (row.sourceIds ?? []).length;
    row.sourceIds = (row.sourceIds ?? []).filter((s: string) => s !== sid);
    if (row.sourceIds.length !== before) log.push(`${id}.sourceIds -${sid}`);
    for (const rows of Object.values(files.relationFiles))
      for (const rr of rows as Raw[])
        if ((rr.sourceId === id || rr.targetId === id) && (rr.sourceIds ?? []).includes(sid)) {
          rr.sourceIds = rr.sourceIds.filter((s: string) => s !== sid); log.push(`${rr.id}.sourceIds -${sid}`);
        }
    // 빈 배열이 남으면 검증기가 잡는다 — 여기서 숨기지 않는다
  }
  if (typeof f.unresolvable === "string" && f.unresolvable.trim()) demote(id, row, f.unresolvable.trim());
}

// 관계 0 도판은 도판이 아니다: 스케치로 되돌린다. 두 길로 온다 — 재작성이 unresolvable 이라 말했거나,
// 삭제·수준 조정의 결과로 관계가 하나도 남지 않았거나. 두 번째는 **다른 작가의 fix** 가 지운 선일 수
// 있어서(실측: 순턴 푸의 유일한 관계를 호아킨 쪽 fix 가 지웠다) 전 fix 를 적용한 뒤에 본다.
// 한 문장(importanceReason)은 남고, 입문·난도·순서·출처는 걷어내고, 작품은 책등으로, 배차 원장에서 뺀다.
function demote(id: string, row: Raw, why: string) {
  if (row.depth !== "plate") return;
  row.depth = "sketch";
  for (const k of ["readingEntry", "readingEntryReason", "readingOrder", "readingWarning", "difficulty", "difficultyReason", "genres", "sourceIds"]) delete row[k];
  row.readingOrder = []; row.genres = []; row.sourceIds = [];
  for (const rows of Object.values(files.workFiles))
    for (const wr of rows as Raw[]) if (wr.authorId === id) { wr.depth = "silhouette"; delete wr.significance; wr.sourceIds = []; }
  for (const [path, rows] of Object.entries(files.relationFiles)) {
    const arr = rows as Raw[];
    for (let k = arr.length - 1; k >= 0; k--) if (arr[k]!.sourceId === id || arr[k]!.targetId === id) { log.push(`-${arr[k]!.id} (${path}, 강등)`); arr.splice(k, 1); relDrops++; }
  }
  const reg = files.registry as Raw[]; const ri = reg.findIndex((r) => r.id === id); if (ri >= 0) reg.splice(ri, 1);
  demoted++; log.push(`${id} → sketch: ${why.slice(0, 80)}`);
}
for (let pass = 0; pass < 3; pass++) {           // 강등이 지운 선이 또 다른 도판을 0 으로 만들 수 있다
  const rels = Object.values(files.relationFiles).flatMap((rows) => rows as Raw[]);
  for (const rows of Object.values(files.authorFiles))
    for (const row of rows as Raw[])
      if (row.depth === "plate" && (files.registry as Raw[]).some((r) => r.id === row.id && r.batch === `plate-${KEY}`)
          && !rels.some((rr) => rr.sourceId === row.id || rr.targetId === row.id))
        demote(row.id, row, "관계가 하나도 남지 않았다");
}

// 이 웨이브의 새 출처 중 이제 아무도 참조하지 않는 것은 지운다 — 기존 출처는 건드리지 않는다.
const wavePath = `sources/plate-${KEY}.json`;
let srcDrops = 0;
if (wavePath in files.sourceFiles) {
  const used = new Set<string>();
  for (const rows of Object.values(files.authorFiles)) for (const r of rows as Raw[]) for (const s of r.sourceIds ?? []) used.add(s);
  for (const rows of Object.values(files.workFiles)) for (const r of rows as Raw[]) { for (const s of r.sourceIds ?? []) used.add(s); if (r.world?.opening?.sourceId) used.add(r.world.opening.sourceId); }
  for (const rows of Object.values(files.relationFiles)) for (const r of rows as Raw[]) for (const s of r.sourceIds ?? []) used.add(s);
  const arr = (files.sourceFiles as any)[wavePath] as Raw[];
  const kept = arr.filter((s) => used.has(s.id));
  srcDrops = arr.length - kept.length;
  (files.sourceFiles as any)[wavePath] = kept;
}

console.log(`고침: 필드 ${fieldEdits} · 작품 의의 ${workEdits} · 관계 교체 ${relEdits} · 관계 삭제 ${relDrops} · 스케치로 강등 ${demoted} · 웨이브 출처 정리 ${srcDrops} · 최초형 ${superlatives} · 건너뜀 ${skipped.length}`);
for (const s of skipped.slice(0, 12)) console.log(`  건너뜀 ${s.id}: ${s.why}`);
if (!write) { console.log("(--write 없이 실행 — 파일을 쓰지 않았다)"); process.exit(0); }

const check = assembleDataset(files);
if (check.errors.length) {
  console.log(`\n검증기 빨강 ${check.errors.length}건 — 아무것도 쓰지 않았다:`);
  for (const e of check.errors.slice(0, 20)) console.log("  " + e);
  process.exit(1);
}
for (const bag of [files.authorFiles, files.workFiles, files.relationFiles, files.sourceFiles])
  for (const [p, rows] of Object.entries(bag)) writeFileSync(join(PKG_ROOT, "data", p), JSON.stringify(rows, null, 2) + "\n");
// 강등이 배차 원장에서 뺀 행도 파일로 — 메모리 검증은 통과하고 파일 검증은 빨간 상태를 한 번 만들었다.
writeFileSync(join(PKG_ROOT, "data", "registry.json"), JSON.stringify(files.registry, null, 2) + "\n");
console.log(`  → 썼다 (${log.length} 변경)`);
