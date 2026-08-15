import { describe, expect, it } from "vitest";
import {
  DEFAULT_PARAMS,
  buildKernels,
  computeWeights,
  marchingSquares,
  rasterizeHemisphere,
  sampleField,
  stitchSegments,
  warpPoint
} from "../scripts/lib/terrain.ts";
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
