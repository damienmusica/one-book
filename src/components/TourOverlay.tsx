import { useEffect, useRef, useState } from "react";
import { useAppState, useServices } from "./ctx.ts";

export function TourOverlay() {
  const state = useAppState();
  const services = useServices();
  const { store, dataset } = services;
  const [autoplay, setAutoplay] = useState(false);
  const timerRef = useRef<number>(0);

  const tour = dataset.tours.find((t) => t.id === state.tourId);
  const stop = tour?.stops[state.tourStop];

  // arriving at a stop selects + focuses its author
  useEffect(() => {
    if (!stop) return;
    store.selectAuthor(stop.authorId);
    requestAnimationFrame(() => services.globeRef.current?.focusAuthor(stop.authorId));
  }, [services, store, stop]);

  useEffect(() => {
    window.clearTimeout(timerRef.current);
    if (!autoplay || !tour) return;
    if (state.tourStop >= tour.stops.length - 1) {
      setAutoplay(false);
      return;
    }
    timerRef.current = window.setTimeout(() => {
      store.set({ tourStop: state.tourStop + 1 });
    }, 9000);
    return () => window.clearTimeout(timerRef.current);
  }, [autoplay, state.tourStop, store, tour]);

  if (!tour || !stop) return null;
  const isFirst = state.tourStop === 0;
  const isLast = state.tourStop === tour.stops.length - 1;

  return (
    <div className="tour-overlay" role="region" aria-label={`안내 여정: ${tour.title}`}>
      <div className="tour-head">
        <span className="tour-name">{tour.title}</span>
        <span className="tour-progress">
          {state.tourStop + 1} / {tour.stops.length}
        </span>
      </div>
      <p className="tour-note">{stop.note}</p>
      <div className="tour-controls">
        <button
          type="button"
          disabled={isFirst}
          onClick={() => store.set({ tourStop: Math.max(0, state.tourStop - 1) })}
        >
          이전
        </button>
        <button
          type="button"
          aria-pressed={autoplay}
          onClick={() => setAutoplay((a) => !a)}
          title="9초 간격으로 자동 진행"
        >
          {autoplay ? "일시정지" : "자동 진행"}
        </button>
        <button
          type="button"
          disabled={isLast}
          onClick={() =>
            store.set({ tourStop: Math.min(tour.stops.length - 1, state.tourStop + 1) })
          }
        >
          다음
        </button>
        <button type="button" className="tour-exit" onClick={() => store.endTour()}>
          자유 탐색으로
        </button>
      </div>
    </div>
  );
}
