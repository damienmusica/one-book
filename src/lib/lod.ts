import type { Tier } from "../types.ts";

// Camera distances are absolute scene units (globe R = 118 since the
// 2026-08-17 planet-scale directive — distances kept, so every threshold now
// sits relatively closer to a larger surface). MIN bounds terrain-texture
// magnification so the etched coast never becomes a rope (the near plate
// densified to cell 8 alongside the scale-up); DEFAULT starts (and resets
// to) the true far view — the star chart.
export const CAMERA_MIN = 150;
export const CAMERA_MAX = 430;
export const CAMERA_DEFAULT = 360;

export type LodLevel = "far" | "mid" | "near";

export function lodLevel(cameraDistance: number): LodLevel {
  if (cameraDistance > 310) return "far";
  if (cameraDistance > 205) return "mid";
  return "near";
}

// Hysteresis (7th review PR1): the single 310/205 cut let wheel/damping
// oscillation at a boundary rebuild nodes/labels/edges/clusters every frame.
// Entering a closer tier and leaving it now happen at different distances,
// and any change is followed by a minimum dwell before the next one.
export const LOD_ENTER_MID = 300;
export const LOD_EXIT_MID = 320;
export const LOD_ENTER_NEAR = 195;
export const LOD_EXIT_NEAR = 215;
export const LOD_DWELL_MS = 120;

export class LodGate {
  tier: LodLevel;
  transitions = 0;
  private lastChange = -1e9;

  constructor(cameraDistance: number) {
    this.tier = lodLevel(cameraDistance);
  }

  /** returns the (possibly unchanged) tier for this frame */
  update(cameraDistance: number, now: number): LodLevel {
    let want: LodLevel = this.tier;
    if (this.tier === "far") {
      if (cameraDistance < LOD_ENTER_NEAR) want = "near";
      else if (cameraDistance < LOD_ENTER_MID) want = "mid";
    } else if (this.tier === "mid") {
      if (cameraDistance < LOD_ENTER_NEAR) want = "near";
      else if (cameraDistance > LOD_EXIT_MID) want = "far";
    } else {
      if (cameraDistance > LOD_EXIT_MID) want = "far";
      else if (cameraDistance > LOD_EXIT_NEAR) want = "mid";
    }
    if (want !== this.tier && now - this.lastChange >= LOD_DWELL_MS) {
      this.tier = want;
      this.lastChange = now;
      this.transitions++;
    }
    return this.tier;
  }
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
