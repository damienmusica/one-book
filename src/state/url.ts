import { GENRE_DEFS, PERIOD_DEFS, RELATION_DEFS } from "../types.ts";
import type { GenreId, PeriodId, RelationType } from "../types.ts";
import { TIMELINE_MAX, TIMELINE_MIN } from "../lib/filter.ts";
import { DEFAULT_LOCALE, isLocale } from "../i18n/index.ts";
import { defaultFilters, type AppState, type Page, type Store } from "./store.ts";

// URL shape (hash-based so any static host works without rewrites):
//   #/?a=franz-kafka&m=geo&y=1968&rt=documented_influence,affinity
//   #/writers?q=...   #/methodology

export interface UrlValidIds {
  authorIds: Set<string>;
  tourIds: Set<string>;
  workIds: Set<string>;
}

const PAGE_PATH: Record<Page, string> = {
  globe: "/",
  writers: "/writers",
  methodology: "/methodology"
};

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sb = new Set(b);
  return a.every((v) => sb.has(v));
}

export function serializeState(s: AppState): string {
  const q = new URLSearchParams();
  const d = defaultFilters();
  if (s.locale !== DEFAULT_LOCALE) q.set("l", s.locale);
  if (s.selectedAuthorId) q.set("a", s.selectedAuthorId);
  // focus mode (constellation without the profile) survives page switches;
  // plain a= deep links still open the profile
  if (s.selectedAuthorId && !s.panelOpen) q.set("pv", "0");
  if (s.compareAuthorId) q.set("cmp", s.compareAuthorId);
  if (s.selectedWorkId) q.set("w", s.selectedWorkId);
  if (s.mode === "geo") q.set("m", "geo");
  if (s.year !== TIMELINE_MAX) q.set("y", String(s.year));
  if (s.yearMode === "active") q.set("ym", "active");
  if (!sameSet(s.filters.periods, d.periods)) q.set("p", s.filters.periods.join(","));
  if (!sameSet(s.filters.genres, d.genres)) q.set("g", s.filters.genres.join(","));
  if (!sameSet(s.filters.relationTypes, d.relationTypes))
    q.set("rt", s.filters.relationTypes.join(","));
  if (s.filters.regions.length > 0) q.set("rg", s.filters.regions.join(","));
  if (s.filters.languages.length > 0) q.set("lg", s.filters.languages.join(","));
  if (s.filters.movements.length > 0) q.set("mv", s.filters.movements.join(","));
  if (s.filters.speculativeOnly) q.set("sp", "1");
  if (s.tourId) {
    q.set("t", s.tourId);
    if (s.tourStop > 0) q.set("ts", String(s.tourStop));
  }
  const qs = q.toString();
  return `#${PAGE_PATH[s.page]}${qs ? `?${qs}` : ""}`;
}

/**
 * href for an in-app page link that carries the whole current state along.
 * Bare hashes like "#/writers" would reset filters, timeline, mode, and
 * selection on every route change (the map and the list must read the same
 * state), so navigation must always be built through this.
 */
export function pageHref(s: AppState, page: Page): string {
  return serializeState({ ...s, page });
}

function parseList<T extends string>(
  raw: string | null,
  valid: ReadonlyArray<T>
): T[] | undefined {
  if (raw === null) return undefined;
  const set = new Set<string>(valid);
  const vals = raw.split(",").filter((v) => set.has(v)) as T[];
  return vals;
}

export function parseHash(hash: string, valid: UrlValidIds): Partial<AppState> {
  const cleaned = hash.startsWith("#") ? hash.slice(1) : hash;
  const qIdx = cleaned.indexOf("?");
  const path = qIdx >= 0 ? cleaned.slice(0, qIdx) : cleaned;
  const q = new URLSearchParams(qIdx >= 0 ? cleaned.slice(qIdx + 1) : "");

  const page: Page =
    path === "/writers" ? "writers" : path === "/methodology" ? "methodology" : "globe";

  const patch: Partial<AppState> = { page };
  const d = defaultFilters();
  const filters = { ...d };

  const l = q.get("l");
  patch.locale = isLocale(l) ? l : DEFAULT_LOCALE;

  const a = q.get("a");
  patch.selectedAuthorId = a && valid.authorIds.has(a) ? a : null;
  // a deep link means "take me to this author" — open the profile directly,
  // unless the URL explicitly recorded focus mode (pv=0)
  patch.panelOpen = patch.selectedAuthorId !== null && q.get("pv") !== "0";
  // the profile and the explore drawer never fight for the map (UX audit
  // P1-4) — deep links obey the same rule as clicks
  if (patch.panelOpen) patch.filtersOpen = false;
  const cmp = q.get("cmp");
  patch.compareAuthorId = cmp && valid.authorIds.has(cmp) ? cmp : null;
  const wk = q.get("w");
  patch.selectedWorkId = wk && valid.workIds.has(wk) ? wk : null;
  // a work deep link IS the inspector's work depth (8th review: one
  // surface) — it overrides a stale pv=0 from pre-unification URLs
  if (patch.selectedWorkId && patch.selectedAuthorId) patch.panelOpen = true;
  patch.mode = q.get("m") === "geo" ? "geo" : "semantic";

  const y = q.get("y");
  if (y !== null && /^\d{4}$/.test(y)) {
    patch.year = Math.min(TIMELINE_MAX, Math.max(TIMELINE_MIN, Number(y)));
  } else {
    patch.year = TIMELINE_MAX;
  }
  patch.yearMode = q.get("ym") === "active" ? "active" : "cumulative";

  const periods = parseList<PeriodId>(q.get("p"), PERIOD_DEFS.map((p) => p.id));
  if (periods && periods.length > 0) filters.periods = periods;
  const genres = parseList<GenreId>(q.get("g"), GENRE_DEFS.map((g) => g.id));
  if (genres && genres.length > 0) filters.genres = genres;
  const rts = parseList<RelationType>(q.get("rt"), RELATION_DEFS.map((r) => r.id));
  if (rts) filters.relationTypes = rts;
  // regions/languages/movements accept any slug — validated against data at render time
  const rg = q.get("rg");
  filters.regions = rg ? rg.split(",").filter(Boolean) : [];
  const lg = q.get("lg");
  filters.languages = lg ? lg.split(",").filter(Boolean) : [];
  const mv = q.get("mv");
  filters.movements = mv ? mv.split(",").filter(Boolean) : [];
  filters.speculativeOnly = q.get("sp") === "1";
  patch.filters = filters;

  const t = q.get("t");
  if (t && valid.tourIds.has(t)) {
    patch.tourId = t;
    const ts = q.get("ts");
    patch.tourStop = ts !== null && /^\d+$/.test(ts) ? Number(ts) : 0;
  } else {
    patch.tourId = null;
    patch.tourStop = 0;
  }
  return patch;
}

/** two-way binding between the store and location.hash */
export function connectUrl(store: Store, valid: UrlValidIds): () => void {
  let applying = false;

  const apply = () => {
    applying = true;
    store.set(parseHash(window.location.hash || "#/", valid));
    applying = false;
  };
  apply();

  // Every hashchange is a real navigation (link click, back/forward, manual
  // edit) and must be applied: our own writes go through replaceState, which
  // never fires hashchange. A "did we write this hash?" guard here once
  // swallowed navigations that happened to match the last store-written URL —
  // URL and nav switched while the body stayed on the previous page.
  const onHashChange = () => apply();
  window.addEventListener("hashchange", onHashChange);

  let raf = 0;
  const unsub = store.subscribe(() => {
    if (applying) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const next = serializeState(store.getState());
      if (next === window.location.hash) return;
      // replaceState (not pushState): link clicks already create history
      // entries; store-driven refinements just canonicalize the current one
      window.history.replaceState(null, "", next);
    });
  });

  return () => {
    window.removeEventListener("hashchange", onHashChange);
    unsub();
  };
}
