import { useAppState, useServices, useT } from "./ctx.ts";
import { TIMELINE_MAX, TIMELINE_MIN } from "../lib/filter.ts";
import { webglAvailable } from "../lib/webgl.ts";

export function TimelineBar() {
  const state = useAppState();
  const { store, globeRef } = useServices();
  const t = useT();

  const label =
    state.year >= TIMELINE_MAX
      ? t.allYears
      : state.yearMode === "cumulative"
        ? t.upToYear(state.year)
        : t.activeInYear(state.year);

  // PR2 demand loading: reaching for the fader (focus/press/keys) is the
  // intent signal — the tectonic keyframes start loading here, never at boot
  const intent = () => globeRef.current?.timelineIntent?.();

  return (
    <div className="timeline-bar">
      <div className="timeline-mode" role="group" aria-label={t.yearModeAria}>
        <button
          type="button"
          aria-pressed={state.yearMode === "cumulative"}
          title={t.cumulativeTitle}
          onClick={() => store.set({ yearMode: "cumulative" })}
        >
          {t.cumulative}
        </button>
        <button
          type="button"
          aria-pressed={state.yearMode === "active"}
          title={t.activeTitle}
          onPointerDown={intent}
          onClick={() => {
            intent();
            store.set({ yearMode: "active" });
          }}
        >
          {t.activeMode}
        </button>
      </div>

      <input
        className="timeline-slider"
        type="range"
        min={TIMELINE_MIN}
        max={TIMELINE_MAX}
        step={1}
        value={state.year}
        aria-label={t.yearSliderAria}
        aria-valuetext={label}
        onFocus={intent}
        onPointerDown={intent}
        onKeyDown={intent}
        onChange={(e) => store.set({ year: Number(e.target.value) })}
      />
      <output className="timeline-label" aria-live="polite">
        {label}
        {state.eraLoading && <span className="timeline-preparing"> · {t.eraPreparing}</span>}
      </output>

      <div className="view-controls" role="group" aria-label={t.viewControlsAria}>
        {webglAvailable && (
          <>
            <button
              type="button"
              aria-label={t.zoomIn}
              onClick={() => globeRef.current?.zoomBy(0.72)}
            >
              +
            </button>
            <button
              type="button"
              aria-label={t.zoomOut}
              onClick={() => globeRef.current?.zoomBy(1.38)}
            >
              −
            </button>
          </>
        )}
        <button
          type="button"
          className="reset-view"
          onClick={() => {
            store.resetView();
            globeRef.current?.resetCamera();
          }}
        >
          {t.resetView}
        </button>
      </div>
    </div>
  );
}
