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
import { PortraitPlate } from "./PortraitPlate.tsx";
import { GHOST, lifecycleEngaged, lifecycleOf } from "../globe/lifecycle.ts";

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

  if (!author || !state.panelOpen) return null;

  const byType = new Map<RelationType, Array<{ otherId: string; relation: Relation }>>();
  for (const n of neighbors) {
    const list = byType.get(n.relation.type) ?? [];
    list.push(n);
    byType.set(n.relation.type, list);
  }

  const entryWork = workById.get(author.readingEntry);
  const name = content.authorName(author);
  // era-filter vs selection conflict (5th review P1-2): while the fader is
  // engaged, say what state this nation is in at that year — the card keeps
  // working, the badge explains the ghosted territory behind it
  const eraBadge = (() => {
    if (!lifecycleEngaged(state.year, state.yearMode)) return null;
    const lc = lifecycleOf(author, state.year, state.yearMode);
    if (state.yearMode === "active" && lc.presence <= GHOST + 0.02) return t.eraBadgeInactive;
    if (lc.presence <= GHOST + 0.02) return t.eraBadgeUnformed;
    if (lc.presence < 0.98) return t.eraBadgeForming;
    if (lc.patina > 0.4) return t.eraBadgeHeritage;
    return null;
  })();
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
          {eraBadge && (
            <p className="detail-era-badge" title={t.eraBadgeTitle} data-qa="era-badge">
              {state.year} · {eraBadge}
            </p>
          )}
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
        <PortraitPlate author={author} />

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

        <h3>{t.worksHead}</h3>
        <ul className="work-list">
          {works.map((w) => (
            <li key={w.id}>
              {/* same card the map towns open — a keyboard path that works
                  in the 2D fallback too */}
              <button
                type="button"
                className="work-open"
                aria-label={t.workOpenAria(content.workTitle(w))}
                onClick={() => store.set({ selectedWorkId: w.id, pickedRelationId: null })}
              >
                <strong>{content.workTitle(w)}</strong>
              </button>
              <span className="work-meta">
                {" "}
                {w.titleOriginal} · {w.year}
              </span>
              <p>{content.workSignificance(w)}</p>
            </li>
          ))}
        </ul>
        {worksException && <p className="works-exception">{worksException}</p>}

        <h3>
          {t.relationsHead}
          {!state.reducedMotion && neighbors.length > 0 && (
            <button
              type="button"
              className="chip chip--sm chip--replay"
              title={t.replayFlowsTitle}
              onClick={() => store.set({ flowReplayToken: state.flowReplayToken + 1 })}
            >
              {t.replayFlows}
            </button>
          )}
        </h3>
        {state.egoHiddenCount > 0 && (
          <p className="relation-cap-note">
            {t.mapRelationsCapped(neighbors.length - state.egoHiddenCount, neighbors.length)}{" "}
            <button
              type="button"
              className="chip chip--sm"
              onClick={() => store.set({ egoExpanded: true })}
            >
              {t.showAllRelations}
            </button>
          </p>
        )}
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
