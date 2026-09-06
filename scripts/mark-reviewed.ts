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

type Raw = Record<string, any>;
const args = process.argv.slice(2);
const flag = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const WRITE = args.includes("--write");
const SETTLED = new Set(["corrected", "narrowed", "removed", "relation-dropped"]);

export function verdictFor(a: Raw, entry: Raw | undefined): { ok: boolean; why: string } {
  if ((a.depth ?? "plate") !== "plate") return { ok: false, why: `${a.depth} 는 검토 대상이 아니다` };
  if (!a.externalIds?.wikidata) return { ok: false, why: "QID 없음" };
  if (!entry) return { ok: false, why: "close-read 원장에 없음" };
  const open = (entry.claims ?? []).filter((c: Raw) => c.verdict !== "confirmed" && !SETTLED.has(c.resolution));
  if (open.length) {
    const pending = open.filter((c: Raw) => c.resolution === "pending").length;
    return { ok: false, why: `미결 주장 ${open.length}${pending ? ` (접근 대기 ${pending})` : ""}: ${open.slice(0, 2).map((c: Raw) => c.claim.slice(0, 40)).join(" / ")}` };
  }
  if (!(entry.claims ?? []).length) return { ok: false, why: "주장 0 — 읽은 것이 없다" };
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
    if (!r1.ok || r2.ok || noqid.ok) { console.error("프로브 실패 — 검사가 열린 도판을 검토됨으로 올린다"); process.exit(1); }
    return;
  }
  const ledgerPath = flag("--ledger"); if (!ledgerPath) throw new Error("--ledger <qc/closeread/x.json> 이 필요하다");
  const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
  const entries = new Map<string, Raw>((ledger.plates ?? []).map((p: Raw) => [p.id, p]));
  const only = flag("--ids") ? new Set(flag("--ids")!.split(",")) : undefined;
  const dir = join(process.cwd(), "data", "authors");
  const today = new Date().toISOString().slice(0, 10);
  let flipped = 0; const held: string[] = []; const touched = new Set<string>();
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const rows: Raw[] = JSON.parse(readFileSync(join(dir, f), "utf8"));
    for (const a of rows) {
      if (only ? !only.has(a.id) : !entries.has(a.id)) continue;
      if (a.reviewStatus !== "draft") continue;
      const v = verdictFor(a, entries.get(a.id));
      if (v.ok) { a.reviewStatus = "reviewed"; a.reviewedAt = today; flipped++; touched.add(f); console.log(`  ${a.id} → reviewed (${v.why})`); }
      else held.push(`${a.id}: ${v.why}`);
    }
    if (WRITE && touched.has(f)) writeFileSync(join(dir, f), JSON.stringify(rows, null, 2) + "\n");
  }
  console.log(`검토됨 ${flipped} · 보류 ${held.length}`);
  for (const h of held) console.log(`  - ${h}`);
  console.log(WRITE ? `  → 썼다 (${touched.size} 파일)` : "(--write 없이 실행 — 파일을 쓰지 않았다)");
}
main();
