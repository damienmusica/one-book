import { useMemo } from "react";
import { useAppState, useContent, useServices, useT } from "./ctx.ts";
import { GENRE_DEFS } from "../types.ts";
import type { Author, Work } from "../types.ts";

/**
 * The work depth of the unified inspector (8th review): author and work are
 * one surface, not competing cards. Opening a town drills the SAME panel
 * into the work; ← returns to the author profile with scroll restored; the
 * reading road's 이전/다음 walks the curated order without leaving the map.
 * Camera framing stays cancellable and never yanks (7th review PR1).
 */
export function WorkInspector({ work, author }: { work: Work; author: Author }) {
  const state = useAppState();
  const { store, dataset, globeRef } = useServices();
  const t = useT();
  const content = useContent();

  const sourceById = useMemo(
    () => new Map(dataset.sources.map((s) => [s.id, s])),
    [dataset.sources]
  );

  const order = author.readingOrder;
  const rank = order.indexOf(work.id);
  const genre = GENRE_DEFS.find((g) => g.id === work.genre);
  const prevId = rank > 0 ? order[rank - 1] : undefined;
  const nextId = rank >= 0 && rank < order.length - 1 ? order[rank + 1] : undefined;
  const workOf = (id: string | undefined) =>
    id ? dataset.works.find((w) => w.id === id) : undefined;
  const prevWork = workOf(prevId);
  const nextWork = workOf(nextId);

  const go = (id: string) => {
    store.set({ selectedWorkId: id, pickedRelationId: null });
  };

  return (
    <div className="work-inspector" data-qa="work-inspector">
      <div className="detail-head work-inspector__head">
        <button
          type="button"
          className="work-inspector__back"
          onClick={() => store.set({ selectedWorkId: null })}
        >
          ← {content.authorName(author)}
        </button>
        <button
          type="button"
          className="icon-btn detail-close"
          aria-label={t.close}
          onClick={() => store.set({ selectedWorkId: null, panelOpen: false })}
        >
          ✕
        </button>
      </div>
      <div className="detail-body">
        <p className="work-inspector__genre">
          {genre ? (state.locale === "ko" ? genre.ko : genre.en) : work.genre}
        </p>
        <h2 className="work-inspector__title">{content.workTitle(work)}</h2>
        <p className="work-inspector__original">
          {work.titleOriginal} · {work.year}
        </p>
        <p className="work-card-order">
          {rank === 0
            ? t.workEntryBadge
            : rank > 0
              ? t.workOrder(rank + 1, order.length)
              : t.workOutsideOrder}
        </p>
        <p className="relation-summary">{content.workSignificance(work)}</p>

        {/* the reading road, walkable: the same curated order the dashed
            route draws between towns */}
        {(prevWork || nextWork) && (
          <div className="work-inspector__road" role="navigation" aria-label={t.roadNavAria}>
            {prevWork && (
              <button type="button" className="chip chip--sm" onClick={() => go(prevWork.id)}>
                ← {content.workTitle(prevWork)}
              </button>
            )}
            {nextWork && (
              <button type="button" className="chip chip--sm" onClick={() => go(nextWork.id)}>
                {content.workTitle(nextWork)} →
              </button>
            )}
          </div>
        )}

        {work.sourceIds.length > 0 && (
          <>
            <h3>{t.sourcesHead}</h3>
            <ul className="source-list">
              {work.sourceIds.map((sid) => {
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
                    {s.citation && <span className="work-meta"> — {s.citation}</span>}
                  </li>
                ) : null;
              })}
            </ul>
          </>
        )}
        <div className="detail-actions">
          <button
            type="button"
            title={t.enterTerritoryTitle}
            onClick={() => globeRef.current?.enterTerritory(author.id)}
          >
            {t.enterTerritory} ↓
          </button>
        </div>
      </div>
    </div>
  );
}
