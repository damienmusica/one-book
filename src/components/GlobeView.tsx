import { useEffect, useRef } from "react";
import { useServices, useT } from "./ctx.ts";
import { createGlobe } from "../globe/renderer.ts";
import { geoPositions, semanticPositions } from "../data/load.ts";
import { buildContentAccess, LOCALES, UI, type ContentAccess, type Locale } from "../i18n/index.ts";
import { webglAvailable } from "../lib/webgl.ts";
import { FallbackExplorer } from "./FallbackExplorer.tsx";

export function GlobeView() {
  const services = useServices();
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);

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
        onWorkHover: (wk) => store.set({ hoveredWorkId: wk?.id ?? null })
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
          )
      }
    );
    services.globeRef.current = handle;
    return () => {
      services.globeRef.current = null;
      handle.dispose();
    };
  }, [services]);

  if (!webglAvailable) return <FallbackExplorer />;

  return <div className="globe-container" ref={ref} role="application" aria-label={t.globeAria} />;
}
