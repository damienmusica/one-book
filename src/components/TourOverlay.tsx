import { useEffect, useRef, useState } from "react";
import { useAppState, useContent, useServices, useT } from "./ctx.ts";

export function TourOverlay() {
  const state = useAppState();
  const services = useServices();
  const { store, dataset } = services;
  const t = useT();
  const content = useContent();
  const [autoplay, setAutoplay] = useState(false);
  const timerRef = useRef<number>(0);

  const tour = dataset.tours.find((x) => x.id === state.tourId);
  const stop = tour?.stops[state.tourStop];

  // arriving at a stop selects + focuses its author
  useEffect(() => {
    if (!stop) return;
    store.selectAuthor(stop.authorId, { openPanel: true });
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
    <div className="tour-overlay" role="region" aria-label={t.tourAria(content.tourTitle(tour))}>
      <div className="tour-head">
        <span className="tour-name">{content.tourTitle(tour)}</span>
        <span className="tour-progress">
          {state.tourStop + 1} / {tour.stops.length}
        </span>
      </div>
      <p className="tour-note">{content.tourStopNote(tour, state.tourStop)}</p>
      <div className="tour-controls">
        <button
          type="button"
          disabled={isFirst}
          onClick={() => store.set({ tourStop: Math.max(0, state.tourStop - 1) })}
        >
          {t.prev}
        </button>
        <button
          type="button"
          aria-pressed={autoplay}
          onClick={() => setAutoplay((a) => !a)}
          title={t.autoplayTitle}
        >
          {autoplay ? t.pause : t.autoplay}
        </button>
        <button
          type="button"
          disabled={isLast}
          onClick={() =>
            store.set({ tourStop: Math.min(tour.stops.length - 1, state.tourStop + 1) })
          }
        >
          {t.next}
        </button>
        <button type="button" className="tour-exit" onClick={() => store.endTour()}>
          {t.exitTour}
        </button>
      </div>
    </div>
  );
}
