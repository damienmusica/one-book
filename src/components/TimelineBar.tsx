import { useRef } from "react";
import { useAppState, useServices, useT } from "./ctx.ts";
import { TIMELINE_MAX, TIMELINE_MIN } from "../lib/filter.ts";
import { webglAvailable } from "../lib/webgl.ts";

export function TimelineBar() {
  const state = useAppState();
  const { store, globeRef } = useServices();
  const t = useT();
  // a HELD drag previews; release commits (7th review R7-PR2). Keyboard
  // steps are deliberate single actions and commit immediately — the flow
  // story diffs instead of restarting either way.
  const scrubbing = useRef(false);

  const shownYear = state.yearPreview ?? state.year;
  const label =
    shownYear >= TIMELINE_MAX
      ? t.allYears
      : state.yearMode === "cumulative"
        ? t.upToYear(shownYear)
        : t.activeInYear(shownYear);

  // PR2 demand loading: reaching for the fader (focus/press/keys) is the
  // intent signal — the tectonic keyframes start loading here, never at boot
  const intent = () => globeRef.current?.timelineIntent?.();

  const commit = () => {
    scrubbing.current = false;
    const s = store.getState();
    if (s.yearPreview !== null) store.set({ year: s.yearPreview, yearPreview: null });
  };

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
        value={shownYear}
        aria-label={t.yearSliderAria}
        aria-valuetext={label}
        onFocus={intent}
        onPointerDown={() => {
          intent();
          scrubbing.current = true;
          // no explicit setPointerCapture: the range input's shadow thumb
          // holds its own implicit capture — stealing it kills native drag
        }}
        onPointerUp={commit}
        onPointerCancel={commit}
        onKeyDown={intent}
        onBlur={commit}
        onChange={(e) => {
          const v = Number(e.target.value);
          // held drag → world preview only; keyboard/click-jump → commit.
          // The thumb and the readout follow shownYear either way — instant.
          if (scrubbing.current) store.set({ yearPreview: v });
          else store.set({ year: v, yearPreview: null });
        }}
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
