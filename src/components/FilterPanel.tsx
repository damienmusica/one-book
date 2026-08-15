import { useMemo } from "react";
import { useAppState, useContent, useServices, useT } from "./ctx.ts";
import { GENRE_DEFS, PERIOD_DEFS, RELATION_DEFS } from "../types.ts";
import { RELATION_COLORS } from "../theme.ts";
import {
  genreLabel,
  languageLabel,
  periodDesc,
  periodLabel,
  regionLabel,
  relationTypeDesc,
  relationTypeLabel
} from "../i18n/index.ts";
import { LANGUAGE_LABELS, REGION_DEFS } from "../types.ts";

export function FilterPanel() {
  const state = useAppState();
  const { store, dataset } = useServices();
  const t = useT();
  const content = useContent();
  const locale = state.locale;
  const f = state.filters;

  const usedLanguages = useMemo(() => {
    const set = new Set(dataset.authors.flatMap((a) => a.languages));
    return Object.keys(LANGUAGE_LABELS).filter((code) => set.has(code));
  }, [dataset]);

  const usedRegions = useMemo(() => {
    const set = new Set(dataset.authors.flatMap((a) => a.regions));
    return REGION_DEFS.filter((r) => set.has(r.id));
  }, [dataset]);

  if (!state.filtersOpen) return null;

  return (
    <aside className="filter-panel" aria-label={t.filterAria}>
      <div className="filter-panel-head">
        <h2>{t.exploreHead}</h2>
        <button
          type="button"
          className="icon-btn"
          aria-label={t.closePanel}
          onClick={() => store.set({ filtersOpen: false })}
        >
          ✕
        </button>
      </div>

      {dataset.tours.length > 0 && (
        <details className="filter-section" open>
          <summary>{t.toursHead}</summary>
          <ul className="tour-list">
            {dataset.tours.map((tour) => (
              <li key={tour.id}>
                <button
                  type="button"
                  className={state.tourId === tour.id ? "is-active" : ""}
                  onClick={() => store.startTour(tour.id)}
                >
                  <span className="tour-title">{content.tourTitle(tour)}</span>
                  <span className="tour-desc">{content.tourDesc(tour)}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <details className="filter-section" open>
        <summary>{t.periodsHead}</summary>
        {PERIOD_DEFS.map((p) => (
          <label key={p.id} className="check-row" title={periodDesc(p.id, locale)}>
            <input
              type="checkbox"
              checked={f.periods.includes(p.id)}
              onChange={() => store.toggleListValue("periods", p.id)}
            />
            <span>{periodLabel(p.id, locale)}</span>
            {p.id === "contemporary" && <em className="tag-note">{t.canonizing}</em>}
          </label>
        ))}
      </details>

      <details className="filter-section" open>
        <summary>{t.genresHead}</summary>
        {GENRE_DEFS.map((g) => (
          <label key={g.id} className="check-row">
            <input
              type="checkbox"
              checked={f.genres.includes(g.id)}
              onChange={() => store.toggleListValue("genres", g.id)}
            />
            <span>{genreLabel(g.id, locale)}</span>
          </label>
        ))}
        <label className="check-row">
          <input
            type="checkbox"
            checked={f.speculativeOnly}
            onChange={() => store.setFilters({ speculativeOnly: !f.speculativeOnly })}
          />
          <span>{t.speculativeOnly}</span>
        </label>
      </details>

      <details className="filter-section" open>
        <summary>{t.relationsLegendHead}</summary>
        {RELATION_DEFS.map((r) => (
          <label key={r.id} className="check-row" title={relationTypeDesc(r.id, locale)}>
            <input
              type="checkbox"
              checked={f.relationTypes.includes(r.id)}
              onChange={() => store.toggleListValue("relationTypes", r.id)}
            />
            <svg className="legend-swatch" width="26" height="8" aria-hidden="true">
              <line
                x1="1"
                y1="4"
                x2="25"
                y2="4"
                stroke={RELATION_COLORS[r.id]}
                strokeWidth="2"
                strokeDasharray={r.dashed ? "4 3" : undefined}
              />
              {r.direction === "directed" && (
                <path d="M 19 1 L 25 4 L 19 7 Z" fill={RELATION_COLORS[r.id]} />
              )}
            </svg>
            <span>{relationTypeLabel(r.id, locale)}</span>
          </label>
        ))}
        <p className="legend-note">{t.legendNote}</p>
      </details>

      <details className="filter-section">
        <summary>{t.regionsHead}</summary>
        <div className="chip-grid">
          {usedRegions.map((r) => (
            <button
              key={r.id}
              type="button"
              className="chip"
              aria-pressed={f.regions.includes(r.id)}
              onClick={() => store.toggleListValue("regions", r.id)}
            >
              {regionLabel(r.id, locale)}
            </button>
          ))}
        </div>
      </details>

      <details className="filter-section">
        <summary>{t.languagesHead}</summary>
        <div className="chip-grid">
          {usedLanguages.map((code) => (
            <button
              key={code}
              type="button"
              className="chip"
              aria-pressed={f.languages.includes(code)}
              onClick={() => store.toggleListValue("languages", code)}
            >
              {languageLabel(code, locale)}
            </button>
          ))}
        </div>
      </details>

      <details className="filter-section">
        <summary>{t.movementsHead}</summary>
        <div className="chip-grid">
          {dataset.movements.map((m) => (
            <button
              key={m.id}
              type="button"
              className="chip"
              aria-pressed={f.movements.includes(m.id)}
              title={content.movementDesc(m)}
              onClick={() => store.toggleListValue("movements", m.id)}
            >
              {content.movementName(m)}
            </button>
          ))}
        </div>
      </details>

      <button type="button" className="reset-btn" onClick={() => store.resetView()}>
        {t.resetAll}
      </button>
    </aside>
  );
}
