// Single source for the visual language: dark observatory + old editorial map.
// CSS custom properties in styles.css mirror these values.

import type { PeriodId, RelationType } from "./types.ts";

export const COLORS = {
  bg: "#0b1216",
  surface: "#121c21",
  surfaceRaised: "#18242b",
  line: "#22323a",
  text: "#e9dfc8",
  textDim: "#a89f8c",
  textFaint: "#6d6a5c",
  brass: "#c2a15c",
  teal: "#5fa8a0",
  red: "#b25b4e",
  focus: "#e8c884"
} as const;

export const RELATION_COLORS: Record<RelationType, string> = {
  documented_influence: "#c2a15c",
  translation: "#86a873",
  mentorship: "#dcc389",
  dialogue: "#b25b4e",
  affinity: "#5fa8a0",
  contrast: "#8e6a94"
};

/** subtle per-layer node tint — depth without shouting */
export const PERIOD_TINT: Record<PeriodId, string> = {
  roots: "#c8b28e",
  "early-modernism": "#ead0c5",
  "mid-century": "#d7e3da",
  "late-postmodern": "#dfd0e0",
  contemporary: "#c9d4e3"
};

export const GLOBE = {
  radius: 100,
  surfaceRadius: 99,
  graticuleRadius: 99.4,
  atmosphereScale: 1.045,
  arcSegments: 24
} as const;
