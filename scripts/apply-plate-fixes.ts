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
//   dropRelations?: [relationId], dropSources?: [sourceId] } ] }
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadRawCollections, PKG_ROOT } from "./lib/load-node.ts";
import { assembleDataset } from "../src/data/assemble.ts";

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
let fieldEdits = 0, workEdits = 0, relDrops = 0, superlatives = 0;

const findRow = (bag: Record<string, unknown>, id: string): Raw | undefined => {
  for (const rows of Object.values(bag)) {
    const r = (rows as Raw[]).find((x) => x.id === id);
    if (r) return r;
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
  for (const rid of Array.isArray(f.dropRelations) ? f.dropRelations.map(String) : []) {
    let hit = false;
    for (const [p, rows] of Object.entries(files.relationFiles)) {
      const arr = rows as Raw[];
      const i = arr.findIndex((r) => r.id === rid);
      if (i >= 0) { arr.splice(i, 1); hit = true; relDrops++; log.push(`-${rid} (${p})`); }
    }
    if (!hit) skipped.push({ id, why: `관계 ${rid} 없음` });
  }
}

// 이 웨이브의 새 출처 중 이제 아무도 참조하지 않는 것은 지운다 — 기존 출처는 건드리지 않는다.
const wavePath = `sources/plate-${KEY}.json`;
let srcDrops = 0;
if (wavePath in files.sourceFiles) {
  const used = new Set<string>();
  for (const rows of Object.values(files.authorFiles)) for (const r of rows as Raw[]) for (const s of r.sourceIds ?? []) used.add(s);
  for (const rows of Object.values(files.workFiles)) for (const r of rows as Raw[]) { for (const s of r.sourceIds ?? []) used.add(s); if (r.world?.opening?.sourceId) used.add(r.world.opening.sourceId); }
  for (const rows of Object.values(files.relationFiles)) for (const r of rows as Raw[]) for (const s of r.sourceIds ?? []) used.add(s);
  const explicit = new Set(fixes.flatMap((f) => (Array.isArray(f.dropSources) ? f.dropSources.map(String) : [])));
  const arr = (files.sourceFiles as any)[wavePath] as Raw[];
  const kept = arr.filter((s) => used.has(s.id) && !explicit.has(s.id));
  srcDrops = arr.length - kept.length;
  (files.sourceFiles as any)[wavePath] = kept;
  // 명시적으로 지우라 한 출처를 아직 누가 참조하면 검증기가 잡는다 — 여기서 숨기지 않는다
}

console.log(`고침: 필드 ${fieldEdits} · 작품 의의 ${workEdits} · 관계 삭제 ${relDrops} · 출처 삭제 ${srcDrops} · 최초형 ${superlatives} · 건너뜀 ${skipped.length}`);
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
console.log(`  → 썼다 (${log.length} 변경)`);
