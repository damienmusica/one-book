import { useMemo } from "react";
import { useAppState, useContent, useServices, useT } from "./ctx.ts";
import { neighborsOf } from "../lib/graph.ts";
import type { Relation, RelationType } from "../types.ts";
import { RELATION_DEFS } from "../types.ts";
import { languageLabel, regionLabel, relationTypeLabel } from "../i18n/index.ts";
import {
  AuthorLink,
  DifficultyDots,
  EvidenceBadge,
  ReviewBadge,
  lifeSpan
} from "./bits.tsx";

export function DetailPanel() {
  const state = useAppState();
  const services = useServices();
  const t = useT();
  const content = useContent();
  const { store, dataset, worksByAuthor, adjacency } = services;
  const locale = state.locale;

  const author = useMemo(
    () => dataset.authors.find((a) => a.id === state.selectedAuthorId) ?? null,
    [dataset, state.selectedAuthorId]
  );

  const works = author ? worksByAuthor.get(author.id) ?? [] : [];
  const workById = useMemo(() => new Map(works.map((w) => [w.id, w])), [works]);
  const neighbors = author ? neighborsOf(adjacency, author.id) : [];
  const sourceById = useMemo(
    () => new Map(dataset.sources.map((s) => [s.id, s])),
    [dataset.sources]
  );
  const movementById = useMemo(
    () => new Map(dataset.movements.map((m) => [m.id, m])),
    [dataset.movements]
  );

  if (!author) return null;

  const byType = new Map<RelationType, Array<{ otherId: string; relation: Relation }>>();
  for (const n of neighbors) {
    const list = byType.get(n.relation.type) ?? [];
    list.push(n);
    byType.set(n.relation.type, list);
  }

  const entryWork = workById.get(author.readingEntry);
  const name = content.authorName(author);
  const readingWarning = content.authorField(author, "readingWarning");
  const worksException = content.authorField(author, "worksException");

  return (
    <section className="detail-panel" aria-label={t.detailAria(name)}>
      <div className="detail-head">
        <div>
          <h2 className="detail-name">{name}</h2>
          <p className="detail-original">{content.authorAltNames(author).join(" · ")}</p>
          <p className="detail-life">
            {lifeSpan(author, t)} · {t.activeLabel} {author.activeRange[0]}–{author.activeRange[1]}{" "}
            · {author.regions.map((r) => regionLabel(r, locale)).join(", ")} ·{" "}
            {author.languages.map((c) => languageLabel(c, locale)).join(", ")}
          </p>
          <p className="detail-tags">
            {author.movements.map((m) => {
              const mv = movementById.get(m);
              return mv ? (
                <button
                  key={m}
                  type="button"
                  className="chip chip--sm"
                  title={content.movementDesc(mv)}
                  onClick={() => store.setFilters({ movements: [m] })}
                >
                  {content.movementName(mv)}
                </button>
              ) : null;
            })}
            {author.speculative && (
              <span className="chip chip--sm is-static">{t.speculativeChip}</span>
            )}
          </p>
        </div>
        <button
          type="button"
          className="icon-btn detail-close"
          aria-label={t.closeDetail}
          onClick={() => store.selectAuthor(null)}
        >
          ✕
        </button>
      </div>

      <div className="detail-body">
        <h3>{t.whyImportant}</h3>
        <p>{content.authorField(author, "importanceReason")}</p>

        <h3>{t.whereToStart}</h3>
        {entryWork && (
          <p className="entry-work">
            <strong>{content.workTitle(entryWork)}</strong>
            <span className="work-meta">
              {" "}
              ({entryWork.titleOriginal}, {entryWork.year})
            </span>
            <br />
            {content.authorField(author, "readingEntryReason")}
          </p>
        )}
        <ol className="reading-order">
          {author.readingOrder.map((wid) => {
            const w = workById.get(wid);
            return w ? (
              <li key={wid}>
                {content.workTitle(w)} <span className="work-meta">({w.year})</span>
              </li>
            ) : null;
          })}
        </ol>
        {readingWarning && (
          <p className="reading-warning" role="note">
            {readingWarning}
          </p>
        )}
        <p className="difficulty-row">
          {t.readingDifficulty} <DifficultyDots value={author.difficulty} />
          <span className="difficulty-reason">
            {content.authorField(author, "difficultyReason")}
          </span>
        </p>

        <h3>{t.majorWorks}</h3>
        <ul className="work-list">
          {works.map((w) => (
            <li key={w.id}>
              <strong>{content.workTitle(w)}</strong>
              <span className="work-meta">
                {" "}
                {w.titleOriginal} · {w.year}
              </span>
              <p>{content.workSignificance(w)}</p>
            </li>
          ))}
        </ul>
        {worksException && <p className="works-exception">{worksException}</p>}

        <h3>{t.relationsHead}</h3>
        {neighbors.length === 0 && <p className="empty-note">{t.noRelations}</p>}
        {RELATION_DEFS.filter((d) => byType.has(d.id)).map((def) => (
          <div key={def.id} className="relation-group">
            <h4>{relationTypeLabel(def.id, locale)}</h4>
            <ul>
              {(byType.get(def.id) ?? []).map(({ otherId, relation }) => (
                <li key={relation.id} className="relation-item">
                  <div className="relation-line">
                    {relation.direction === "directed" ? (
                      relation.sourceId === author.id ? (
                        <span className="rel-dir">{t.influencedArrow}</span>
                      ) : (
                        <span className="rel-dir">{t.influencedByArrow}</span>
                      )
                    ) : (
                      <span className="rel-dir">↔</span>
                    )}
                    <AuthorLink id={otherId} />
                    <EvidenceBadge level={relation.evidenceLevel} />
                  </div>
                  <p className="relation-summary">{content.relationSummary(relation)}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <h3>{t.sourcesHead}</h3>
        <ul className="source-list">
          {author.sourceIds.map((sid) => {
            const s = sourceById.get(sid);
            return s ? (
              <li key={sid}>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer noopener">
                    {s.title}
                  </a>
                ) : (
                  s.title
                )}
                <span className="work-meta"> — {s.publisherOrInstitution}</span>
              </li>
            ) : null;
          })}
        </ul>

        <p className="detail-review">
          <ReviewBadge author={author} />
        </p>

        <div className="detail-actions">
          <button
            type="button"
            onClick={() => store.set({ comparePicking: true, compareAuthorId: null })}
          >
            {t.compareOther}
          </button>
          <button
            type="button"
            onClick={() => services.globeRef.current?.focusAuthor(author.id)}
          >
            {t.centerOnMap}
          </button>
        </div>
      </div>
    </section>
  );
}
