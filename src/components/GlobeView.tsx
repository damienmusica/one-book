import { useEffect, useRef, useState } from "react";
import { useAppState, useContent, useServices, useT } from "./ctx.ts";
import { createGlobe } from "../globe/renderer.ts";
import { geoPositions, semanticPositions } from "../data/load.ts";
import {
  buildContentAccess,
  LOCALES,
  regionLabel,
  UI,
  type ContentAccess,
  type Locale
} from "../i18n/index.ts";
import { TIMELINE_MAX } from "../lib/filter.ts";
import { webglAvailable } from "../lib/webgl.ts";
import { FallbackExplorer } from "./FallbackExplorer.tsx";

interface ClusterPopover {
  ids: string[];
  x: number;
  y: number;
  /** the "+N" chip's label id — focus returns here on close (PR5 a11y) */
  chipId: string;
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
        // click → contact (renderer) → cancellable 450–650ms focus flight —
        // the 7th review's loop step 3; a map click centers its author just
        // like the search path always did
        onSelect: (id) => {
          store.selectAuthor(id);
          if (id) services.globeRef.current?.focusAuthor(id);
        },
        onHover: (id) => store.set({ hoveredAuthorId: id }),
        onRelationPick: (rel) => store.set({ pickedRelationId: rel.id }),
        onRelationHover: (rel) => store.set({ hoveredRelationId: rel?.id ?? null }),
        // town → work card; the relation dialog yields (one card at a time)
        onWorkPick: (wk) => store.set({ selectedWorkId: wk.id, pickedRelationId: null }),
        onWorkHover: (wk) => store.set({ hoveredWorkId: wk?.id ?? null }),
        onClusterPick: (ids, at, repId) => setCluster({ ids, x: at.x, y: at.y, chipId: repId })
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
    // PR2 true demand loading: NOTHING era-related is requested here. A
    // y=/active-mode deep link is explicit timeline intent, though — pre-warm
    // so the linked year commits as fast as the worker can paint it.
    const s = store.getState();
    if (s.year < TIMELINE_MAX || s.yearMode === "active") handle.timelineIntent();
    return () => {
      services.globeRef.current = null;
      handle.dispose();
    };
  }, [services]);

  // safe-area framing (7th review PR1): measure how much viewport the open
  // panels cover and hand the insets to the camera — the selection must land
  // in the uncovered map, not under the panel. rAF lets the panel mount first.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const handle = services.globeRef.current;
      if (!handle) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let right = 0;
      let bottom = 0;
      for (const el of document.querySelectorAll<HTMLElement>(
        ".detail-panel, .relation-dialog"
      )) {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        if (r.width >= vw * 0.9) bottom = Math.max(bottom, vh - r.top);
        else if (r.right >= vw - 40) right = Math.max(right, vw - r.left);
      }
      // never shift more than half the viewport — a tiny window with a huge
      // panel should clamp, not fold the map away
      handle.setSafeInsets({
        right: Math.min(right, vw * 0.5),
        bottom: Math.min(bottom, vh * 0.4)
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [
    services,
    state.selectedAuthorId,
    state.selectedWorkId,
    state.pickedRelationId,
    state.panelOpen,
    state.compareAuthorId
  ]);

  // popover lifecycle: focus in on open; Escape/close/select returns focus
  // to the "+N" chip that opened it (PR5 a11y — the 6th review found focus
  // stranded after Escape)
  const closePopover = (chipId?: string) => {
    setCluster(null);
    if (chipId) {
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(`[data-label-id="cl:${CSS.escape(chipId)}"]`)
          ?.focus();
      });
    }
  };
  useEffect(() => {
    if (!cluster) return;
    popoverRef.current?.querySelector("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePopover(cluster.chipId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cluster]);

  if (!webglAvailable) return <FallbackExplorer />;

  const authorsById = new Map(services.dataset.authors.map((a) => [a.id, a]));
  const width = ref.current?.clientWidth ?? 0;
  const height = ref.current?.clientHeight ?? 0;
  const POP_H = 308; // max-height + padding — the bottom clamp's estimate
  const popLeft = cluster ? Math.min(Math.max(8, cluster.x - 90), Math.max(8, width - 196)) : 0;
  const popTop = cluster
    ? Math.min(Math.max(8, cluster.y - 8), Math.max(8, height - POP_H))
    : 0;
  // majority region of the members gives the list its place context
  const regionContext = (() => {
    if (!cluster) return null;
    const counts = new Map<string, number>();
    for (const id of cluster.ids) {
      const r = authorsById.get(id)?.regions[0];
      if (r) counts.set(r, (counts.get(r) ?? 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return top ? regionLabel(top[0], state.locale) : null;
  })();

  return (
    <div className="globe-container" ref={ref} role="application" aria-label={t.globeAria}>
      {cluster && (
        <div
          className="cluster-popover"
          ref={popoverRef}
          role="dialog"
          aria-label={t.clusterListAria}
          aria-describedby="cluster-popover-note"
          data-qa="cluster-popover"
          style={{ left: popLeft, top: popTop }}
        >
          <div className="cluster-popover-head">
            <span>
              {regionContext ? `${regionContext} · ` : ""}
              {cluster.ids.length}
            </span>
            <button
              type="button"
              className="icon-btn"
              aria-label={t.close}
              onClick={() => closePopover(cluster.chipId)}
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
                      closePopover(cluster.chipId);
                    }}
                  >
                    {content.authorName(a)}
                  </button>
                </li>
              );
            })}
          </ul>
          <p id="cluster-popover-note" className="cluster-popover-note">
            {t.clusterNote}
          </p>
        </div>
      )}
    </div>
  );
}
