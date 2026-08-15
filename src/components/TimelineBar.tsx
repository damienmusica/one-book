import { useAppState, useServices } from "./ctx.ts";
import { TIMELINE_MAX, TIMELINE_MIN } from "../lib/filter.ts";

export function TimelineBar() {
  const state = useAppState();
  const { store, globeRef } = useServices();

  const label =
    state.year >= TIMELINE_MAX
      ? "전체 시기"
      : state.yearMode === "cumulative"
        ? `${state.year}년까지`
        : `${state.year}년 활동`;

  return (
    <div className="timeline-bar">
      <div className="timeline-mode" role="group" aria-label="연대 보기 방식">
        <button
          type="button"
          aria-pressed={state.yearMode === "cumulative"}
          title="선택 연도까지 등장한 작가를 누적해 보여줍니다"
          onClick={() => store.set({ yearMode: "cumulative" })}
        >
          누적
        </button>
        <button
          type="button"
          aria-pressed={state.yearMode === "active"}
          title="선택 연도에 활동 중이던 작가만 보여줍니다"
          onClick={() => store.set({ yearMode: "active" })}
        >
          당시 활동
        </button>
      </div>

      <input
        className="timeline-slider"
        type="range"
        min={TIMELINE_MIN}
        max={TIMELINE_MAX}
        step={1}
        value={state.year}
        aria-label="연대 슬라이더"
        aria-valuetext={label}
        onChange={(e) => store.set({ year: Number(e.target.value) })}
      />
      <output className="timeline-label" aria-live="off">
        {label}
      </output>

      <div className="view-controls" role="group" aria-label="화면 제어">
        <button
          type="button"
          aria-label="확대"
          onClick={() => globeRef.current?.zoomBy(0.72)}
        >
          +
        </button>
        <button
          type="button"
          aria-label="축소"
          onClick={() => globeRef.current?.zoomBy(1.38)}
        >
          −
        </button>
        <button
          type="button"
          className="reset-view"
          onClick={() => {
            store.resetView();
            globeRef.current?.resetCamera();
          }}
        >
          초기화
        </button>
      </div>
    </div>
  );
}
