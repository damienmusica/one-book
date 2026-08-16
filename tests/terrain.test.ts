import { describe, expect, it } from "vitest";
import {
  DEFAULT_PARAMS,
  bakeGeometry,
  buildKernels,
  computeWeights,
  decimatePolyline,
  landAreas,
  marchingSquares,
  rasterizeEquirect,
  rasterizeHemisphere,
  sampleField,
  stitchSegments,
  warpPoint
} from "../scripts/lib/terrain.ts";
import { eachRun, loopWinding, unwrapFlatX } from "../src/lib/territory-geometry.ts";
import { makeAuthor, makeDataset, makeRelation } from "./fixtures.ts";
import type { Vec3 } from "../src/lib/sphere.ts";

const P = { ...DEFAULT_PARAMS, R0: 0.12, tau: 0.6, warpAmp: 0.1 };

function seedsOf(ids: string[]): Map<string, Vec3> {
  const m = new Map<string, Vec3>();
  ids.forEach((id, i) => {
    const phi = (i / ids.length) * Math.PI * 2;
    m.set(id, [Math.cos(phi), 0.2 * ((i % 3) - 1), Math.sin(phi)]);
  });
  for (const [k, v] of m) {
    const l = Math.hypot(...v);
    m.set(k, [v[0] / l, v[1] / l, v[2] / l]);
  }
  return m;
}

describe("terrain determinism", () => {
  it("same seed produces identical fields, different seed diverges", () => {
    const seeds = seedsOf(["a", "b", "c"]);
    const w = new Map([["a", 2.4], ["b", 1], ["c", 1]]);
    const k1 = buildKernels(seeds, w, P);
    const g1 = rasterizeHemisphere([0, 0, 1], k1, P, 64);
    const g2 = rasterizeHemisphere([0, 0, 1], k1, P, 64);
    expect(Array.from(g1.field)).toEqual(Array.from(g2.field));
    expect(Array.from(g1.owner)).toEqual(Array.from(g2.owner));

    const P2 = { ...P, seed: P.seed + 1 };
    const g3 = rasterizeHemisphere([0, 0, 1], buildKernels(seeds, w, P2), P2, 64);
    expect(Array.from(g3.field)).not.toEqual(Array.from(g1.field));
  });

  it("warp is deterministic and stays on the unit sphere", () => {
    const p: Vec3 = [0.3, 0.5, Math.sqrt(1 - 0.09 - 0.25)];
    const a = warpPoint(p, P);
    const b = warpPoint(p, P);
    expect(a).toEqual(b);
    expect(Math.hypot(...a)).toBeCloseTo(1, 10);
    expect(a).not.toEqual(p);
  });
});

describe("area weights (thesis §②-2)", () => {
  it("tier is primary, graph degree modulates within ±30%", () => {
    const ds = makeDataset(
      [
        makeAuthor({ id: "anchor-quiet", tier: "anchor" }),
        makeAuthor({ id: "major-loud", tier: "major" }),
        makeAuthor({ id: "major-quiet", tier: "major" })
      ],
      [makeRelation("major-loud", "anchor-quiet", "documented_influence", { weight: 1 })]
    );
    const w = computeWeights(ds);
    // a connected anchor outweighs the equally-connected major (tier primacy)
    expect(w.get("anchor-quiet")!).toBeGreaterThan(w.get("major-loud")!);
    // degree modulation stays within the +30% cap
    expect(w.get("major-loud")!).toBeLessThanOrEqual(1.3 + 1e-9);
    expect(w.get("major-loud")!).toBeGreaterThan(w.get("major-quiet")!);
  });
});

describe("capitals stay ashore", () => {
  it("every seed's own position is at or above its kernel floor", () => {
    const seeds = seedsOf(["a", "b", "c", "d", "e"]);
    const w = new Map([...seeds.keys()].map((k) => [k, 1]));
    const kernels = buildKernels(seeds, w, P);
    for (const [, p] of seeds) {
      const s = sampleField(p, kernels, P);
      // unwarped self-contribution floor guarantees >= 1 at the seed itself
      expect(s.value).toBeGreaterThanOrEqual(1 - 1e-9);
    }
  });
});

describe("marching squares", () => {
  it("extracts a closed loop around a single cap", () => {
    const seeds = new Map<string, Vec3>([["solo", [0, 0, 1]]]);
    const w = new Map([["solo", 1.5]]);
    const kernels = buildKernels(seeds, w, { ...P, warpAmp: 0 });
    const grid = rasterizeHemisphere([0, 0, 1], kernels, { ...P, warpAmp: 0 }, 96);
    const loops = stitchSegments(marchingSquares(grid, P.tau));
    expect(loops.length).toBeGreaterThan(0);
    const main = loops.sort((a, b) => b.length - a.length)[0]!;
    const first = main[0]!;
    const last = main[main.length - 1]!;
    // the dominant contour closes on itself
    expect(Math.hypot(first[0] - last[0], first[1] - last[1])).toBeLessThan(0.01);
  });
});

// --- P1: renderer-facing equirect bake ---------------------------------------

describe("equirect bake (P1)", () => {
  // an anchor sitting exactly on the texture seam (φ = 0 ↦ [−1, 0, 0]) plus a
  // mid-longitude major — the bake must wrap the seam invisibly
  const BP = { ...P, R0: 0.3 };
  const seeds = new Map<string, Vec3>([
    ["seam-anchor", [-1, 0, 0]],
    ["mid-major", [0.2 / Math.hypot(0.2, 0.15, 0.97), 0.15 / Math.hypot(0.2, 0.15, 0.97), 0.97 / Math.hypot(0.2, 0.15, 0.97)]]
  ]);
  const weights = new Map([
    ["seam-anchor", 2.4],
    ["mid-major", 1]
  ]);
  const kernels = buildKernels(seeds, weights, BP);
  const opts = { gridWidth: 128, gridHeight: 65, waterGridWidth: 64, waterGridHeight: 33 };

  it("closes every coast and waterline loop, including across the seam", () => {
    const g = bakeGeometry(kernels, BP, opts);
    expect(g.coast.length).toBeGreaterThan(0);
    const allLoops = [...g.coast, ...g.waterlines.inner, ...g.waterlines.outer];
    for (const line of allLoops) {
      const width = g.coast.includes(line) ? g.gridWidth : g.waterlines.gridWidth;
      const un = unwrapFlatX(line, width);
      const dx = un[un.length - 2]! - un[0]!;
      const dy = un[un.length - 1]! - un[1]!;
      expect(Math.hypot(dx, dy)).toBeLessThan(1e-6);
      expect(loopWinding(un, width)).toBe(0);
    }
    // the seam anchor's land reaches the equator row from both sides of the
    // wrap: first and last run of the row carry the same owner
    const equator = g.ownerRle[Math.floor(g.ownerRle.length / 2)]!;
    const firstVal = equator[1]!;
    const lastVal = equator[equator.length - 1]!;
    const seamIdx = g.authors.indexOf("seam-anchor") + 1;
    expect(firstVal).toBe(seamIdx);
    expect(lastVal).toBe(seamIdx);
  });

  it("supports polar rings: a pole-sitting territory bakes as winding ±1 lines", () => {
    const polarSeeds = new Map<string, Vec3>([
      ["pole-major", [0, 1, 0]],
      ["equator-major", [0, 0, 1]]
    ]);
    const w = new Map([
      ["pole-major", 1.5],
      ["equator-major", 1]
    ]);
    const k = buildKernels(polarSeeds, w, BP);
    const g = bakeGeometry(k, BP, opts);
    // the north polar cap: the topmost rle row is one full land run owned by
    // the pole author
    const topRow = g.ownerRle[0]!;
    const poleIdx = g.authors.indexOf("pole-major") + 1;
    expect(topRow).toEqual([opts.gridWidth, poleIdx]);
    // and its coast is a polar ring — closed on the sphere, winding ±1 in the
    // equirect chart
    const windings = g.coast.map((l) =>
      Math.abs(loopWinding(unwrapFlatX(l, g.gridWidth), g.gridWidth))
    );
    expect(windings).toContain(1);
  });

  it("rle rows are exhaustive and reference known owners", () => {
    const g = bakeGeometry(kernels, BP, opts);
    expect(g.ownerRle.length).toBe(opts.gridHeight - 1);
    for (const row of g.ownerRle) {
      let sum = 0;
      eachRun(row, (_x0, count, value) => {
        sum += count;
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(g.authors.length);
      });
      expect(sum).toBe(opts.gridWidth);
    }
  });

  it("bakes deterministically", () => {
    const a = bakeGeometry(kernels, BP, opts);
    const b = bakeGeometry(kernels, BP, opts);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("raster land fraction agrees with sphere-sampled land fraction", () => {
    const grid = rasterizeEquirect(kernels, BP, 256, 129);
    let landW = 0;
    let totalW = 0;
    for (let j = 0; j < grid.height; j++) {
      const lat = Math.PI / 2 - (j / (grid.height - 1)) * Math.PI;
      const w = Math.cos(lat);
      for (let i = 0; i < grid.width; i++) {
        totalW += w;
        if (grid.field[j * grid.width + i]! >= BP.tau) landW += w;
      }
    }
    const { landFraction } = landAreas(kernels, BP, 120);
    expect(Math.abs(landW / totalW - landFraction)).toBeLessThan(0.04);
  });
});

describe("polyline decimation", () => {
  const chainDist = (p: [number, number], chain: Array<[number, number]>): number => {
    let best = Infinity;
    for (let i = 0; i + 1 < chain.length; i++) {
      const [ax, ay] = chain[i]!;
      const [bx, by] = chain[i + 1]!;
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy || 1e-12;
      const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / len2));
      best = Math.min(best, Math.hypot(p[0] - (ax + t * dx), p[1] - (ay + t * dy)));
    }
    return best;
  };

  it("keeps every dropped point within eps of the simplified chain", () => {
    const line: Array<[number, number]> = [];
    for (let i = 0; i <= 80; i++) line.push([i, Math.sin(i * 0.7) * 3]);
    const dec = decimatePolyline(line, 0.5);
    expect(dec.length).toBeLessThan(line.length);
    expect(dec[0]).toEqual(line[0]);
    expect(dec[dec.length - 1]).toEqual(line[line.length - 1]);
    for (const p of line) expect(chainDist(p, dec)).toBeLessThanOrEqual(0.5 + 1e-9);
  });

  it("keeps closed loops closed and non-degenerate", () => {
    const loop: Array<[number, number]> = [];
    for (let i = 0; i <= 100; i++) {
      const a = (i / 100) * Math.PI * 2;
      loop.push([Math.cos(a) * 10, Math.sin(a) * 10]);
    }
    loop[100] = [...loop[0]!] as [number, number];
    const dec = decimatePolyline(loop, 0.4);
    expect(dec[0]).toEqual(dec[dec.length - 1]);
    expect(dec.length).toBeGreaterThanOrEqual(5);
    for (const p of loop) expect(chainDist(p, dec)).toBeLessThanOrEqual(0.4 + 1e-9);
  });
});

describe("territory geometry helpers", () => {
  it("unwraps x across the seam by nearest representative", () => {
    expect(unwrapFlatX([98, 0, 1, 2, 97, 4], 100)).toEqual([98, 0, 101, 2, 97, 4]);
    expect(unwrapFlatX([2, 0, 97, 1], 100)).toEqual([2, 0, -3, 1]);
  });

  it("computes loop winding from unwrapped closure", () => {
    expect(loopWinding([5, 0, 60, 3, 105, 0], 100)).toBe(1);
    expect(loopWinding([5, 0, 60, 3, 5, 0], 100)).toBe(0);
  });

  it("iterates rle runs with correct offsets", () => {
    const runs: Array<[number, number, number]> = [];
    eachRun([3, 0, 5, 2, 2, 1], (x0, count, value) => runs.push([x0, count, value]));
    expect(runs).toEqual([
      [0, 3, 0],
      [3, 5, 2],
      [8, 2, 1]
    ]);
  });
});
