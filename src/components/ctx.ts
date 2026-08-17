import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import type { Dataset, Relation, Work } from "../types.ts";
import type { AppState, Store } from "../state/store.ts";
import type { Adjacency } from "../lib/graph.ts";
import { buildAdjacency } from "../lib/graph.ts";
import { buildSearchIndex } from "../lib/search.ts";
import type { GlobeHandle } from "../globe/renderer.ts";
import {
  buildContentAccess,
  translationSearchForms,
  UI,
  type ContentAccess,
  type UIStrings
} from "../i18n/index.ts";

export interface AppServices {
  store: Store;
  dataset: Dataset;
  searchIndex: ReturnType<typeof buildSearchIndex>;
  adjacency: Adjacency;
  worksByAuthor: Map<string, Work[]>;
  relationById: Map<string, Relation>;
  /** set by GlobeView when the renderer mounts */
  globeRef: { current: GlobeHandle | null };
}

export function buildServices(store: Store, dataset: Dataset): AppServices {
  const worksByAuthor = new Map<string, Work[]>();
  for (const w of [...dataset.works].sort((a, b) => a.year - b.year)) {
    const list = worksByAuthor.get(w.authorId) ?? [];
    list.push(w);
    worksByAuthor.set(w.authorId, list);
  }
  return {
    store,
    dataset,
    searchIndex: buildSearchIndex(dataset.authors, translationSearchForms(dataset)),
    adjacency: buildAdjacency(dataset.relations),
    worksByAuthor,
    relationById: new Map(dataset.relations.map((r) => [r.id, r])),
    globeRef: { current: null }
  };
}

export const AppCtx = createContext<AppServices | null>(null);

export function useServices(): AppServices {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("AppCtx missing");
  return ctx;
}

export function useAppState(): AppState {
  const { store } = useServices();
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

/** the active UI-chrome dictionary */
export function useT(): UIStrings {
  return UI[useAppState().locale];
}

/** locale-aware access to editorial content (names, prose, titles) */
export function useContent(): ContentAccess {
  const { dataset } = useServices();
  const { locale } = useAppState();
  return useMemo(() => buildContentAccess(dataset, locale), [dataset, locale]);
}

/** select an author, open their profile, and swing the globe to face them */
export function focusAuthor(
  services: AppServices,
  id: string,
  opts: { openPanel?: boolean } = {}
): void {
  services.store.set({ page: "globe" });
  // list pages and cross-links jump straight to the profile; the map's own
  // search stays in focus mode (9th round: the planet is the surface, and
  // the mini card puts 상세 프로필/영토 입장 in view without any scrolling)
  services.store.selectAuthor(id, { openPanel: opts.openPanel ?? true });
  // start the focus flight IN THIS TICK when the globe is live — an rAF
  // deferral opened a race where a fast follow-up action froze the camera
  // mid-nowhere (9th round, reproduced only under full-suite load). The
  // rAF path remains solely for cross-page mounts.
  if (services.globeRef.current) services.globeRef.current.focusAuthor(id);
  else requestAnimationFrame(() => services.globeRef.current?.focusAuthor(id));
}
