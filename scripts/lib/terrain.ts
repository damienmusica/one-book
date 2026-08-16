// Terrain generation core (thesis v2 §②) — pure, deterministic, offline.
// The renderer never runs any of this: the generator script bakes geometry,
// and the same seed produces the same planet forever.

import { mulberry32 } from "../../src/lib/rng.ts";
import { vec3ToGrid } from "../../src/lib/territory-geometry.ts";
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

function marchCell(
  f00: number, f10: number, f01: number, f11: number,
  p00: Pt, p10: Pt, p01: Pt, p11: Pt,
  iso: number,
  segs: Array<[Pt, Pt]>
): void {
  let idx = 0;
  if (f00 >= iso) idx |= 1;
  if (f10 >= iso) idx |= 2;
  if (f11 >= iso) idx |= 4;
  if (f01 >= iso) idx |= 8;
  if (idx === 0 || idx === 15) return;
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

/** iso-contour segments of grid.field at `iso`, in grid coordinates */
export function marchingSquares(grid: HemisphereGrid, iso: number): Array<[Pt, Pt]> {
  const { n, field } = grid;
  const segs: Array<[Pt, Pt]> = [];
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      marchCell(
        field[j * n + i]!, field[j * n + i + 1]!,
        field[(j + 1) * n + i]!, field[(j + 1) * n + i + 1]!,
        [i, j], [i + 1, j], [i, j + 1], [i + 1, j + 1],
        iso, segs
      );
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

// --- equirect bake (P1, thesis §②-6/7) ---------------------------------------
// View-independent geometry for the renderer: the app draws only what is baked
// here — it never evaluates noise or kernels ("렌더러는 난수를 모른다").

export interface EquirectGrid {
  /** sample columns; x wraps (column `width` ≡ column 0) */
  width: number;
  /** sample rows, poles inclusive (row 0 = +90°, last row = −90°) */
  height: number;
  field: Float32Array;
  owner: Int16Array;
}

/**
 * Sample the field on an equirectangular grid aligned with three.js
 * SphereGeometry UVs: column i ↦ φ = 2πi/width with world point
 * p = [−cosφ·cosLat, sinLat, sinφ·cosLat], row j ↦ lat = 90° − 180°·j/(height−1).
 * A canvas texture painted in these grid coordinates therefore lands each
 * texel on the exact world point it was sampled at, on an unrotated sphere.
 */
export function rasterizeEquirect(
  kernels: AuthorKernel[],
  params: TerrainParams,
  width: number,
  height: number
): EquirectGrid {
  const field = new Float32Array(width * height);
  const owner = new Int16Array(width * height).fill(-1);
  for (let j = 0; j < height; j++) {
    const lat = Math.PI / 2 - (j / (height - 1)) * Math.PI;
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);
    for (let i = 0; i < width; i++) {
      const phi = (i / width) * Math.PI * 2;
      const p: Vec3 = [-Math.cos(phi) * cosLat, sinLat, Math.sin(phi) * cosLat];
      const s = sampleField(p, kernels, params);
      field[j * width + i] = s.value;
      owner[j * width + i] = s.owner as number;
    }
  }
  return { width, height, field, owner };
}

/**
 * Seam-aware marching squares on an equirect grid: the cell column between
 * sample W−1 and sample 0 is marched too, and points landing on x = W are
 * normalized onto column 0 so stitching closes contours across the wrap.
 */
export function marchingSquaresEquirect(grid: EquirectGrid, iso: number): Array<[Pt, Pt]> {
  const { width: W, height: H, field } = grid;
  const segs: Array<[Pt, Pt]> = [];
  for (let j = 0; j < H - 1; j++) {
    for (let i = 0; i < W; i++) {
      const i1 = (i + 1) % W;
      marchCell(
        field[j * W + i]!, field[j * W + i1]!,
        field[(j + 1) * W + i]!, field[(j + 1) * W + i1]!,
        [i, j], [i + 1, j], [i, j + 1], [i + 1, j + 1],
        iso, segs
      );
    }
  }
  for (const seg of segs) {
    for (const p of seg) if (p[0] >= W) p[0] -= W;
  }
  return segs;
}

/** owner borders between adjacent land samples, seam-aware */
export function boundarySegmentsEquirect(grid: EquirectGrid, iso: number): Array<[Pt, Pt]> {
  const { width: W, height: H, field, owner } = grid;
  const segs: Array<[Pt, Pt]> = [];
  const land = (j: number, i: number) => field[j * W + i]! >= iso;
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const i1 = (i + 1) % W;
      if (land(j, i) && land(j, i1) && owner[j * W + i] !== owner[j * W + i1]) {
        segs.push([[i + 0.5, j - 0.5], [i + 0.5, j + 0.5]]);
      }
      if (j + 1 < H && land(j, i) && land(j + 1, i) && owner[j * W + i] !== owner[(j + 1) * W + i]) {
        // i = 0 emits x = −0.5, i.e. the seam edge; wrap it into range
        segs.push([[i === 0 ? W - 0.5 : i - 0.5, j + 0.5], [i + 0.5, j + 0.5]]);
      }
    }
  }
  return segs;
}

/**
 * Douglas–Peucker with fixed endpoints. Closed loops (first == last) are
 * anchored at the point farthest from the start so simplification cannot
 * collapse them. Every dropped point stays within `eps` of the kept chain.
 */
export function decimatePolyline(line: Pt[], eps: number): Pt[] {
  const n = line.length;
  if (n <= 2) return line.slice();
  const perpDist = (p: Pt, a: Pt, b: Pt): number => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-12) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  };
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack: Array<[number, number]> = [];
  const closed = line[0]![0] === line[n - 1]![0] && line[0]![1] === line[n - 1]![1];
  if (closed && n > 3) {
    let m = 1;
    let best = -1;
    for (let i = 1; i < n - 1; i++) {
      const d = Math.hypot(line[i]![0] - line[0]![0], line[i]![1] - line[0]![1]);
      if (d > best) {
        best = d;
        m = i;
      }
    }
    keep[m] = 1;
    stack.push([0, m], [m, n - 1]);
  } else {
    stack.push([0, n - 1]);
  }
  while (stack.length > 0) {
    const [a, b] = stack.pop()!;
    if (b - a < 2) continue;
    let idx = -1;
    let dmax = eps;
    for (let i = a + 1; i < b; i++) {
      const d = perpDist(line[i]!, line[a]!, line[b]!);
      if (d > dmax) {
        dmax = d;
        idx = i;
      }
    }
    if (idx >= 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(line[i]!);
  return out;
}

/**
 * Per-sample-row owner runs as [count, value, count, value, …]: value 0 = sea,
 * k > 0 = kernels[k−1]. The south-pole sample row is omitted — run row j
 * paints the cell band between sample rows j and j+1.
 */
export function encodeOwnerRle(grid: EquirectGrid, tau: number): number[][] {
  const rows: number[][] = [];
  for (let j = 0; j < grid.height - 1; j++) {
    const row: number[] = [];
    let runVal = -1;
    let runLen = 0;
    for (let i = 0; i < grid.width; i++) {
      const idx = j * grid.width + i;
      const v = grid.field[idx]! >= tau && grid.owner[idx]! >= 0 ? grid.owner[idx]! + 1 : 0;
      if (v === runVal) {
        runLen++;
      } else {
        if (runLen > 0) row.push(runLen, runVal);
        runVal = v;
        runLen = 1;
      }
    }
    if (runLen > 0) row.push(runLen, runVal);
    rows.push(row);
  }
  return rows;
}

export interface BakeOptions {
  gridWidth: number;
  gridHeight: number;
  waterGridWidth: number;
  waterGridHeight: number;
}

export const DEFAULT_BAKE: BakeOptions = {
  gridWidth: 1024,
  gridHeight: 513,
  waterGridWidth: 512,
  waterGridHeight: 257
};

export interface BakedGeometry {
  gridWidth: number;
  gridHeight: number;
  /** owner-index palette: RLE value k > 0 refers to authors[k−1] */
  authors: string[];
  /** closed coast loops (τ iso), flat [x,y,…] in grid coords, x ∈ [0, gridWidth) */
  coast: number[][];
  waterlines: {
    gridWidth: number;
    gridHeight: number;
    /** iso levels as fractions of τ: [inner, outer] */
    isoFactors: [number, number];
    inner: number[][];
    outer: number[][];
  };
  /** open territory borders on land, same coordinate convention as coast */
  boundaries: number[][];
  ownerRle: number[][];
  /** P3: works as towns, reading entries as ports, reading orders as roads */
  cities?: Record<string, AuthorCities>;
}

function unwrapPts(line: Pt[], width: number): Pt[] {
  const out: Pt[] = [line[0]!.slice() as Pt];
  for (let k = 1; k < line.length; k++) {
    const prev = out[k - 1]![0];
    let x = line[k]![0];
    while (x - prev > width / 2) x -= width;
    while (prev - x > width / 2) x += width;
    out.push([x, line[k]![1]]);
  }
  return out;
}

function toFlatWrapped(line: Pt[], width: number): number[] {
  const flat: number[] = [];
  for (const [x, y] of line) {
    let xr = Math.round(x * 10) / 10;
    const yr = Math.round(y * 10) / 10;
    xr = ((xr % width) + width) % width;
    flat.push(xr, yr);
  }
  return flat;
}

/**
 * Consumers reconstruct seam wraps from step continuity (nearest
 * representative), so no stored step may span more than half the width —
 * long straight runs (polar rings) get midpoints re-inserted.
 */
function densifyUnwrapped(line: Pt[], width: number): Pt[] {
  const maxDx = width / 4;
  const out: Pt[] = [line[0]!];
  for (let k = 1; k < line.length; k++) {
    const a = out[out.length - 1]!;
    const b = line[k]!;
    const steps = Math.max(1, Math.ceil(Math.abs(b[0] - a[0]) / maxDx));
    for (let s = 1; s <= steps; s++) {
      out.push([a[0] + ((b[0] - a[0]) * s) / steps, a[1] + ((b[1] - a[1]) * s) / steps]);
    }
  }
  return out;
}

function contourFlat(
  grid: EquirectGrid,
  iso: number,
  eps: number,
  what: string
): number[][] {
  const lines = stitchSegments(marchingSquaresEquirect(grid, iso));
  const out: number[][] = [];
  for (const raw of lines) {
    const line = unwrapPts(raw, grid.width);
    // near-node crossings orphan micro-segments (classic marching-squares
    // degeneracy); the real ring routes around them — drop the dust
    let arc = 0;
    for (let k = 1; k < line.length; k++) {
      arc += Math.hypot(line[k]![0] - line[k - 1]![0], line[k]![1] - line[k - 1]![1]);
    }
    if (arc < 1) continue;
    const first = line[0]!;
    const last = line[line.length - 1]!;
    // Level sets on the sphere close, but the equirect chart has two shapes of
    // "closed": an ordinary loop (endpoints coincide) or a polar ring around a
    // pole (endpoints coincide modulo one horizontal wrap — the affinity layout
    // does put authors near the poles). Anything else is a bake bug. Tolerance
    // sits above the stitch key precision (1e-3) to absorb float dust.
    const dx = Math.abs(last[0] - first[0]);
    const dy = Math.abs(last[1] - first[1]);
    const ordinary = dx < 0.02 && dy < 0.02;
    const polar = Math.abs(dx - grid.width) < 0.02 && dy < 0.02;
    if (!ordinary && !polar) {
      throw new Error(
        `open ${what} contour (${line.length} pts) at [${first[0].toFixed(1)},${first[1].toFixed(1)}]…[${last[0].toFixed(1)},${last[1].toFixed(1)}]`
      );
    }
    const dec = decimatePolyline(line, eps);
    if (dec.length < 4 && !polar) continue; // sub-texel islet — invisible dust
    out.push(toFlatWrapped(densifyUnwrapped(dec, grid.width), grid.width));
  }
  return out;
}

/** the whole renderer-facing bake: contours + borders + owner raster + cities */
export function bakeGeometry(
  kernels: AuthorKernel[],
  params: TerrainParams,
  opts: BakeOptions = DEFAULT_BAKE,
  cityInput?: CityBakeInput
): BakedGeometry {
  const grid = rasterizeEquirect(kernels, params, opts.gridWidth, opts.gridHeight);
  const coast = contourFlat(grid, params.tau, 0.35, "coast");

  const boundaries: number[][] = [];
  for (const raw of stitchSegments(boundarySegmentsEquirect(grid, params.tau))) {
    const dec = decimatePolyline(unwrapPts(raw, grid.width), 1.3);
    if (dec.length < 2) continue;
    boundaries.push(toFlatWrapped(densifyUnwrapped(dec, grid.width), grid.width));
  }

  const waterGrid = rasterizeEquirect(kernels, params, opts.waterGridWidth, opts.waterGridHeight);
  const waterlines = {
    gridWidth: opts.waterGridWidth,
    gridHeight: opts.waterGridHeight,
    isoFactors: [0.72, 0.5] as [number, number],
    inner: contourFlat(waterGrid, params.tau * 0.72, 0.5, "inner waterline"),
    outer: contourFlat(waterGrid, params.tau * 0.5, 0.5, "outer waterline")
  };

  return {
    gridWidth: opts.gridWidth,
    gridHeight: opts.gridHeight,
    authors: kernels.map((k) => k.id),
    coast,
    waterlines,
    boundaries,
    ownerRle: encodeOwnerRle(grid, params.tau),
    ...(cityInput ? { cities: bakeCities(grid, kernels, params.tau, cityInput) } : {})
  };
}

// --- P3: cities, ports, roads ------------------------------------------------
// Works become towns inside their author's territory, the reading entry
// becomes the port (the coast cell nearest the capital), and the reading
// order becomes the road. All seeded per author — the atlas never reshuffles.

export interface AuthorCities {
  /** [x, y] coast town where the reading enters; null for landlocked realms */
  port: [number, number] | null;
  portWork: string | null;
  towns: Array<{ id: string; x: number; y: number }>;
  /** reading route: port (or capital) → readingOrder towns, flat [x,y,…] */
  road: number[];
}

export interface CityBakeInput {
  /** author id → work ids, readingOrder first, remainder in stable order */
  worksByAuthor: Map<string, string[]>;
  readingEntry: Map<string, string>;
  readingOrder: Map<string, string[]>;
}

function cityHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}

/** wrap-aware grid distance with a cos-lat correction on the x axis */
function gridDist(a: [number, number], b: [number, number], W: number, H: number): number {
  let dx = Math.abs(a[0] - b[0]);
  if (dx > W / 2) dx = W - dx;
  const midLat = Math.PI / 2 - (((a[1] + b[1]) / 2) / (H - 1)) * Math.PI;
  return Math.hypot(dx * Math.cos(midLat), a[1] - b[1]);
}

export function bakeCities(
  grid: EquirectGrid,
  kernels: AuthorKernel[],
  tau: number,
  input: CityBakeInput
): Record<string, AuthorCities> {
  const { width: W, height: H, field, owner } = grid;
  const land = (i: number, j: number) => field[j * W + i]! >= tau;

  // owner index → that author's land cells and coast cells, one scan
  const cells = new Map<number, Array<[number, number]>>();
  const coast = new Map<number, Array<[number, number]>>();
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      if (!land(i, j)) continue;
      const k = owner[j * W + i]!;
      if (k < 0) continue;
      let list = cells.get(k);
      if (!list) cells.set(k, (list = []));
      list.push([i, j]);
      const iL = (i - 1 + W) % W;
      const iR = (i + 1) % W;
      const seaAdj =
        !land(iL, j) || !land(iR, j) || (j > 0 && !land(i, j - 1)) || (j < H - 1 && !land(i, j + 1));
      if (seaAdj) {
        let cl = coast.get(k);
        if (!cl) coast.set(k, (cl = []));
        cl.push([i, j]);
      }
    }
  }

  const out: Record<string, AuthorCities> = {};
  kernels.forEach((kernel, k) => {
    const id = kernel.id;
    const works = input.worksByAuthor.get(id) ?? [];
    const myCells = cells.get(k) ?? [];
    const capital = vec3ToGrid(kernel.seed, W, H);
    if (works.length === 0 || myCells.length === 0) {
      out[id] = { port: null, portWork: null, towns: [], road: [] };
      return;
    }
    const rand = mulberry32(cityHash(id));

    // port: coast cell nearest the capital (deterministic scan-order tie-break)
    const myCoast = coast.get(k) ?? [];
    let port: [number, number] | null = null;
    let best = Infinity;
    for (const c of myCoast) {
      const d = gridDist([c[0] + 0.5, c[1]], capital, W, H);
      if (d < best) {
        best = d;
        port = [c[0] + 0.5, c[1]];
      }
    }
    const entry = input.readingEntry.get(id) ?? null;

    // towns by farthest-point sampling over the author's own land cells —
    // spread out from the capital, the port, and one another
    const anchors: Array<[number, number]> = [capital];
    if (port) anchors.push(port);
    const towns: AuthorCities["towns"] = [];
    const townPos = new Map<string, [number, number]>();
    for (const workId of works) {
      // the port town IS the reading entry — it sits at the harbor
      if (port && workId === entry) {
        towns.push({ id: workId, x: round1(port[0]), y: round1(port[1]) });
        townPos.set(workId, port);
        continue;
      }
      const tries = Math.min(myCells.length, 200);
      let bestCell: [number, number] | null = null;
      let bestScore = -1;
      for (let t = 0; t < tries; t++) {
        const c = myCells[Math.floor(rand() * myCells.length)]!;
        const p: [number, number] = [c[0] + 0.5, c[1] + 0.5];
        let minD = Infinity;
        for (const a of anchors) minD = Math.min(minD, gridDist(p, a, W, H));
        if (minD > bestScore) {
          bestScore = minD;
          bestCell = p;
        }
      }
      const p: [number, number] = [
        bestCell![0] + (rand() - 0.5) * 0.7,
        bestCell![1] + (rand() - 0.5) * 0.7
      ];
      anchors.push(p);
      towns.push({ id: workId, x: round1(((p[0] % W) + W) % W), y: round1(p[1]) });
      townPos.set(workId, p);
    }

    // road: harbor (or capital, when landlocked) → reading order
    const road: number[] = [];
    const start = port ?? capital;
    road.push(round1(start[0]), round1(start[1]));
    for (const workId of input.readingOrder.get(id) ?? []) {
      const p = townPos.get(workId);
      if (!p) continue;
      const last: [number, number] = [road[road.length - 2]!, road[road.length - 1]!];
      if (Math.abs(p[0] - last[0]) < 1e-9 && Math.abs(p[1] - last[1]) < 1e-9) continue;
      road.push(round1(((p[0] % W) + W) % W), round1(p[1]));
    }

    out[id] = {
      port: port ? [round1(port[0]), round1(port[1])] : null,
      portWork: port && entry && townPos.has(entry) ? entry : null,
      towns,
      road: road.length >= 4 ? road : []
    };
  });
  return out;
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
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
