// Focus-mode mini card: after the first click on a star, the constellation
// stays on screen and this small card names it — the second step (full
// profile) is an explicit choice, so the planet view remains the reading
// surface (CPO interaction model).

import { useAppState, useContent, useServices, useT } from "./ctx.ts";
import { neighborsOf } from "../lib/graph.ts";
import { lifeSpan } from "./bits.tsx";

export function MiniCard() {
  const state = useAppState();
  const { store, dataset, adjacency, worksByAuthor, globeRef } = useServices();
  const t = useT();
  const content = useContent();
  const author =
    dataset.authors.find((a) => a.id === state.selectedAuthorId) ?? null;
  // the unified inspector owns the surface once a work is open (8th review)
  if (!author || state.panelOpen || state.selectedWorkId) return null;
  const relations = neighborsOf(adjacency, author.id).length;
  const works = worksByAuthor.get(author.id)?.length ?? 0;
  return (
    <aside className="mini-card" aria-label={content.authorName(author)}>
      <button
        type="button"
        className="icon-btn mini-card__close"
        aria-label={t.closeDetail}
        onClick={() => store.selectAuthor(null)}
      >
        ✕
      </button>
      <h3 className="mini-card__name">{content.authorName(author)}</h3>
      <p className="mini-card__meta">
        {lifeSpan(author, t)} · {t.miniStats(relations, works)}
      </p>
      <button
        type="button"
        className="mini-card__open"
        onClick={() => store.set({ panelOpen: true, filtersOpen: false })}
      >
        {t.openProfile} →
      </button>
      {/* the disclosed door into the realm — towns, roads, relief live at
          reading depth (8th review: no more unexplained manual zooming) */}
      <button
        type="button"
        className="mini-card__enter"
        title={t.enterTerritoryTitle}
        onClick={() => globeRef.current?.enterTerritory(author.id)}
      >
        {t.enterTerritory} ↓
      </button>
    </aside>
  );
}
