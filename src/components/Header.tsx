import { useMemo } from "react";
import { useAppState, useServices, useT } from "./ctx.ts";
import { visibleAuthorIds, visibleRelations } from "../lib/filter.ts";
import { LOCALES } from "../i18n/index.ts";
import { SearchBox } from "./SearchBox.tsx";

export function Header() {
  const state = useAppState();
  const { store, dataset } = useServices();
  const t = useT();

  const counts = useMemo(() => {
    const vis = visibleAuthorIds(dataset.authors, state.filters, state.year, state.yearMode);
    const rels = visibleRelations(dataset.relations, state.filters, vis);
    return { authors: vis.size, relations: rels.length };
  }, [dataset, state.filters, state.year, state.yearMode]);

  return (
    <header className="app-header">
      <div className="brand">
        <a href="#/" className="brand-title">
          {t.brand}
        </a>
        <span className="brand-sub" aria-label={t.brandSubAria}>
          {t.brandSub(counts.authors, counts.relations)}
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
        </>
      )}

      <nav className="app-nav" aria-label={t.navAria}>
        <a href="#/" aria-current={state.page === "globe" ? "page" : undefined}>
          {t.navMap}
        </a>
        <a href="#/writers" aria-current={state.page === "writers" ? "page" : undefined}>
          {t.navWriters}
        </a>
        <a
          href="#/methodology"
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
