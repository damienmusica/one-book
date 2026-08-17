// Single source for the visual language — values fixed by docs/design-thesis.md
// ("읽는 관측 기기": warm-black ink ground, brass instrument lines, stellar-
// spectrum period ramp). CSS custom properties in styles.css mirror these.

import type { PeriodId, RelationType } from "./types.ts";

// Five-value luminance ladder (7th review PR3) — in one state, one layer owns
// the peak. L0 space < L1 sea/sphere < L2 unselected territory < L3
// interactive (nodes/labels/routes) < L4 selection (pulse transiently tops
// it). The 7th review measured the initial frame at mean L 0.0735 with 91.6%
// of pixels under 10%: L0–L2 were indistinguishable. The sea got its own
// value above the page ground, and the far terrain fade floor rose with it.
export const COLORS = {
  bg: "#0f0d0a",
  surface: "#161210",
  /** L1 — the globe's sea/sphere: above page ground (~L .06), below the
   * territory wash (~L .15). At #20 1a 15 the sea sits near L .105 — the
   * first frame stops reading as one near-black band without leaving the
   * warm-black world. */
  sea: "#201a15",
  surfaceRaised: "#1e1914",
  line: "#332b1f",
  lineStrong: "#4f4331",
  lineAccent: "#6a5a3a",
  text: "#ecdfc3",
  textDim: "#b5aa90",
  textFaint: "#8f8674",
  brass: "#cfa759",
  brassBright: "#eccb82",
  teal: "#6aab9c",
  red: "#c4685a",
  inkOnAccent: "#191307",
  focus: "#eccb82",

  /* R10 paper-planet grammar (docs/art-direction-r10.md): material IS the
     code. Territories are the authors' paper (light), the sea is bound
     cloth (dark, stays L1) — the value ladder flips on land only, and the
     grammar's red channel is reserved for material seals + selection. */
  /** territory ground — warm archival paper */
  paper: "#e2d6b8",
  /** paper slightly toned for alternate/laid ground */
  paperLaid: "#d9ccab",
  /** deckle-edge highlight along the coast */
  paperEdge: "#f0e7cd",
  /** coast shadow under the deckle (the page lifts off the cloth) */
  paperShadow: "#4a3c28",
  /** manuscript/letterpress ink on paper */
  paperInk: "#2b2015",
  /** stitching thread for interior borders */
  stitch: "#7a6644",
  /** appreciation-stamp vermilion — the SELECTION channel's only user */
  vermilion: "#c0392e"
} as const;

/** geography mode — midnight cobalt plate (Burritt-style value inversion) */
export const GEO_COLORS = {
  surface: "#14223a",
  line: "#2e4568",
  lineStrong: "#4a6a9c",
  atmosphere: "#3f6296"
} as const;

export const RELATION_COLORS: Record<RelationType, string> = {
  documented_influence: "#cfa759",
  translation: "#8fae74",
  mentorship: "#cd8a4e",
  dialogue: "#c4685a",
  affinity: "#6aab9c",
  contrast: "#9a7fa4"
};

/** stellar-spectrum ramp: old literature = warm amber star, contemporary = blue-white */
export const PERIOD_TINT: Record<PeriodId, string> = {
  roots: "#d8ac6e",
  "early-modernism": "#e7c893",
  "mid-century": "#f1e0bf",
  "late-postmodern": "#ede7d9",
  contemporary: "#d9e2ea"
};

/**
 * Terrain period wash — the stellar ramp translated into aged-paper inks.
 * Stars may go blue-white, but a wash must never cool below the plate's
 * temperature: a cool tint over the warm-dark land cancels the land/sea
 * warmth separation and the territory reads as a hole in the ocean
 * (VAD P1 finding A, the late-period polar supercontinent).
 */
export const PERIOD_WASH: Record<PeriodId, string> = {
  roots: "#d8a660",
  "early-modernism": "#e0bc82",
  "mid-century": "#e8d2a4",
  "late-postmodern": "#e4d6b4",
  contemporary: "#daccb0"
};

/**
 * R 100 → 118 (CPO 2026-08-17): the planet was too small for what it must
 * hold. Camera distances and LOD thresholds are untouched, so the same
 * dial positions now sit relatively closer to a larger surface — the world
 * fills more of the frame at every distance and reading distance gets
 * meaningfully closer to the ground (min height above surface 50 → 32).
 * All positions are unit vectors × these radii; nothing else encodes size.
 */
export const GLOBE = {
  radius: 118,
  surfaceRadius: 116.8,
  /** baked-terrain shell: above the surface, below the instrument graticule */
  terrainRadius: 117.0,
  graticuleRadius: 117.3,
  atmosphereScale: 1.045,
  arcSegments: 24
} as const;

/**
 * Union treaty inks (territory grammar v2, D1) — thin membership lines drawn
 * inside member coastlines, cycled by movement index. Hand-tint hues in the
 * antique-atlas register: muted enough to sit on the land plate, distinct
 * enough to tell neighboring treaties apart. The sky keeps the relation
 * palette; these belong to the ground.
 */
export const UNION_COLORS: ReadonlyArray<string> = [
  "#7fb3a4", // verdigris
  "#c4776a", // madder
  "#8a93c9", // indigo wash
  "#a8b06a", // olive
  "#b58ac9", // violet
  "#6fae8f", // sea green
  "#7d9fc0", // slate blue
  "#c9968a" // rose ochre
];
