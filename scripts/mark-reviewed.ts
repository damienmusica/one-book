// Flip plates from draft to reviewed — only when the close-read ledger says every claim is settled.
//
//   npx tsx scripts/mark-reviewed.ts --ledger qc/closeread/<batch>.json [--ids a,b] [--write]
//
// A plate is reviewable when: it is a plate, it has a Wikidata QID, the ledger has an entry for it, and every
// claim in that entry is either confirmed or carries a resolution (corrected · narrowed · removed ·
// relation-dropped). A single "pending" claim keeps the plate draft — pending means a source exists that
// nobody here could read, and a page is not reviewed until someone has read it. Nothing is rewritten here;
// this script only changes reviewStatus/reviewedAt, and the assembler still has the last word.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { isOpen, uncoveredOf } from "./lib/closeread.ts";
import { drawnFor } from "./lib/drawn.ts";
import { loadRawCollections } from "./lib/load-node.ts";
import { assembleDataset } from "../src/data/assemble.ts";

type Raw = Record<string, any>;
const args = process.argv.slice(2);
const flag = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const WRITE = args.includes("--write");
// --demote: 원장이 받치지 못하는 「검토됨」을 draft 로 내린다(--ids 로 대상을 좁혀 쓴다).
const DEMOTE = args.includes("--demote");


// uncovered: 이 도판의 쪽에 그려진 문장 중 원장이 덮지 않은 것(scripts/lib/closeread.ts uncoveredOf). 하나라도 있으면 검토가 아니다 —
// 「쪽의 사실 주장을 하나씩 떼어 출처에 대봤다」는 정의는 문장 단위로만 기계가 잴 수 있다(2026-09-24 감사).
export function verdictFor(a: Raw, entry: Raw | undefined, uncovered: Array<{ text: string; why: string }> = []): { ok: boolean; why: string } {
  if ((a.depth ?? "plate") !== "plate") return { ok: false, why: `${a.depth} 는 검토 대상이 아니다` };
  if (!a.externalIds?.wikidata) return { ok: false, why: "QID 없음" };
  if (!entry) return { ok: false, why: "close-read 원장에 없음" };
  const open = (entry.claims ?? []).filter(isOpen);
  if (open.length) {
    const pending = open.filter((c: Raw) => c.resolution === "pending").length;
    return { ok: false, why: `미결 주장 ${open.length}${pending ? ` (접근 대기 ${pending})` : ""}: ${open.slice(0, 2).map((c: Raw) => c.claim.slice(0, 40)).join(" / ")}` };
  }
  if (!(entry.claims ?? []).length) return { ok: false, why: "주장 0 — 읽은 것이 없다" };
  if (uncovered.length) return { ok: false, why: `덮이지 않은 문장 ${uncovered.length}: ${uncovered.slice(0, 2).map((u) => `${u.text.slice(0, 30)}(${u.why})`).join(" / ")}` };
  return { ok: true, why: `주장 ${entry.claims.length} 전부 확정` };
}

function main() {
  if (args.includes("--probe")) {
    const a = { id: "p", depth: "plate", externalIds: { wikidata: "Q1" } };
    const settled = { claims: [{ verdict: "confirmed" }, { verdict: "contradicted", resolution: "corrected" }] };
    const pending = { claims: [{ verdict: "confirmed" }, { verdict: "unverifiable", resolution: "pending", claim: "x" }] };
    const noqid = verdictFor({ id: "p", depth: "plate" }, settled);
    const r1 = verdictFor(a, settled), r2 = verdictFor(a, pending);
    console.log(`probe settled → ${r1.ok} | pending → ${r2.ok} (${r2.why}) | no QID → ${noqid.ok} (${noqid.why})`);
    const leak = verdictFor(a, { claims: [{ verdict: "confirmed", claim: "y", note: "다만 전칭은 확인되지 않았다" }] });
    const leakSettled = verdictFor(a, { claims: [{ verdict: "confirmed", claim: "y", note: "다만 전칭은 확인되지 않았다", resolution: "narrowed" }] });
    console.log(`probe leak → ${leak.ok} | leak settled → ${leakSettled.ok}`);
    const bare = verdictFor(a, settled, [{ text: "원장에 없는 문장", why: "원장에 없는 문장" }]);
    console.log(`probe uncovered → ${bare.ok} (${bare.why})`);
    if (!r1.ok || r2.ok || noqid.ok || leak.ok || !leakSettled.ok || bare.ok) { console.error("프로브 실패 — 검사가 열린 도판을 검토됨으로 올린다"); process.exit(1); }
    return;
  }
  const ledgerPath = flag("--ledger"); if (!ledgerPath) throw new Error("--ledger <qc/closeread/x.json[,y.json]> 이 필요하다");
  // 원장은 여럿일 수 있다(웨이브 1 · 재심). 같은 도판이 둘에 있으면 뒤의 것(나중에 읽은 것)이 이긴다.
  const entries = new Map<string, Raw>();
  const allPlates: Raw[] = [];
  for (const lp of ledgerPath.split(",")) for (const p of JSON.parse(readFileSync(lp, "utf8")).plates ?? []) { entries.set(p.id, p); allPlates.push(p); }
  const { dataset } = assembleDataset(loadRawCollections());
  if (!dataset) throw new Error("코퍼스가 조립되지 않는다 — 먼저 validate:data");
  const nameOf = (id: string) => dataset.authors.find((b) => b.id === id)?.names.ko ?? id;
  const uncoveredFor = (id: string) => {
    const au = dataset.authors.find((b) => b.id === id);
    if (!au) return [];
    const drawn = drawnFor(au, dataset.works.filter((w) => w.authorId === id), dataset.relations.filter((r) => r.sourceId === id || r.targetId === id), nameOf);
    return uncoveredOf(drawn, allPlates);
  };
  const only = flag("--ids") ? new Set(flag("--ids")!.split(",")) : undefined;
  const dir = join(process.cwd(), "data", "authors");
  const today = new Date().toISOString().slice(0, 10);
  let flipped = 0, demoted = 0, reaffirmed = 0; const held: string[] = []; const touched = new Set<string>();
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const rows: Raw[] = JSON.parse(readFileSync(join(dir, f), "utf8"));
    for (const a of rows) {
      if (only ? !only.has(a.id) : !(entries.has(a.id) || (DEMOTE && a.reviewStatus !== "draft"))) continue;
      const v = verdictFor(a, entries.get(a.id), uncoveredFor(a.id));
      if (a.reviewStatus === "draft") {
        if (v.ok) { a.reviewStatus = "reviewed"; a.reviewedAt = today; flipped++; touched.add(f); console.log(`  ${a.id} → reviewed (${v.why})`); }
        else held.push(`${a.id}: ${v.why}`);
      } else if (DEMOTE && v.ok) {
        // 다시 확인한 것은 날짜를 바꾸지 않는다 — reviewedAt 은 「언제 검토됐는가」다. 돌릴 때마다 오늘로 바꾸면 그 뜻이 사라진다.
        reaffirmed++;
      } else if (DEMOTE && !v.ok) {
        // 이미 「검토됨」인데 원장이 그것을 받치지 못한다 — 내린다. 정의가 바뀌었을 때 옛 기준으로 올라간 쪽을 정의에 맞추는 길.
        a.reviewStatus = "draft"; delete a.reviewedAt; demoted++; touched.add(f); console.log(`  ${a.id} → draft (${v.why})`);
      }
    }
    if (WRITE && touched.has(f)) writeFileSync(join(dir, f), JSON.stringify(rows, null, 2) + "\n");
  }
  console.log(`검토됨 ${flipped} · 보류 ${held.length}${DEMOTE ? ` · 내림 ${demoted} · 재확인 ${reaffirmed}` : ""}`);
  for (const h of held) console.log(`  - ${h}`);
  console.log(WRITE ? `  → 썼다 (${touched.size} 파일)` : "(--write 없이 실행 — 파일을 쓰지 않았다)");
}
main();
