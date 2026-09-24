// 판본 판정 원장 — 제외와 필드 수리. 승격 도구와 적용 도구가 같은 것을 읽는다.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const read = (f: string) => (existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {});
export const EXCLUDED_ISBNS = new Set<string>(Object.keys(read(join("qc", "editions-excluded.json")).excluded ?? {}));
export const EDITION_FIXES: Record<string, { translator?: string | null; year?: number; note?: string }> =
  read(join("qc", "edition-fixes.json")).byIsbn ?? {};

/** 수리를 적용한다. 바뀐 것이 있으면 true. null 은 필드를 지운다. */
export function applyEditionFix(e: Record<string, unknown>): boolean {
  const f = EDITION_FIXES[String(e.isbn13)];
  if (!f) return false;
  let changed = false;
  for (const k of ["translator", "year", "note"] as const) {
    if (!(k in f)) continue;
    const v = f[k];
    if (v === null) { if (k in e) { delete e[k]; changed = true; } }
    else if (e[k] !== v) { e[k] = v; changed = true; }
  }
  return changed;
}

// 저본 판정 원장 — 판정을 바꾸고, null 이면 지운다(국중 기록이 기존 「중역」과 어긋나 가리지 못한 판: 『들오리』).
// promote-editions 의 --basis 는 빈 칸만 채우므로, 이미 붙은 판정을 고치거나 지우는 길은 여기다.
export const EDITION_BASIS: Record<string, { sourceTextBasis: string | null; note?: string; attested?: boolean }> =
  read(join("qc", "edition-basis.json")).byIsbn ?? {};
export function applyBasis(e: Record<string, unknown>): boolean {
  const b = EDITION_BASIS[String(e.isbn13)];
  if (!b || !("sourceTextBasis" in b)) return false;
  let changed = false;
  if (b.sourceTextBasis === null) { if ("sourceTextBasis" in e) { delete e.sourceTextBasis; changed = true; } }
  else if (e.sourceTextBasis !== b.sourceTextBasis) { e.sourceTextBasis = b.sourceTextBasis; changed = true; }
  if (b.note && e.note !== b.note && (changed || b.sourceTextBasis === null)) { e.note = b.note; changed = true; }
  return changed;
}
