import type { Author, GenreId, PeriodId, Relation, RelationType } from "../types.ts";

export type YearMode = "cumulative" | "active";

export interface Filters {
  periods: PeriodId[];
  genres: GenreId[];
  relationTypes: RelationType[];
  /** empty array = no restriction */
  regions: string[];
  languages: string[];
  movements: string[];
  speculativeOnly: boolean;
}

export const TIMELINE_MIN = 1850;
export const TIMELINE_MAX = 2026;

export function isAuthorVisible(
  a: Author,
  f: Filters,
  year: number,
  yearMode: YearMode
): boolean {
  if (!a.periods.some((p) => f.periods.includes(p))) return false;
  if (!a.genres.some((g) => f.genres.includes(g))) return false;
  if (f.speculativeOnly && a.speculative !== true) return false;
  if (f.regions.length > 0 && !a.regions.some((r) => f.regions.includes(r))) return false;
  if (f.languages.length > 0 && !a.languages.some((l) => f.languages.includes(l))) return false;
  if (f.movements.length > 0 && !a.movements.some((m) => f.movements.includes(m))) return false;
  const [from, to] = a.activeRange;
  if (year < TIMELINE_MAX) {
    if (yearMode === "cumulative") {
      if (from > year) return false;
    } else {
      if (from > year || to < year) return false;
    }
  }
  return true;
}

export function visibleAuthorIds(
  authors: Author[],
  f: Filters,
  year: number,
  yearMode: YearMode
): Set<string> {
  const out = new Set<string>();
  for (const a of authors) {
    if (isAuthorVisible(a, f, year, yearMode)) out.add(a.id);
  }
  return out;
}

export function isRelationVisible(r: Relation, f: Filters, visible: Set<string>): boolean {
  return (
    f.relationTypes.includes(r.type) && visible.has(r.sourceId) && visible.has(r.targetId)
  );
}

export function visibleRelations(
  relations: Relation[],
  f: Filters,
  visible: Set<string>
): Relation[] {
  return relations.filter((r) => isRelationVisible(r, f, visible));
}
