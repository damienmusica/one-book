import { useMemo } from "react";
import { useAppState, useServices, useT } from "./ctx.ts";
import { visibleAuthorIds, visibleRelations } from "../lib/filter.ts";
import { pageHref } from "../state/url.ts";
import { LOCALES } from "../i18n/index.ts";
import { SearchBox } from "./SearchBox.tsx";
import { webglAvailable } from "../lib/webgl.ts";

export function Header() {
  const state = useAppState();
  const { store, dataset } = useServices();
  const t = useT();

  const counts = useMemo(() => {
    const vis = visibleAuthorIds(dataset.authors, state.filters, state.year, state.yearMode);
    const rels = visibleRelations(dataset.relations, state.filters, vis);
    const contrastTotal = dataset.relations.filter((r) => r.type === "contrast").length;
    return {
      authors: vis.size,
      authorsTotal: dataset.authors.length,
      relations: rels.length,
      relationsTotal: dataset.relations.length,
      contrastTotal
    };
  }, [dataset, state.filters, state.year, state.yearMode]);

  return (
    <header className="app-header">
      <div className="brand">
        <a href={pageHref(state, "globe")} className="brand-title">
          {t.brand}
        </a>
        <span
          className="brand-sub"
          aria-label={t.brandSubAria}
          title={t.brandSubTitle(counts.contrastTotal)}
        >
          {t.brandSub(counts.authors, counts.authorsTotal, counts.relations, counts.relationsTotal)}
        </span>
      </div>

      {state.page === "globe" && (
        <>
          <button
            type="button"
            className="panel-toggle"
            aria-expanded={state.filtersOpen}
            onClick={() => store.set({ filtersOpen: !state.filtersOpen })}
          >
            {t.panelToggle}
          </button>
          <SearchBox />
          {webglAvailable && (
            <div className="mode-toggle" role="group" aria-label={t.modeAria}>
              <button
                type="button"
                aria-pressed={state.mode === "semantic"}
                onClick={() => store.set({ mode: "semantic" })}
              >
                {t.modeSemantic}
              </button>
              <button
                type="button"
                aria-pressed={state.mode === "geo"}
                onClick={() => store.set({ mode: "geo" })}
              >
                {t.modeGeo}
              </button>
            </div>
          )}
        </>
      )}

      <nav className="app-nav" aria-label={t.navAria}>
        <a
          href={pageHref(state, "globe")}
          aria-current={state.page === "globe" ? "page" : undefined}
        >
          {t.navMap}
        </a>
        <a
          href={pageHref(state, "writers")}
          aria-current={state.page === "writers" ? "page" : undefined}
        >
          {t.navWriters}
        </a>
        <a
          href={pageHref(state, "methodology")}
          aria-current={state.page === "methodology" ? "page" : undefined}
        >
          {t.navMethodology}
        </a>
      </nav>

      <div className="mode-toggle locale-toggle" role="group" aria-label={t.localeAria}>
        {LOCALES.map((l) => (
          <button
            key={l.id}
            type="button"
            aria-pressed={state.locale === l.id}
            title={l.label}
            onClick={() => store.set({ locale: l.id })}
          >
            {l.short}
          </button>
        ))}
      </div>
    </header>
  );
}
