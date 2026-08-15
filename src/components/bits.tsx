import type { Author, EvidenceLevel } from "../types.ts";
import { evidenceLabel, reviewLabel, type UIStrings } from "../i18n/index.ts";
import { focusAuthor, useAppState, useContent, useServices, useT } from "./ctx.ts";

export function EvidenceBadge({ level }: { level: EvidenceLevel }) {
  const { locale } = useAppState();
  return (
    <span className={`evidence-badge evidence--${level}`}>{evidenceLabel(level, locale)}</span>
  );
}

export function ReviewBadge({ author }: { author: Author }) {
  const { locale } = useAppState();
  return (
    <span className={`review-badge review--${author.reviewStatus}`}>
      {reviewLabel(author.reviewStatus, locale)}
      {author.reviewedAt ? ` · ${author.reviewedAt}` : ""}
    </span>
  );
}

export function DifficultyDots({ value }: { value: number }) {
  const t = useT();
  return (
    <span className="difficulty-dots" aria-label={t.difficultyAria(value)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= value ? "dot is-on" : "dot"} aria-hidden="true" />
      ))}
    </span>
  );
}

export function AuthorLink({ id, children }: { id: string; children?: React.ReactNode }) {
  const services = useServices();
  const content = useContent();
  const author = services.dataset.authors.find((a) => a.id === id);
  if (!author) return null;
  return (
    <button type="button" className="author-link" onClick={() => focusAuthor(services, id)}>
      {children ?? content.authorName(author)}
    </button>
  );
}

export function lifeSpan(a: Author, t: UIStrings): string {
  const b = a.birthYear !== undefined ? String(a.birthYear) : "?";
  return a.deathYear !== undefined ? `${b}–${a.deathYear}` : t.bornSuffix(a.birthYear ?? 0);
}
