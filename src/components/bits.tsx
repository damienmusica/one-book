import type { Author, EvidenceLevel, RelationType } from "../types.ts";
import {
  EVIDENCE_LEVEL_KO,
  LANGUAGE_LABELS,
  REGION_DEFS,
  RELATION_DEFS,
  REVIEW_STATUS_KO
} from "../types.ts";
import { focusAuthor, useServices } from "./ctx.ts";

const regionKo = new Map(REGION_DEFS.map((r) => [r.id, r.ko]));
export function regionLabel(id: string): string {
  return regionKo.get(id) ?? id;
}

export function languageLabel(code: string): string {
  return LANGUAGE_LABELS[code] ?? code;
}

const relationDef = new Map(RELATION_DEFS.map((r) => [r.id, r]));
export function relationLabel(type: RelationType): string {
  return relationDef.get(type)?.ko ?? type;
}
export function relationShort(type: RelationType): string {
  return relationDef.get(type)?.short ?? type;
}

export function EvidenceBadge({ level }: { level: EvidenceLevel }) {
  return (
    <span className={`evidence-badge evidence--${level}`}>{EVIDENCE_LEVEL_KO[level]}</span>
  );
}

export function ReviewBadge({ author }: { author: Author }) {
  return (
    <span className={`review-badge review--${author.reviewStatus}`}>
      {REVIEW_STATUS_KO[author.reviewStatus]}
      {author.reviewedAt ? ` · ${author.reviewedAt}` : ""}
    </span>
  );
}

export function DifficultyDots({ value }: { value: number }) {
  return (
    <span className="difficulty-dots" aria-label={`독서 난도 5점 중 ${value}점`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= value ? "dot is-on" : "dot"} aria-hidden="true" />
      ))}
    </span>
  );
}

export function AuthorLink({ id, children }: { id: string; children?: React.ReactNode }) {
  const services = useServices();
  const author = services.dataset.authors.find((a) => a.id === id);
  if (!author) return null;
  return (
    <button type="button" className="author-link" onClick={() => focusAuthor(services, id)}>
      {children ?? author.names.ko}
    </button>
  );
}

export function lifeSpan(a: Author): string {
  const b = a.birthYear !== undefined ? String(a.birthYear) : "?";
  const d = a.deathYear !== undefined ? String(a.deathYear) : "";
  return a.deathYear !== undefined ? `${b}–${d}` : `${b}년생`;
}
