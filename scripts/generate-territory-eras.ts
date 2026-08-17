// Territory grammar v2.5 — plate tectonics keyframes (D2′ ratified
// 2026-08-17). NOT a fresh field bake: each era is a nested erosion of the
// frozen v1 plate — every nation keeps its nearest-to-core g_t share of its
// FINAL cells, so nesting (clause 3) and terminal identity (clause 2) hold
// by construction, and determinism (clause 1) comes from the seeded jitter.
//
//   npm run terrain:eras
//
// Offline, deterministic, writes data/territory.v1.eras.json.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { assembleDataset } from "../src/data/assemble.ts";
import { loadRawCollections, PKG_ROOT } from "./lib/load-node.ts";
import { eachRun, gridToVec3 } from "../src/lib/territory-geometry.ts";
import {
  decimatePolyline,
  marchingSquaresEquirect,
  stitchSegments,
  type EquirectGrid
} from "./lib/terrain.ts";
import { readFileSync } from "node:fs";

const SEED = 20260817;
const G_MIN = 0.06; // embryonic islet: futures are foreshadowed, not absent
const FOUNDING_RAMP = 5;
const JITTER = 0.05; // rad — organic accretion edges
const KEYFRAMES = [1850, 1880, 1900, 1920, 1940, 1960, 1980, 2000];

const { dataset, errors } = assembleDataset(loadRawCollections());
if (!dataset) throw new Error(`dataset failed to assemble: ${errors.join("; ")}`);

const territory = JSON.parse(
  readFileSync(join(PKG_ROOT, "data", "territory.v1.json"), "utf8")
) as {
  version: string;
  geometry: {
    gridWidth: number;
    gridHeight: number;
    authors: string[];
    ownerRle: number[][];
  };
};
const g = territory.geometry;
const W = g.gridWidth;
const ROWS = g.ownerRle.length;

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** deterministic per-cell jitter in [-1, 1] */
function jitter(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263 + SEED * 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = (h * 1274126177) >>> 0;
  return ((h >>> 8) / 0x00ffffff) * 2 - 1;
}

const authors = dataset.authors;
const allWorks = dataset.works;

/** monotone national growth share at year t */
function gAt(authorId: string, t: number): number {
  const a = authors.find((x) => x.id === authorId)!;
  const works = allWorks.filter((w) => w.authorId === authorId);
  const founding = smoothstep(a.activeRange[0] - FOUNDING_RAMP, a.activeRange[0] + FOUNDING_RAMP, t);
  const share =
    works.length === 0 ? founding : works.filter((w) => w.year <= t).length / works.length;
  return Math.min(1, G_MIN + (1 - G_MIN) * (0.5 * founding + 0.5 * share));
}

// --- decode the frozen plate ------------------------------------------------
// owner[row*W+x] = 0 sea, k = authors[k-1]
const owner = new Uint8Array(ROWS * W);
g.ownerRle.forEach((row, j) => {
  eachRun(row, (x0, count, value) => {
    owner.fill(value, j * W + x0, j * W + x0 + count);
  });
});

// per-nation accretion order: growth is CONNECTED — a cell may join only
// when adjacent to already-risen land of the same nation, so eras have
// coherent organic coasts instead of jitter speckle. Islands (disconnected
// components of the final territory) accrete internally and enter the
// sequence by their distance from the nation's core. The order is frozen
// forever (clause 1).
const nationCells = new Map<number, number[]>();
for (let i = 0; i < ROWS * W; i++) {
  const v = owner[i]!;
  if (v === 0) continue;
  let list = nationCells.get(v);
  if (!list) nationCells.set(v, (list = []));
  list.push(i);
}

const cellVec = (i: number) =>
  gridToVec3((i % W) + 0.5, Math.floor(i / W) + 0.5, W, g.gridHeight);
const angDist = (a: [number, number, number], b: [number, number, number]) =>
  Math.acos(Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));

function neighbors(i: number): number[] {
  const x = i % W;
  const y = Math.floor(i / W);
  const out = [((x + 1) % W) + y * W, ((x + W - 1) % W) + y * W];
  if (y > 0) out.push(i - W);
  if (y < ROWS - 1) out.push(i + W);
  return out;
}

const nationOrder = new Map<number, Uint32Array>();
for (const [v, cells] of nationCells) {
  const inNation = new Set(cells);
  let cx = 0,
    cy = 0,
    cz = 0;
  for (const i of cells) {
    const p = cellVec(i);
    cx += p[0];
    cy += p[1];
    cz += p[2];
  }
  const len = Math.hypot(cx, cy, cz) || 1;
  const core: [number, number, number] = [cx / len, cy / len, cz / len];

  // connected components of the final territory
  const compOf = new Map<number, number>();
  const comps: number[][] = [];
  for (const start of cells) {
    if (compOf.has(start)) continue;
    const comp: number[] = [];
    const stack = [start];
    compOf.set(start, comps.length);
    while (stack.length) {
      const c = stack.pop()!;
      comp.push(c);
      for (const n of neighbors(c)) {
        if (inNation.has(n) && !compOf.has(n)) {
          compOf.set(n, comps.length);
          stack.push(n);
        }
      }
    }
    comps.push(comp);
  }
  comps.sort(
    (a, b) =>
      Math.min(...a.map((i) => angDist(cellVec(i), core))) -
      Math.min(...b.map((i) => angDist(cellVec(i), core)))
  );

  // frontier-constrained accretion inside each component
  const order: number[] = [];
  for (const comp of comps) {
    const compSet = new Set(comp);
    const seed = comp.reduce((best, i) =>
      angDist(cellVec(i), core) < angDist(cellVec(best), core) ? i : best
    );
    const risen = new Set<number>([seed]);
    order.push(seed);
    // frontier priority = core distance + seeded jitter (organic coastline)
    const frontier: Array<{ i: number; d: number }> = [];
    const pushFrontier = (i: number) => {
      for (const n of neighbors(i)) {
        if (compSet.has(n) && !risen.has(n) && !frontier.some((f) => f.i === n)) {
          frontier.push({
            i: n,
            d: angDist(cellVec(n), core) + jitter(n % W, Math.floor(n / W)) * JITTER
          });
        }
      }
    };
    pushFrontier(seed);
    while (risen.size < comp.length) {
      let bi = 0;
      for (let k = 1; k < frontier.length; k++) {
        if (frontier[k]!.d < frontier[bi]!.d) bi = k;
      }
      const next = frontier.splice(bi, 1)[0]!;
      risen.add(next.i);
      order.push(next.i);
      pushFrontier(next.i);
    }
  }
  nationOrder.set(v, Uint32Array.from(order));
}

// --- per-keyframe masks (nested by construction) ----------------------------
function rleEncode(mask: Uint8Array): number[][] {
  const rows: number[][] = [];
  for (let j = 0; j < ROWS; j++) {
    const row: number[] = [];
    let runVal = mask[j * W]!;
    let runLen = 1;
    for (let x = 1; x < W; x++) {
      const v = mask[j * W + x]!;
      if (v === runVal) runLen++;
      else {
        row.push(runLen, runVal);
        runVal = v;
        runLen = 1;
      }
    }
    row.push(runLen, runVal);
    rows.push(row);
  }
  return rows;
}

function coastOf(mask: Uint8Array): number[][] {
  const field = new Float32Array(ROWS * W);
  for (let i = 0; i < ROWS * W; i++) field[i] = mask[i]! > 0 ? 1 : 0;
  const grid: EquirectGrid = {
    width: W,
    height: ROWS,
    field,
    owner: new Int16Array(ROWS * W)
  };
  const lines = stitchSegments(marchingSquaresEquirect(grid, 0.5));
  return lines
    .map((l) => decimatePolyline(l, 0.35))
    .filter((l) => l.length >= 3)
    .map((l) => l.flatMap(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]));
}

const keyframes: Array<{ year: number; ownerRle: number[][]; coast: number[][] }> = [];
let prevMask: Uint8Array | null = null;
for (const year of KEYFRAMES) {
  const mask = new Uint8Array(ROWS * W);
  for (const [v, cells] of nationCells) {
    const id = g.authors[v - 1]!;
    const keep = Math.max(1, Math.ceil(gAt(id, year) * cells.length));
    const order = nationOrder.get(v)!;
    for (let k = 0; k < keep; k++) mask[order[k]!] = v;
  }
  // clause 3: risen land never sinks — every kept cell must persist
  if (prevMask) {
    for (let i = 0; i < mask.length; i++) {
      if (prevMask[i]! !== 0 && mask[i] !== prevMask[i]) {
        throw new Error(`monotonicity violated at cell ${i}, year ${year}`);
      }
    }
  }
  prevMask = mask;
  keyframes.push({ year, ownerRle: rleEncode(mask), coast: coastOf(mask) });
  const landCells = mask.reduce((n, v) => n + (v > 0 ? 1 : 0), 0);
  console.log(
    `${year}: land ${((landCells / (ROWS * W)) * 100).toFixed(1)}% · coast lines ${keyframes.at(-1)!.coast.length}`
  );
}

// clause 2: the last keyframe must be a subset of the frozen v1 plate
for (let i = 0; i < prevMask!.length; i++) {
  if (prevMask![i]! !== 0 && prevMask![i] !== owner[i]) {
    throw new Error(`terminal identity violated at cell ${i}`);
  }
}

const out = {
  version: "1.0.0",
  derivedFrom: `territory ${territory.version}`,
  seed: SEED,
  params: {
    gMin: G_MIN,
    foundingRamp: FOUNDING_RAMP,
    jitterRad: JITTER,
    growth: "gMin + (1-gMin) * (0.5*foundingRamp(activeRange[0]±5) + 0.5*publishedWorksShare)",
    erosion: "nested nearest-to-core erosion of the frozen v1 plate (clause 1–3 by construction)"
  },
  keyframes
};
const outPath = join(PKG_ROOT, "data", "territory.v1.eras.json");
writeFileSync(
  outPath,
  JSON.stringify(out, (k, v) => v, 0)
    .replace('"keyframes":[', '\n"keyframes":[\n')
    .replace(/\},\{"year"/g, '},\n{"year"') + "\n"
);
console.log(`wrote ${outPath}`);
