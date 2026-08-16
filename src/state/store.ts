import { GENRE_DEFS, PERIOD_DEFS, RELATION_DEFS } from "../types.ts";
import type { GenreId, PeriodId, RelationType } from "../types.ts";
import { TIMELINE_MAX, type Filters, type YearMode } from "../lib/filter.ts";
import { DEFAULT_LOCALE, type Locale } from "../i18n/index.ts";

export type Page = "globe" | "writers" | "methodology";
export type GlobeMode = "semantic" | "geo";

export interface AppState {
  page: Page;
  locale: Locale;
  mode: GlobeMode;
  selectedAuthorId: string | null;
  /**
   * Two-stage reading: the first click on a star focuses its constellation on
   * the globe (panel closed); the second click — or an explicit profile
   * action — opens the detail panel.
   */
  panelOpen: boolean;
  hoveredAuthorId: string | null;
  /** relation line under the pointer — transient, drives the edge tooltip */
  hoveredRelationId: string | null;
  compareAuthorId: string | null;
  comparePicking: boolean;
  /** relation opened by clicking a line — transient, not in URL */
  pickedRelationId: string | null;
  filters: Filters;
  year: number;
  yearMode: YearMode;
  tourId: string | null;
  tourStop: number;
  filtersOpen: boolean;
  reducedMotion: boolean;
}

export function defaultFilters(): Filters {
  return {
    periods: PERIOD_DEFS.filter((p) => p.defaultOn).map((p) => p.id),
    genres: GENRE_DEFS.filter((g) => g.defaultOn).map((g) => g.id),
    relationTypes: RELATION_DEFS.filter((r) => r.defaultOn).map((r) => r.id),
    regions: [],
    languages: [],
    movements: [],
    speculativeOnly: false
  };
}

export function initialState(): AppState {
  return {
    page: "globe",
    locale: DEFAULT_LOCALE,
    mode: "semantic",
    selectedAuthorId: null,
    panelOpen: false,
    hoveredAuthorId: null,
    hoveredRelationId: null,
    compareAuthorId: null,
    comparePicking: false,
    pickedRelationId: null,
    filters: defaultFilters(),
    year: TIMELINE_MAX,
    yearMode: "cumulative",
    tourId: null,
    tourStop: 0,
    filtersOpen: false,
    reducedMotion: false
  };
}

export type Listener = () => void;

export class Store {
  private state: AppState;
  private listeners = new Set<Listener>();

  constructor(state: AppState = initialState()) {
    this.state = state;
  }

  getState = (): AppState => this.state;

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  set(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }

  setFilters(patch: Partial<Filters>): void {
    this.set({ filters: { ...this.state.filters, ...patch } });
  }

  // --- semantic actions -----------------------------------------------------

  selectAuthor(id: string | null, opts: { openPanel?: boolean } = {}): void {
    const s = this.state;
    if (s.comparePicking && id !== null && id !== s.selectedAuthorId) {
      this.set({ compareAuthorId: id, comparePicking: false });
      return;
    }
    // globe clicks focus first and escalate on the second click; search,
    // lists, and deep links pass openPanel to jump straight to the profile
    const panelOpen =
      id === null
        ? false
        : (opts.openPanel ?? (id === s.selectedAuthorId ? true : false));
    this.set({
      selectedAuthorId: id,
      panelOpen,
      hoveredRelationId: null,
      // the profile and the explore panel never fight for the map
      // (UX audit P1-4)
      ...(panelOpen ? { filtersOpen: false } : {}),
      // leaving an author clears the comparison against them
      compareAuthorId: id === null ? null : s.compareAuthorId,
      comparePicking: false,
      pickedRelationId: null
    });
  }

  toggleListValue<K extends "periods" | "genres" | "relationTypes" | "regions" | "languages" | "movements">(
    key: K,
    value: Filters[K][number]
  ): void {
    const list = this.state.filters[key] as string[];
    const next = list.includes(value as string)
      ? list.filter((v) => v !== value)
      : [...list, value as string];
    this.setFilters({ [key]: next } as Partial<Filters>);
  }

  startTour(tourId: string): void {
    this.set({ tourId, tourStop: 0, comparePicking: false, compareAuthorId: null });
  }

  endTour(): void {
    this.set({ tourId: null, tourStop: 0 });
  }

  resetView(): void {
    this.set({
      mode: "semantic",
      selectedAuthorId: null,
      panelOpen: false,
      hoveredAuthorId: null,
      hoveredRelationId: null,
      compareAuthorId: null,
      comparePicking: false,
      filters: defaultFilters(),
      year: TIMELINE_MAX,
      yearMode: "cumulative",
      tourId: null,
      tourStop: 0
    });
  }
}

export type { Filters, YearMode, PeriodId, GenreId, RelationType };
