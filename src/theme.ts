// Single source for the visual language — values fixed by docs/design-thesis.md
// ("읽는 관측 기기": warm-black ink ground, brass instrument lines, stellar-
// spectrum period ramp). CSS custom properties in styles.css mirror these.

import type { PeriodId, RelationType } from "./types.ts";

export const COLORS = {
  bg: "#0f0d0a",
  surface: "#161210",
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
  focus: "#eccb82"
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

export const GLOBE = {
  radius: 100,
  surfaceRadius: 99,
  graticuleRadius: 99.4,
  atmosphereScale: 1.045,
  arcSegments: 24
} as const;
