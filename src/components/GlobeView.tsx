import { useEffect, useRef, useState } from "react";
import { useServices, useT } from "./ctx.ts";
import { createGlobe } from "../globe/renderer.ts";
import { geoPositions, semanticPositions } from "../data/load.ts";
import { buildContentAccess, LOCALES, type ContentAccess, type Locale } from "../i18n/index.ts";

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ?? canvas.getContext("webgl")
    );
  } catch {
    return false;
  }
}

export function GlobeView() {
  const services = useServices();
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [webglOk] = useState(detectWebGL);

  useEffect(() => {
    const el = ref.current;
    if (!webglOk || !el) return;
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
        onRelationPick: (rel) => store.set({ pickedRelationId: rel.id })
      },
      {
        authorLabel: (a, locale) =>
          (contentByLocale.get(locale) ?? contentByLocale.get("ko"))!.authorName(a),
        movementLabel: (m, locale) =>
          (contentByLocale.get(locale) ?? contentByLocale.get("ko"))!.movementName(m),
        workLabel: (wk, locale) =>
          (contentByLocale.get(locale) ?? contentByLocale.get("ko"))!.workTitle(wk)
      }
    );
    services.globeRef.current = handle;
    return () => {
      services.globeRef.current = null;
      handle.dispose();
    };
  }, [services, webglOk]);

  if (!webglOk) {
    return (
      <div className="globe-fallback">
        <h2>{t.webglTitle}</h2>
        <p>
          {t.webglBody1}
          <a href="#/writers">{t.webglLinkText}</a>
          {t.webglBody2}
        </p>
      </div>
    );
  }

  return <div className="globe-container" ref={ref} role="application" aria-label={t.globeAria} />;
}
