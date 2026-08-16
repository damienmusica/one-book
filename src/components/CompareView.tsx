import { useMemo } from "react";
import { useAppState, useContent, useServices, useT } from "./ctx.ts";
import { pathHops, shortestPath } from "../lib/graph.ts";
import { majorWorksOf } from "../lib/works.ts";
import type { Author } from "../types.ts";
import { languageLabel, regionLabel, relationTypeShort } from "../i18n/index.ts";
import { AuthorLink, DifficultyDots, EvidenceBadge, lifeSpan } from "./bits.tsx";

function CompareColumn({ author }: { author: Author }) {
  const { worksByAuthor, dataset } = useServices();
  const { locale } = useAppState();
  const t = useT();
  const content = useContent();
  const works = worksByAuthor.get(author.id) ?? [];
  const movementById = new Map(dataset.movements.map((m) => [m.id, m]));
  const entry = works.find((w) => w.id === author.readingEntry);
  return (
    <div className="compare-col">
      <h3>{content.authorName(author)}</h3>
      <p className="detail-original">{author.names.original}</p>
      <p className="detail-life">
        {lifeSpan(author, t)} · {author.regions.map((r) => regionLabel(r, locale)).join(", ")} ·{" "}
        {author.languages.map((c) => languageLabel(c, locale)).join(", ")}
      </p>
      <p className="detail-tags">
        {author.movements.map((m) => {
          const mv = movementById.get(m);
          return (
            <span key={m} className="chip chip--sm is-static">
              {mv ? content.movementName(mv) : m}
            </span>
          );
        })}
      </p>
      <h4>{t.whyImportant}</h4>
      <p>{content.authorField(author, "importanceReason")}</p>
      <h4>{t.entryWork}</h4>
      {entry && (
        <p>
          <strong>{content.workTitle(entry)}</strong>
          <span className="work-meta"> ({entry.year})</span> —{" "}
          {content.authorField(author, "readingEntryReason")}
        </p>
      )}
      <h4>{t.majorWorks}</h4>
      <ul className="work-list--compact">
        {majorWorksOf(author, works, 4).map((w) => (
          <li key={w.id}>
            {content.workTitle(w)} <span className="work-meta">({w.year})</span>
          </li>
        ))}
      </ul>
      <p className="difficulty-row">
        {t.difficultyShort} <DifficultyDots value={author.difficulty} />
      </p>
    </div>
  );
}

export function CompareView() {
  const state = useAppState();
  const { store, dataset, adjacency } = useServices();
  const t = useT();
  const content = useContent();
  const locale = state.locale;

  const a = dataset.authors.find((x) => x.id === state.selectedAuthorId);
  const b = dataset.authors.find((x) => x.id === state.compareAuthorId);

  const path = useMemo(() => {
    if (!a || !b) return null;
    return shortestPath(adjacency, a.id, b.id);
  }, [a, b, adjacency]);

  if (!a || !b) return null;

  const direct = dataset.relations.filter(
    (r) =>
      (r.sourceId === a.id && r.targetId === b.id) ||
      (r.sourceId === b.id && r.targetId === a.id)
  );

  // walk the path A → X → … → B; each hop keeps its relation's canonical
  // direction (Flaubert influenced Proust must read ←influence—, never
  // —influence→, even when the path walks Proust-first)
  const hops = path
    ? pathHops(path, a.id).map((h) => {
        const label = relationTypeShort(h.relation.type, locale);
        const connector =
          h.relation.direction === "bidirectional"
            ? `—${label}—`
            : h.along === "forward"
              ? `—${label}→`
              : `←${label}—`;
        return { ...h, connector };
      })
    : [];

  return (
    <div className="compare-view" role="dialog" aria-modal="true" aria-label={t.compareAria}>
      <div className="compare-head">
        <h2>{t.compareTitle(content.authorName(a), content.authorName(b))}</h2>
        <button
          type="button"
          className="icon-btn"
          aria-label={t.closeCompare}
          onClick={() => store.set({ compareAuthorId: null })}
        >
          ✕
        </button>
      </div>

      <div className="compare-grid">
        <CompareColumn author={a} />
        <CompareColumn author={b} />
      </div>

      <div className="compare-links">
        <h4>{t.directRelations}</h4>
        {direct.length > 0 ? (
          <ul>
            {direct.map((r) => (
              <li key={r.id} className="relation-item">
                <div className="relation-line">
                  <span>{relationTypeShort(r.type, locale)}</span>
                  <EvidenceBadge level={r.evidenceLevel} />
                </div>
                <p className="relation-summary">{content.relationSummary(r)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-note">{t.noDirectRelations}</p>
        )}

        <h4>{t.shortestPathHead}</h4>
        {hops.length > 0 ? (
          <p className="compare-path">
            {hops.map((h, i) => (
              <span key={i}>
                {i === 0 && <AuthorLink id={h.fromId} />}
                <span className="path-hop"> {h.connector} </span>
                <AuthorLink id={h.toId} />
              </span>
            ))}
          </p>
        ) : (
          <p className="empty-note">{t.noPath}</p>
        )}
      </div>
    </div>
  );
}
