// Terrain generation core (thesis v2 §②) — pure, deterministic, offline.
// The renderer never runs any of this: the generator script bakes geometry,
// and the same seed produces the same planet forever.

import { mulberry32 } from "../../src/lib/rng.ts";
import type { Dataset } from "../../src/types.ts";
import type { Vec3 } from "../../src/lib/sphere.ts";

export interface TerrainParams {
  seed: number;
  /** base angular radius (rad); territory radius = R0 * sqrt(W) */
  R0: number;
  /** land threshold on the kernel field */
  tau: number;
  /** domain-warp amplitude (chordal units) */
  warpAmp: number;
  /** domain-warp base frequency */
  warpFreq: number;
  warpOctaves: number;
}

export const DEFAULT_PARAMS: TerrainParams = {
  seed: 20260815,
  R0: 0.11,
  tau: 0.5,
  warpAmp: 0.1,
  warpFreq: 3.2,
  warpOctaves: 3
};

// --- thesis §②-2: area weight = tier base × (1 + β·normalized degree) -------

const TIER_BASE: Record<string, number> = { anchor: 2.4, major: 1.0, context: 0.55 };
const BETA = 0.3;

export function computeWeights(dataset: Dataset): Map<string, number> {
  const degree = new Map<string, number>();
  for (const a of dataset.authors) degree.set(a.id, 0);
  for (const r of dataset.relations) {
    degree.set(r.sourceId, (degree.get(r.sourceId) ?? 0) + r.weight);
    degree.set(r.targetId, (degree.get(r.targetId) ?? 0) + r.weight);
  }
  const values = [...degree.values()];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const weights = new Map<string, number>();
  for (const a of dataset.authors) {
    const dHat = ((degree.get(a.id) ?? 0) - min) / span;
    weights.set(a.id, (TIER_BASE[a.tier] ?? 1) * (1 + BETA * dHat));
  }
  return weights;
}

// --- seeded 3D value noise ---------------------------------------------------

function latticeRand(ix: number, iy: number, iz: number, seed: number): number {
  let n = (ix * 15731) ^ (iy * 789221) ^ (iz * 1376312589) ^ seed;
  n = n | 0;
  return mulberry32(n)();
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise3(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const fz = smooth(z - iz);
  let acc = 0;
  for (let dz = 0; dz <= 1; dz++) {
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        const w =
          (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz);
        acc += w * latticeRand(ix + dx, iy + dy, iz + dz, seed);
      }
    }
  }
  return acc;
}

function fbm3(x: number, y: number, z: number, seed: number, octaves: number): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise3(x * freq, y * freq, z * freq, seed + o * 7919);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/** thesis §②-3: noise perturbs geometry only, never surface texture */
export function warpPoint(p: Vec3, params: TerrainParams): Vec3 {
  const f = params.warpFreq;
  const nx = fbm3(p[0] * f, p[1] * f, p[2] * f, params.seed ^ 0x1111, params.warpOctaves) - 0.5;
  const ny = fbm3(p[0] * f, p[1] * f, p[2] * f, params.seed ^ 0x2222, params.warpOctaves) - 0.5;
  const nz = fbm3(p[0] * f, p[1] * f, p[2] * f, params.seed ^ 0x3333, params.warpOctaves) - 0.5;
  const a = params.warpAmp * 2;
  const x = p[0] + nx * a;
  const y = p[1] + ny * a;
  const z = p[2] + nz * a;
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
}

// --- kernel field ------------------------------------------------------------

export interface AuthorKernel {
  id: string;
  seed: Vec3;
  /** von Mises–Fisher-style falloff: exp(kappa * (dot - 1)) */
  kappa: number;
  /** dot-product cutoff beyond which the contribution is negligible */
  cutoff: number;
  radius: number;
}

export function buildKernels(
  seeds: Map<string, Vec3>,
  weights: Map<string, number>,
  params: TerrainParams
): AuthorKernel[] {
  const kernels: AuthorKernel[] = [];
  for (const [id, seed] of seeds) {
    const w = weights.get(id) ?? 1;
    const radius = params.R0 * Math.sqrt(w);
    const kappa = Math.LN2 / (1 - Math.cos(radius));
    const cutoff = Math.cos(Math.min(radius * 4, Math.PI));
    kernels.push({ id, seed, kappa, cutoff, radius });
  }
  return kernels.sort((a, b) => a.id.localeCompare(b.id));
}

export interface FieldSample {
  value: number;
  /** index into the kernels array of the strongest contributor, -1 = none */
  owner: number;
}

export function sampleField(p: Vec3, kernels: AuthorKernel[], params: TerrainParams): FieldSample {
  const q = warpPoint(p, params);
  let value = 0;
  let owner = -1;
  let best = 0;
  // capitals must stay ashore: each kernel's unwarped self-contribution is a
  // floor, so warp can wilden coasts but never sink a seed's core
  let rescue = 0;
  let rescueOwner = -1;
  for (let i = 0; i < kernels.length; i++) {
    const k = kernels[i]!;
    const dot = q[0] * k.seed[0] + q[1] * k.seed[1] + q[2] * k.seed[2];
    const rawDot = p[0] * k.seed[0] + p[1] * k.seed[1] + p[2] * k.seed[2];
    if (dot >= k.cutoff) {
      const contrib = Math.exp(k.kappa * (dot - 1));
      value += contrib;
      if (contrib > best) {
        best = contrib;
        owner = i;
      }
    }
    if (rawDot >= k.cutoff) {
      const raw = Math.exp(k.kappa * (rawDot - 1));
      if (raw > rescue) {
        rescue = raw;
        rescueOwner = i;
      }
    }
  }
  if (rescue > value) {
    return { value: rescue, owner: rescueOwner };
  }
  return { value, owner };
}

// --- hemisphere raster (orthographic disc, regular 2D grid) ------------------

export interface HemisphereGrid {
  n: number;
  /** field value per sample, row-major; sea/outside-disc = 0 */
  field: Float32Array;
  /** owner kernel index per sample, -1 for none/outside */
  owner: Int16Array;
  right: Vec3;
  up: Vec3;
  forward: Vec3;
}

export function orthoBasis(forward: Vec3): { right: Vec3; up: Vec3; forward: Vec3 } {
  const f = forward;
  const refUp: Vec3 = Math.abs(f[1]) > 0.92 ? [1, 0, 0] : [0, 1, 0];
  const rx = refUp[1] * f[2] - refUp[2] * f[1];
  const ry = refUp[2] * f[0] - refUp[0] * f[2];
  const rz = refUp[0] * f[1] - refUp[1] * f[0];
  const rl = Math.hypot(rx, ry, rz) || 1;
  const right: Vec3 = [rx / rl, ry / rl, rz / rl];
  const ux = f[1] * right[2] - f[2] * right[1];
  const uy = f[2] * right[0] - f[0] * right[2];
  const uz = f[0] * right[1] - f[1] * right[0];
  return { right, up: [ux, uy, uz], forward: f };
}

export function rasterizeHemisphere(
  forward: Vec3,
  kernels: AuthorKernel[],
  params: TerrainParams,
  n: number
): HemisphereGrid {
  const { right, up } = orthoBasis(forward);
  const field = new Float32Array(n * n);
  const owner = new Int16Array(n * n).fill(-1);
  for (let j = 0; j < n; j++) {
    const v = (j / (n - 1)) * 2 - 1;
    for (let i = 0; i < n; i++) {
      const u = (i / (n - 1)) * 2 - 1;
      const rr = u * u + v * v;
      if (rr > 1) continue;
      const w = Math.sqrt(1 - rr);
      const p: Vec3 = [
        u * right[0] + v * up[0] + w * forward[0],
        u * right[1] + v * up[1] + w * forward[1],
        u * right[2] + v * up[2] + w * forward[2]
      ];
      const s = sampleField(p, kernels, params);
      field[j * n + i] = s.value;
      owner[j * n + i] = s.owner as number;
    }
  }
  return { n, field, owner, right, up, forward };
}

// --- marching squares + stitching -------------------------------------------

type Pt = [number, number];

function interp(a: Pt, b: Pt, fa: number, fb: number, iso: number): Pt {
  const t = (iso - fa) / (fb - fa || 1e-9);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** iso-contour segments of grid.field at `iso`, in grid coordinates */
export function marchingSquares(grid: HemisphereGrid, iso: number): Array<[Pt, Pt]> {
  const { n, field } = grid;
  const segs: Array<[Pt, Pt]> = [];
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const f00 = field[j * n + i]!;
      const f10 = field[j * n + i + 1]!;
      const f01 = field[(j + 1) * n + i]!;
      const f11 = field[(j + 1) * n + i + 1]!;
      let idx = 0;
      if (f00 >= iso) idx |= 1;
      if (f10 >= iso) idx |= 2;
      if (f11 >= iso) idx |= 4;
      if (f01 >= iso) idx |= 8;
      if (idx === 0 || idx === 15) continue;
      const p00: Pt = [i, j];
      const p10: Pt = [i + 1, j];
      const p01: Pt = [i, j + 1];
      const p11: Pt = [i + 1, j + 1];
      const top = () => interp(p00, p10, f00, f10, iso);
      const bottom = () => interp(p01, p11, f01, f11, iso);
      const left = () => interp(p00, p01, f00, f01, iso);
      const rightE = () => interp(p10, p11, f10, f11, iso);
      const emit = (a: Pt, b: Pt) => segs.push([a, b]);
      switch (idx) {
        case 1: case 14: emit(left(), top()); break;
        case 2: case 13: emit(top(), rightE()); break;
        case 3: case 12: emit(left(), rightE()); break;
        case 4: case 11: emit(rightE(), bottom()); break;
        case 6: case 9: emit(top(), bottom()); break;
        case 7: case 8: emit(left(), bottom()); break;
        case 5: emit(left(), top()); emit(rightE(), bottom()); break;
        case 10: emit(top(), rightE()); emit(left(), bottom()); break;
      }
    }
  }
  return segs;
}

/**
 * Stitch loose segments into polylines. Marching squares emits segments with
 * arbitrary orientation, so both endpoints are indexed and a segment may be
 * traversed in either direction; closed contours come back as closed loops.
 */
export function stitchSegments(segs: Array<[Pt, Pt]>): Pt[][] {
  const key = (p: Pt) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`;
  const byPoint = new Map<string, Array<{ idx: number; end: 0 | 1 }>>();
  const push = (p: Pt, idx: number, end: 0 | 1) => {
    const k = key(p);
    const list = byPoint.get(k) ?? [];
    list.push({ idx, end });
    byPoint.set(k, list);
  };
  segs.forEach(([a, b], idx) => {
    push(a, idx, 0);
    push(b, idx, 1);
  });
  const used = new Uint8Array(segs.length);
  const take = (p: Pt): { idx: number; end: 0 | 1 } | undefined => {
    const list = byPoint.get(key(p));
    while (list && list.length > 0) {
      const cand = list.pop()!;
      if (!used[cand.idx]) return cand;
    }
    return undefined;
  };
  const lines: Pt[][] = [];
  for (let s = 0; s < segs.length; s++) {
    if (used[s]) continue;
    used[s] = 1;
    const line: Pt[] = [segs[s]![0], segs[s]![1]];
    // extend at the tail; entering a segment at endpoint `end` exits at 1-end
    for (;;) {
      const next = take(line[line.length - 1]!);
      if (next === undefined) break;
      used[next.idx] = 1;
      line.push(segs[next.idx]![next.end === 0 ? 1 : 0]);
    }
    // extend at the head the same way
    for (;;) {
      const prev = take(line[0]!);
      if (prev === undefined) break;
      used[prev.idx] = 1;
      line.unshift(segs[prev.idx]![prev.end === 0 ? 1 : 0]);
    }
    lines.push(line);
  }
  return lines;
}

/** internal territory boundaries: edges between two different land owners */
export function boundarySegments(grid: HemisphereGrid, iso: number): Array<[Pt, Pt]> {
  const { n, field, owner } = grid;
  const segs: Array<[Pt, Pt]> = [];
  const land = (j: number, i: number) => field[j * n + i]! >= iso;
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      if (land(j, i) && land(j, i + 1) && owner[j * n + i] !== owner[j * n + i + 1]) {
        segs.push([[i + 0.5, j - 0.5], [i + 0.5, j + 0.5]]);
      }
      if (land(j, i) && land(j + 1, i) && owner[j * n + i] !== owner[(j + 1) * n + i]) {
        segs.push([[i - 0.5, j + 0.5], [i + 0.5, j + 0.5]]);
      }
    }
  }
  return segs;
}

// --- area accounting (gate ③: does the hierarchy read?) ----------------------

/** approximate per-author share of total land area over the full sphere */
export function landAreas(
  kernels: AuthorKernel[],
  params: TerrainParams,
  latSamples = 240
): { shares: Map<string, number>; landFraction: number } {
  const counts = new Map<string, number>();
  let landW = 0;
  let totalW = 0;
  for (let j = 0; j < latSamples; j++) {
    const lat = ((j + 0.5) / latSamples) * Math.PI - Math.PI / 2;
    const cosLat = Math.cos(lat);
    const lonSamples = Math.max(8, Math.round(latSamples * 2 * cosLat));
    for (let i = 0; i < lonSamples; i++) {
      const lon = ((i + 0.5) / lonSamples) * Math.PI * 2 - Math.PI;
      const p: Vec3 = [cosLat * Math.cos(lon), Math.sin(lat), cosLat * Math.sin(lon)];
      totalW += 1;
      const s = sampleField(p, kernels, params);
      if (s.value >= params.tau && s.owner >= 0) {
        landW += 1;
        const id = kernels[s.owner]!.id;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
  }
  const shares = new Map<string, number>();
  for (const [id, c] of counts) shares.set(id, c / totalW);
  return { shares, landFraction: landW / totalW };
}
