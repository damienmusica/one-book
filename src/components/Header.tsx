import { useMemo } from "react";
import { useAppState, useServices } from "./ctx.ts";
import { visibleAuthorIds, visibleRelations } from "../lib/filter.ts";
import { SearchBox } from "./SearchBox.tsx";

export function Header() {
  const state = useAppState();
  const { store, dataset } = useServices();

  const counts = useMemo(() => {
    const vis = visibleAuthorIds(dataset.authors, state.filters, state.year, state.yearMode);
    const rels = visibleRelations(dataset.relations, state.filters, vis);
    return { authors: vis.size, relations: rels.length };
  }, [dataset, state.filters, state.year, state.yearMode]);

  return (
    <header className="app-header">
      <div className="brand">
        <a href="#/" className="brand-title">
          문학의 행성
        </a>
        <span className="brand-sub" aria-label="현재 표시 중인 작가와 관계 수">
          작가 {counts.authors} · 관계 {counts.relations}
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
            탐색·필터
          </button>
          <SearchBox />
          <div className="mode-toggle" role="group" aria-label="좌표계 선택">
            <button
              type="button"
              aria-pressed={state.mode === "semantic"}
              onClick={() => store.set({ mode: "semantic" })}
            >
              문학적 친연성
            </button>
            <button
              type="button"
              aria-pressed={state.mode === "geo"}
              onClick={() => store.set({ mode: "geo" })}
            >
              실제 지리
            </button>
          </div>
        </>
      )}

      <nav className="app-nav" aria-label="페이지">
        <a href="#/" aria-current={state.page === "globe" ? "page" : undefined}>
          지도
        </a>
        <a href="#/writers" aria-current={state.page === "writers" ? "page" : undefined}>
          작가 목록
        </a>
        <a
          href="#/methodology"
          aria-current={state.page === "methodology" ? "page" : undefined}
        >
          방법론
        </a>
      </nav>
    </header>
  );
}
