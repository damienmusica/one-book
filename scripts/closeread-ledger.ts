// Build (or extend) a close-read ledger: every claim on a plate, its verdict, its evidence, and — once a fix
// pass has run — how each unconfirmed claim was settled.
//
//   npx tsx scripts/closeread-ledger.ts --out qc/closeread/<batch>.json --verdicts v1.json [v2.json ...] [--fixes f1.json ...]
//
// Verdict files are the close-read output {plates:[{id, claims:[{field, claim, verdict, url?, quote?, correction?, note?}]}]}.
// Fix files are the fixer output {fixes:[{id, ..., resolutions:[{field, claim, resolution, pendingWhere?}]}]}; resolutions are
// matched to the plate's unconfirmed claims in order, falling back to field+claim equality. The ledger is what
// `mark-reviewed.ts` reads, and what a person samples when auditing the machine (decision 34).
import { readFileSync, writeFileSync, existsSync } from "node:fs";

type Raw = Record<string, any>;
const args = process.argv.slice(2);
const list = (k: string) => { const i = args.indexOf(k); if (i < 0) return []; const out: string[] = []; for (let j = i + 1; j < args.length && !args[j]!.startsWith("--"); j++) out.push(args[j]!); return out; };
const out = list("--out")[0]; if (!out) throw new Error("--out 이 필요하다");

const ledger: Raw = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : { batch: out.replace(/.*\//, "").replace(/\.json$/, ""), plates: [] };
const byId = new Map<string, Raw>(ledger.plates.map((p: Raw) => [p.id, p]));

for (const f of list("--verdicts")) {
  for (const p of JSON.parse(readFileSync(f, "utf8")).plates ?? []) {
    byId.set(p.id, { id: p.id, readAt: new Date().toISOString().slice(0, 10), claims: (p.claims ?? []).map((c: Raw) => ({ ...c })) });
  }
}
let settled = 0, unmatched = 0;
for (const f of list("--fixes")) {
  for (const fx of JSON.parse(readFileSync(f, "utf8")).fixes ?? []) {
    const p = byId.get(fx.id); if (!p) { unmatched++; continue; }
    const open = p.claims.filter((c: Raw) => c.verdict !== "confirmed");
    (fx.resolutions ?? []).forEach((r: Raw, i: number) => {
      const target = open.find((c: Raw) => c.field === r.field && c.claim === r.claim) ?? open[i];
      if (!target) { unmatched++; return; }
      target.resolution = r.resolution; if (r.pendingWhere) target.pendingWhere = r.pendingWhere; settled++;
    });
  }
}
ledger.plates = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
ledger.updatedAt = new Date().toISOString().slice(0, 10);
const T = { plates: ledger.plates.length, claims: 0, confirmed: 0, contradicted: 0, unverifiable: 0, pending: 0, open: 0 };
for (const p of ledger.plates) for (const c of p.claims) {
  T.claims++; (T as any)[c.verdict]++;
  if (c.verdict !== "confirmed") { if (c.resolution === "pending") T.pending++; else if (!c.resolution) T.open++; }
}
ledger.totals = T;
writeFileSync(out, JSON.stringify(ledger, null, 2) + "\n");
console.log(`원장 ${out}: 도판 ${T.plates} · 주장 ${T.claims} · 확정 ${T.confirmed} · 반박 ${T.contradicted} · 미확인 ${T.unverifiable} · 접근 대기 ${T.pending} · 미결 ${T.open} (해결 기록 ${settled}, 짝 못 찾음 ${unmatched})`);
