import { useEffect, useRef, useState } from "react";
import { useAppState, useContent, useServices, useT } from "./ctx.ts";
import { createGlobe } from "../globe/renderer.ts";
import { geoPositions, semanticPositions } from "../data/load.ts";
import { loadTerritoryEras } from "../data/load-eras.ts";
import { buildContentAccess, LOCALES, UI, type ContentAccess, type Locale } from "../i18n/index.ts";
import { webglAvailable } from "../lib/webgl.ts";
import { FallbackExplorer } from "./FallbackExplorer.tsx";

interface ClusterPopover {
  ids: string[];
  x: number;
  y: number;
}

export function GlobeView() {
  const services = useServices();
  const state = useAppState();
  const t = useT();
  const content = useContent();
  const ref = useRef<HTMLDivElement>(null);
  // geo seal clusters expand into this member list (5th review P0-3)
  const [cluster, setCluster] = useState<ClusterPopover | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!webglAvailable || !el) return;
    const { dataset, store } = services;
    const sem = semanticPositions(dataset);
    const geo = geoPositions(dataset);
    // dev fallback before the layout freeze exists: geography stands in
    const semOrGeo = sem.size > 0 ? sem : geo;
    const contentByLocale = new Map<Locale, ContentAccess>(
      LOCALES.map((l) => [l.id, buildContentAccess(dataset, l.id)])
    );
    const handle = createGlobe(
      el,
      dataset,
      semOrGeo,
      geo,
      store,
      {
        onSelect: (id) => store.selectAuthor(id),
        onHover: (id) => store.set({ hoveredAuthorId: id }),
        onRelationPick: (rel) => store.set({ pickedRelationId: rel.id }),
        onRelationHover: (rel) => store.set({ hoveredRelationId: rel?.id ?? null }),
        // town → work card; the relation dialog yields (one card at a time)
        onWorkPick: (wk) => store.set({ selectedWorkId: wk.id, pickedRelationId: null }),
        onWorkHover: (wk) => store.set({ hoveredWorkId: wk?.id ?? null }),
        onClusterPick: (ids, at) => setCluster({ ids, x: at.x, y: at.y })
      },
      {
        authorLabel: (a, locale) =>
          (contentByLocale.get(locale) ?? contentByLocale.get("ko"))!.authorName(a),
        movementLabel: (m, locale) =>
          (contentByLocale.get(locale) ?? contentByLocale.get("ko"))!.movementName(m),
        workLabel: (wk, locale) =>
          (contentByLocale.get(locale) ?? contentByLocale.get("ko"))!.workTitle(wk),
        workAria: (wk, locale) =>
          UI[locale].workOpenAria(
            (contentByLocale.get(locale) ?? contentByLocale.get("ko"))!.workTitle(wk)
          ),
        clusterMore: (n, locale) => UI[locale].clusterMore(n),
        clusterAria: (name, n, locale) => UI[locale].clusterAria(name, n)
      }
    );
    services.globeRef.current = handle;
    // the tectonic keyframes arrive as their own chunk; a failed load throws
    // loudly (data bug) — the atlas view works without them
    void loadTerritoryEras().then((eras) => handle.provideEras(eras));
    return () => {
      services.globeRef.current = null;
      handle.dispose();
    };
  }, [services]);

  // popover lifecycle: focus on open, close on Escape
  useEffect(() => {
    if (!cluster) return;
    popoverRef.current?.querySelector("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCluster(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cluster]);

  if (!webglAvailable) return <FallbackExplorer />;

  const authorsById = new Map(services.dataset.authors.map((a) => [a.id, a]));
  const width = ref.current?.clientWidth ?? 0;
  const popLeft = cluster ? Math.min(Math.max(8, cluster.x - 90), Math.max(8, width - 196)) : 0;

  return (
    <div className="globe-container" ref={ref} role="application" aria-label={t.globeAria}>
      {cluster && (
        <div
          className="cluster-popover"
          ref={popoverRef}
          role="dialog"
          aria-label={t.clusterListAria}
          data-qa="cluster-popover"
          style={{ left: popLeft, top: Math.max(8, cluster.y - 8) }}
        >
          <div className="cluster-popover-head">
            <span>{t.clusterListAria}</span>
            <button
              type="button"
              className="icon-btn"
              aria-label={t.close}
              onClick={() => setCluster(null)}
            >
              ✕
            </button>
          </div>
          <ul>
            {cluster.ids.map((id) => {
              const a = authorsById.get(id);
              if (!a) return null;
              return (
                <li key={id}>
                  <button
                    type="button"
                    data-author-id={id}
                    className={id === state.selectedAuthorId ? "is-current" : undefined}
                    onClick={() => {
                      services.store.selectAuthor(id);
                      services.globeRef.current?.focusAuthor(id);
                      setCluster(null);
                    }}
                  >
                    {content.authorName(a)}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
