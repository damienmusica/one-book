// 판본 원장에 판정 원장 둘을 적용한다 — 승격을 다시 돌리지 않고.
//   qc/editions-excluded.json : 올리지 않는 ISBN (전자책·키링북·해설서·다른 책…)
//   qc/edition-fixes.json     : 목록이 틀리게 준 필드의 수리 (역자·연도·역할)
// promote-editions.ts 도 같은 두 원장을 읽는다 — 판정은 ISBN 에 붙어 있어 재승격에서도 되살아나지 않는다.
//
//   npx tsx scripts/apply-edition-ledgers.ts [--write]
import { readFileSync, writeFileSync } from "node:fs";
import { editionsFileSchema } from "../src/schema.js";
import { applyEditionFix, EDITION_FIXES, EXCLUDED_ISBNS } from "./lib/edition-ledgers.ts";

const write = process.argv.includes("--write");
const d = JSON.parse(readFileSync("data/editions.json", "utf8"));
let dropped = 0, fixed = 0;
for (const [workId, list] of Object.entries<Record<string, unknown>[]>(d.editions)) {
  const kept = list.filter((e) => !EXCLUDED_ISBNS.has(String(e.isbn13)));
  dropped += list.length - kept.length;
  for (const e of kept) if (EDITION_FIXES[String(e.isbn13)] && applyEditionFix(e)) fixed++;
  if (kept.length) d.editions[workId] = kept;
  else delete d.editions[workId];
}
const parsed = editionsFileSchema.safeParse(d);
if (!parsed.success) throw new Error("스키마가 거부했다 — 쓰지 않는다:\n" + parsed.error.message.slice(0, 800));
console.log(`제외 ${dropped} · 수리 ${fixed}${write ? "" : " (--write 없이 — 쓰지 않았다)"}`);
if (write) writeFileSync("data/editions.json", JSON.stringify(d, null, 2) + "\n");
