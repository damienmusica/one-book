import type { Tier } from "../types.ts";

// Camera distances are in globe-radius units × 100 (globe R = 100).
// MIN bounds terrain-texture magnification so the etched coast never becomes
// a rope; DEFAULT starts (and resets to) the true far view — the star chart.
export const CAMERA_MIN = 150;
export const CAMERA_MAX = 430;
export const CAMERA_DEFAULT = 360;

export type LodLevel = "far" | "mid" | "near";

export function lodLevel(cameraDistance: number): LodLevel {
  if (cameraDistance > 310) return "far";
  if (cameraDistance > 205) return "mid";
  return "near";
}

export function tierVisibleAtLod(tier: Tier, lod: LodLevel): boolean {
  if (lod === "far") return tier === "anchor";
  if (lod === "mid") return tier === "anchor" || tier === "major";
  return true;
}

/**
 * Label priority — higher shows first when screen space runs out.
 * Selection context always beats tier rank.
 */
export function labelPriority(opts: {
  tier: Tier;
  isSelected: boolean;
  isHovered: boolean;
  isNeighborOfSelected: boolean;
  facingDot: number; // dot(nodeDir, cameraDir): 1 = front center, <0 = back side
}): number {
  if (opts.facingDot < 0.05) return -1; // back hemisphere: never label
  let p = opts.facingDot * 10;
  if (opts.tier === "anchor") p += 40;
  else if (opts.tier === "major") p += 20;
  if (opts.isNeighborOfSelected) p += 60;
  if (opts.isHovered) p += 120;
  if (opts.isSelected) p += 200;
  return p;
}

/** max labels on screen per LOD level */
export function labelBudget(lod: LodLevel): number {
  if (lod === "far") return 28;
  if (lod === "mid") return 46;
  return 70;
}
