import { useEffect } from "react";
import { useAppState, useServices, useT } from "./ctx.ts";
import { Header } from "./Header.tsx";
import { GlobeView } from "./GlobeView.tsx";
import { FilterPanel } from "./FilterPanel.tsx";
import { DetailPanel } from "./DetailPanel.tsx";
import { TimelineBar } from "./TimelineBar.tsx";
import { TourOverlay } from "./TourOverlay.tsx";
import { CompareView } from "./CompareView.tsx";
import { RelationDialog } from "./RelationDialog.tsx";
import { WritersPage } from "./WritersPage.tsx";
import { MethodologyPage } from "./MethodologyPage.tsx";

export function App() {
  const state = useAppState();
  const { store } = useServices();
  const t = useT();

  useEffect(() => {
    // wide screens start with the exploration panel open
    if (window.innerWidth >= 1200) store.set({ filtersOpen: true });
  }, [store]);

  useEffect(() => {
    document.documentElement.lang = state.locale;
    document.title =
      state.locale === "ko"
        ? "문학의 행성 — 20세기 세계문학 지도"
        : "Literary Planet — a map of 20th-century world literature";
  }, [state.locale]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const s = store.getState();
      if (s.pickedRelationId) store.set({ pickedRelationId: null });
      else if (s.compareAuthorId) store.set({ compareAuthorId: null });
      else if (s.comparePicking) store.set({ comparePicking: false });
      else if (s.tourId) store.endTour();
      else if (s.selectedAuthorId) store.selectAuthor(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store]);

  return (
    <div className="app">
      <a className="skip-link" href="#/writers">
        {t.skipLink}
      </a>
      <Header />
      {state.page === "globe" && (
        <main className="globe-page">
          <GlobeView />
          <FilterPanel />
          <DetailPanel />
          <TimelineBar />
          {state.tourId && <TourOverlay />}
          {state.comparePicking && (
            <div className="compare-hint" role="status">
              {t.compareHint}{" "}
              <button type="button" onClick={() => store.set({ comparePicking: false })}>
                {t.cancel}
              </button>
            </div>
          )}
          {state.compareAuthorId && state.selectedAuthorId && <CompareView />}
          {state.pickedRelationId && <RelationDialog />}
        </main>
      )}
      {state.page === "writers" && <WritersPage />}
      {state.page === "methodology" && <MethodologyPage />}
    </div>
  );
}
