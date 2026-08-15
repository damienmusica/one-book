import { useMemo } from "react";
import { useAppState, useServices } from "./ctx.ts";
import {
  GENRE_DEFS,
  LANGUAGE_LABELS,
  PERIOD_DEFS,
  REGION_DEFS,
  RELATION_DEFS
} from "../types.ts";
import { RELATION_COLORS } from "../theme.ts";

export function FilterPanel() {
  const state = useAppState();
  const { store, dataset } = useServices();
  const f = state.filters;

  const usedLanguages = useMemo(() => {
    const set = new Set(dataset.authors.flatMap((a) => a.languages));
    return Object.entries(LANGUAGE_LABELS).filter(([code]) => set.has(code));
  }, [dataset]);

  const usedRegions = useMemo(() => {
    const set = new Set(dataset.authors.flatMap((a) => a.regions));
    return REGION_DEFS.filter((r) => set.has(r.id));
  }, [dataset]);

  if (!state.filtersOpen) return null;

  return (
    <aside className="filter-panel" aria-label="탐색과 필터">
      <div className="filter-panel-head">
        <h2>탐색</h2>
        <button
          type="button"
          className="icon-btn"
          aria-label="패널 닫기"
          onClick={() => store.set({ filtersOpen: false })}
        >
          ✕
        </button>
      </div>

      {dataset.tours.length > 0 && (
        <details className="filter-section" open>
          <summary>안내 여정</summary>
          <ul className="tour-list">
            {dataset.tours.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={state.tourId === t.id ? "is-active" : ""}
                  onClick={() => store.startTour(t.id)}
                >
                  <span className="tour-title">{t.title}</span>
                  <span className="tour-desc">{t.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <details className="filter-section" open>
        <summary>시대층</summary>
        {PERIOD_DEFS.map((p) => (
          <label key={p.id} className="check-row" title={p.description}>
            <input
              type="checkbox"
              checked={f.periods.includes(p.id)}
              onChange={() => store.toggleListValue("periods", p.id)}
            />
            <span>{p.ko}</span>
            {p.id === "contemporary" && <em className="tag-note">정전화 진행 중</em>}
          </label>
        ))}
      </details>

      <details className="filter-section" open>
        <summary>장르층</summary>
        {GENRE_DEFS.map((g) => (
          <label key={g.id} className="check-row">
            <input
              type="checkbox"
              checked={f.genres.includes(g.id)}
              onChange={() => store.toggleListValue("genres", g.id)}
            />
            <span>{g.ko}</span>
          </label>
        ))}
        <label className="check-row">
          <input
            type="checkbox"
            checked={f.speculativeOnly}
            onChange={() => store.setFilters({ speculativeOnly: !f.speculativeOnly })}
          />
          <span>사변소설·SF 계보만</span>
        </label>
      </details>

      <details className="filter-section" open>
        <summary>관계 유형 · 범례</summary>
        {RELATION_DEFS.map((r) => (
          <label key={r.id} className="check-row" title={r.description}>
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
            <span>{r.ko}</span>
          </label>
        ))}
        <p className="legend-note">
          실선 = 확인된 관계, 점선 = 친연성·대조(편집적 판단 포함). 선을 클릭하면 근거를
          보여줍니다.
        </p>
      </details>

      <details className="filter-section">
        <summary>지역</summary>
        <div className="chip-grid">
          {usedRegions.map((r) => (
            <button
              key={r.id}
              type="button"
              className="chip"
              aria-pressed={f.regions.includes(r.id)}
              onClick={() => store.toggleListValue("regions", r.id)}
            >
              {r.ko}
            </button>
          ))}
        </div>
      </details>

      <details className="filter-section">
        <summary>언어</summary>
        <div className="chip-grid">
          {usedLanguages.map(([code, label]) => (
            <button
              key={code}
              type="button"
              className="chip"
              aria-pressed={f.languages.includes(code)}
              onClick={() => store.toggleListValue("languages", code)}
            >
              {label}
            </button>
          ))}
        </div>
      </details>

      <details className="filter-section">
        <summary>문학운동</summary>
        <div className="chip-grid">
          {dataset.movements.map((m) => (
            <button
              key={m.id}
              type="button"
              className="chip"
              aria-pressed={f.movements.includes(m.id)}
              title={m.description}
              onClick={() => store.toggleListValue("movements", m.id)}
            >
              {m.ko}
            </button>
          ))}
        </div>
      </details>

      <button type="button" className="reset-btn" onClick={() => store.resetView()}>
        보기 초기화
      </button>
    </aside>
  );
}
