import type { AppState, Store } from "../state/store.ts";
import type { Dataset } from "../types.ts";
import { visibleAuthorIds, visibleRelations } from "./filter.ts";

/**
 * Session instrumentation shared by the debug overlay (?debug=1 or
 * Cmd/Ctrl+Shift+D) and the automated QA harness (window.__lpQA, driven by
 * qa/capture.mjs). Always recording — a bounded event ring plus a frame-time
 * ring costs a few comparisons per store change and per frame — so the
 * overlay can be opened mid-session with history intact and captures need no
 * special build.
 *
 * The renderer stays decoupled: it registers a probe function here and the
 * overlay/harness read through it. Nothing in this module may depend on the
 * desktop/web shell (shell-independence invariant, ADR 0001).
 */

export interface InstrEvent {
  /** ms since page load (performance.now), rounded */
  t: number;
  type: string;
  [key: string]: unknown;
}

export type RendererProbe = () => Record<string, unknown>;

export interface FrameStats {
  samples: number;
  avgFps: number;
  minFps: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
}

const EVENT_CAP = 1200;
const FRAME_CAP = 480;

class Instrumentation {
  private events: InstrEvent[] = [];
  private frames: number[] = [];
  private lastFrameAt = 0;
  private probe: RendererProbe | null = null;
  private overlayListeners = new Set<() => void>();
  overlayVisible = false;

  log(type: string, data?: Record<string, unknown>): void {
    this.events.push({ t: Math.round(performance.now()), type, ...data });
    if (this.events.length > EVENT_CAP) {
      this.events.splice(0, this.events.length - EVENT_CAP);
    }
  }

  getEvents(): InstrEvent[] {
    return [...this.events];
  }

  frameTick(now: number): void {
    if (this.lastFrameAt > 0) {
      const d = now - this.lastFrameAt;
      // gaps over half a second are tab switches, not frames
      if (d > 0 && d < 500) {
        this.frames.push(d);
        if (this.frames.length > FRAME_CAP) this.frames.shift();
      }
    }
    this.lastFrameAt = now;
  }

  frameStats(): FrameStats | null {
    if (this.frames.length < 10) return null;
    const sorted = [...this.frames].sort((a, b) => a - b);
    const pick = (q: number) =>
      sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
    const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length;
    return {
      samples: sorted.length,
      avgFps: Math.round(10000 / avg) / 10,
      minFps: Math.round(10000 / sorted[sorted.length - 1]!) / 10,
      p50Ms: Math.round(pick(0.5) * 10) / 10,
      p95Ms: Math.round(pick(0.95) * 10) / 10,
      p99Ms: Math.round(pick(0.99) * 10) / 10
    };
  }

  registerRenderer(probe: RendererProbe): void {
    this.probe = probe;
  }

  unregisterRenderer(probe: RendererProbe): void {
    if (this.probe === probe) this.probe = null;
  }

  rendererInfo(): Record<string, unknown> | null {
    try {
      return this.probe ? this.probe() : null;
    } catch {
      return null;
    }
  }

  setOverlay(v: boolean): void {
    if (this.overlayVisible === v) return;
    this.overlayVisible = v;
    for (const fn of this.overlayListeners) fn();
  }

  toggleOverlay(): void {
    this.setOverlay(!this.overlayVisible);
  }

  onOverlayChange(fn: () => void): () => void {
    this.overlayListeners.add(fn);
    return () => this.overlayListeners.delete(fn);
  }
}

export const instr = new Instrumentation();

// state keys worth a timeline entry (filters get their own richer event)
const WATCHED = [
  "page",
  "locale",
  "mode",
  "selectedAuthorId",
  "panelOpen",
  "compareAuthorId",
  "pickedRelationId",
  "year",
  "yearMode",
  "tourId",
  "tourStop",
  "filtersOpen",
  "reducedMotion"
] as const satisfies ReadonlyArray<keyof AppState>;

/** subscribe the event ring to store changes (one event per changed key) */
export function connectInstrumentation(store: Store): () => void {
  let prev = store.getState();
  return store.subscribe(() => {
    const s = store.getState();
    for (const k of WATCHED) {
      if (s[k] !== prev[k]) instr.log("state", { key: k, from: prev[k], to: s[k] });
    }
    if (s.filters !== prev.filters) instr.log("filters", { filters: s.filters });
    prev = s;
  });
}

export const BUILD = {
  version: typeof __BUILD_VERSION__ !== "undefined" ? __BUILD_VERSION__ : "dev",
  commit: typeof __BUILD_COMMIT__ !== "undefined" ? __BUILD_COMMIT__ : "unknown"
};

/** one self-describing snapshot: app identity, state, counts, frame + GL info */
export function buildMetrics(store: Store, dataset: Dataset): Record<string, unknown> {
  const s = store.getState();
  const vis = visibleAuthorIds(dataset.authors, s.filters, s.year, s.yearMode);
  const rels = visibleRelations(dataset.relations, s.filters, vis);
  return {
    app: {
      name: "literary-planet",
      version: BUILD.version,
      commit: BUILD.commit,
      layoutVersion: "positions.v1",
      locale: s.locale
    },
    state: {
      page: s.page,
      mode: s.mode,
      selectedAuthorId: s.selectedAuthorId,
      panelOpen: s.panelOpen,
      compareAuthorId: s.compareAuthorId,
      pickedRelationId: s.pickedRelationId,
      year: s.year,
      yearMode: s.yearMode,
      tourId: s.tourId,
      tourStop: s.tourStop,
      filters: s.filters,
      reducedMotion: s.reducedMotion
    },
    visible: {
      authors: vis.size,
      authorsTotal: dataset.authors.length,
      relations: rels.length,
      relationsTotal: dataset.relations.length
    },
    viewport:
      typeof window === "undefined"
        ? null
        : {
            width: window.innerWidth,
            height: window.innerHeight,
            dpr: window.devicePixelRatio
          },
    frame: instr.frameStats(),
    renderer: instr.rendererInfo()
  };
}

declare global {
  interface Window {
    __lpQA?: {
      metrics(): Record<string, unknown>;
      events(): InstrEvent[];
      state(): AppState;
      overlay(v: boolean): void;
    };
  }
}

/** the QA harness talks to the app exclusively through this handle */
export function attachQAHandle(store: Store, dataset: Dataset): void {
  if (typeof window === "undefined") return;
  window.__lpQA = {
    metrics: () => buildMetrics(store, dataset),
    events: () => instr.getEvents(),
    state: () => store.getState(),
    overlay: (v: boolean) => instr.setOverlay(v)
  };
}
