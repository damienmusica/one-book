import { useMemo } from "react";
import { useAppState, useContent, useServices, useT } from "./ctx.ts";
import { GENRE_DEFS } from "../types.ts";
import { AuthorLink } from "./bits.tsx";

/**
 * The card a work town opens (2026-08-16 review P0-4: towns are
 * destinations, not decoration). Original title, year, genre, curated
 * reading position, editorial significance, and sources — the same evidence
 * discipline as relation cards. Opening it never yanks the camera; the
 * safe-area framing (7th review PR1) may shift the projection so the town
 * stays visible beside the card, and that shift is always cancellable.
 */
export function WorkCard() {
  const state = useAppState();
  const { store, dataset } = useServices();
  const t = useT();
  const content = useContent();

  const work = state.selectedWorkId
    ? dataset.works.find((w) => w.id === state.selectedWorkId)
    : undefined;
  const author = work ? dataset.authors.find((a) => a.id === work.authorId) : undefined;
  const sourceById = useMemo(
    () => new Map(dataset.sources.map((s) => [s.id, s])),
    [dataset.sources]
  );

  if (!work || !author) return null;

  const rank = author.readingOrder.indexOf(work.id);
  const genre = GENRE_DEFS.find((g) => g.id === work.genre);

  return (
    <div className="relation-dialog work-card" role="dialog" aria-modal="false" aria-label={t.workCardAria}>
      <div className="relation-dialog-head">
        <span className="relation-type">{genre ? (state.locale === "ko" ? genre.ko : genre.en) : work.genre}</span>
        <button
          type="button"
          className="icon-btn"
          aria-label={t.close}
          onClick={() => store.set({ selectedWorkId: null })}
        >
          ✕
        </button>
      </div>
      <p className="work-card-title">
        <strong>{content.workTitle(work)}</strong>
        <span className="work-meta">
          {" "}
          — {work.titleOriginal} · {work.year}
        </span>
      </p>
      <p className="work-card-order">
        {rank === 0 ? t.workEntryBadge : rank > 0 ? t.workOrder(rank + 1, author.readingOrder.length) : t.workOutsideOrder}
        {" · "}
        <AuthorLink id={author.id} />
      </p>
      <p className="relation-summary">{content.workSignificance(work)}</p>
      {work.sourceIds.length > 0 && (
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
      )}
    </div>
  );
}
