import { Suspense, lazy, useEffect } from "react";
import { useAppState, useServices, useT } from "./ctx.ts";
import { pageHref } from "../state/url.ts";
import { Header } from "./Header.tsx";
import { GlobeView } from "./GlobeView.tsx";
import { FilterPanel } from "./FilterPanel.tsx";
import { DetailPanel } from "./DetailPanel.tsx";
import { TimelineBar } from "./TimelineBar.tsx";
import { TourOverlay } from "./TourOverlay.tsx";
import { CompareView } from "./CompareView.tsx";
import { RelationDialog } from "./RelationDialog.tsx";
import { WorkCard } from "./WorkCard.tsx";
import { WritersPage } from "./WritersPage.tsx";
import { MethodologyPage } from "./MethodologyPage.tsx";
import { MiniCard } from "./MiniCard.tsx";
import { GlobeHint } from "./GlobeHint.tsx";
import { LegendPanel } from "./LegendPanel.tsx";
import { DebugOverlay } from "./DebugOverlay.tsx";
import { instr } from "../lib/instrument.ts";

// dev-only review catalogs (?seals, ?portraits): the literal false branch
// lets production builds drop these chunks entirely
const SealCatalog = import.meta.env.DEV ? lazy(() => import("./SealCatalog.tsx")) : null;
const PortraitCatalog = import.meta.env.DEV ? lazy(() => import("./PortraitCatalog.tsx")) : null;

export function App() {
  const state = useAppState();
  const { store } = useServices();
  const t = useT();

  // the planet is the first impression — the exploration drawer no longer
  // auto-opens on wide screens (2026-08-16 review: panels were crowding the
  // canvas into a background object)

  useEffect(() => {
    document.documentElement.lang = state.locale;
    document.title =
      state.locale === "ko"
        ? "문학의 행성 — 20세기 세계문학 지도"
        : "Literary Planet — a map of 20th-century world literature";
  }, [state.locale]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // maintainer/QA metrics panel — not part of the reading surface
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        instr.toggleOverlay();
        return;
      }
      if (e.key !== "Escape") return;
      const s = store.getState();
      if (s.selectedWorkId) store.set({ selectedWorkId: null });
      else if (s.pickedRelationId) store.set({ pickedRelationId: null });
      else if (s.compareAuthorId) store.set({ compareAuthorId: null });
      else if (s.comparePicking) store.set({ comparePicking: false });
      else if (s.tourId) store.endTour();
      else if (s.panelOpen) store.set({ panelOpen: false }); // back to the constellation
      else if (s.selectedAuthorId) store.selectAuthor(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store]);

  if (SealCatalog && new URLSearchParams(window.location.search).has("seals")) {
    return (
      <Suspense fallback={null}>
        <SealCatalog />
      </Suspense>
    );
  }
  if (PortraitCatalog && new URLSearchParams(window.location.search).has("portraits")) {
    return (
      <Suspense fallback={null}>
        <PortraitCatalog />
      </Suspense>
    );
  }

  return (
    <div className="app">
      <a className="skip-link" href={pageHref(state, "writers")}>
        {t.skipLink}
      </a>
      <Header />
      {state.page === "globe" && (
        <main className="globe-page">
          <GlobeView />
          <FilterPanel />
          <DetailPanel />
          <MiniCard />
          <GlobeHint />
          <LegendPanel />
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
          {state.selectedWorkId && <WorkCard />}
        </main>
      )}
      {state.page === "writers" && <WritersPage />}
      {state.page === "methodology" && <MethodologyPage />}
      <DebugOverlay />
    </div>
  );
}
