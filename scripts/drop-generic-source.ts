// 총칭 출처 하나를 코퍼스에서 걷어낸다 — 작가·작품·관계의 sourceIds 에서 빼고 레코드를 지운다.
// 어떤 도판의 마지막 프로필 출처이거나 어떤 관계의 유일한 출처이면 아무것도 쓰지 않는다(그건 걷어낼 수 있는 출처가 아니다).
//
//   npx tsx scripts/drop-generic-source.ts <source id> [--write]
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [sid] = process.argv.slice(2);
const write = process.argv.includes("--write");
if (!sid) throw new Error("usage: drop-generic-source <source id> [--write]");
type Raw = Record<string, any>;
const edits: [string, Raw[]][] = [];
const blockers: string[] = [];
let refs = 0;
for (const dir of ["authors", "works", "relations"]) {
  for (const f of readdirSync(join("data", dir)).filter((x) => x.endsWith(".json"))) {
    const rows: Raw[] = JSON.parse(readFileSync(join("data", dir, f), "utf8"));
    let touched = false;
    for (const r of rows) {
      if (!(r.sourceIds ?? []).includes(sid)) continue;
      const rest = r.sourceIds.filter((x: string) => x !== sid);
      if (dir === "authors" && (r.depth ?? "plate") === "plate" && !rest.length) blockers.push(`${r.id}: 마지막 프로필 출처`);
      if (dir === "relations" && !rest.length) blockers.push(`${r.id}: 관계의 유일한 출처`);
      r.sourceIds = rest; refs++; touched = true;
    }
    if (touched) edits.push([join("data", dir, f), rows]);
  }
}
let removedRecord = false;
for (const f of readdirSync(join("data", "sources")).filter((x) => x.endsWith(".json"))) {
  const rows: Raw[] = JSON.parse(readFileSync(join("data", "sources", f), "utf8"));
  const keep = rows.filter((r) => r.id !== sid);
  if (keep.length !== rows.length) { edits.push([join("data", "sources", f), keep]); removedRecord = true; }
}
console.log(`${sid}: 참조 ${refs} · 레코드 ${removedRecord ? "있음" : "없음"} · 막는 것 ${blockers.length}`);
for (const b of blockers) console.log(`  - ${b}`);
if (blockers.length) process.exit(1);
if (write) { for (const [f, rows] of edits) writeFileSync(f, JSON.stringify(rows, null, 2) + "\n"); console.log(`  → 썼다 (${edits.length} 파일)`); }
else console.log("(--write 없이 실행 — 파일을 쓰지 않았다)");
