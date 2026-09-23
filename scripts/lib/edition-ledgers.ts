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
