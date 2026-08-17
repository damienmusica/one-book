import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { eachRun } from "../src/lib/territory-geometry.ts";
import type { TerritoryEras } from "../src/types.ts";

/**
 * The tectonic contract, CI-gated (territory grammar v2.5, D2′):
 * clause 1 (determinism) is the seeded bake; clause 2 (terminal identity)
 * and clause 3 (monotone growth — risen land never sinks) are re-verified
 * here against the shipped data, not trusted from the bake log.
 */

const eras = JSON.parse(
  readFileSync(new URL("../data/territory.v1.eras.json", import.meta.url), "utf8")
) as TerritoryEras;
const v1 = JSON.parse(
  readFileSync(new URL("../data/territory.v1.json", import.meta.url), "utf8")
) as { geometry: { gridWidth: number; ownerRle: number[][]; authors: string[] } };

function decode(rows: number[][], w: number): Uint8Array {
  const out = new Uint8Array(rows.length * w);
  rows.forEach((row, j) => {
    eachRun(row, (x0, count, value) => out.fill(value, j * w + x0, j * w + x0 + count));
  });
  return out;
}

const W = v1.geometry.gridWidth;
const masks = eras.keyframes.map((k) => decode(k.ownerRle, W));
const finalMask = decode(v1.geometry.ownerRle, W);

describe("tectonic contract", () => {
  it("keyframes cover the corpus era in increasing order", () => {
    const years = eras.keyframes.map((k) => k.year);
    expect(years[0]).toBe(1850);
    expect(years.at(-1)).toBe(2000);
    expect(years.every((y, i) => i === 0 || y > years[i - 1]!)).toBe(true);
  });

  it("clause 3 — risen land never sinks, and never changes owner", () => {
    for (let k = 1; k < masks.length; k++) {
      const prev = masks[k - 1]!;
      const next = masks[k]!;
      for (let i = 0; i < prev.length; i++) {
        if (prev[i]! !== 0) {
          expect(next[i]).toBe(prev[i]);
        }
      }
    }
  });

  it("clause 2 — the last keyframe is a subset of the frozen v1 plate", () => {
    const last = masks.at(-1)!;
    for (let i = 0; i < last.length; i++) {
      if (last[i]! !== 0) expect(last[i]).toBe(finalMask[i]);
    }
  });

  it("the world genuinely grows (this is tectonics, not a slideshow)", () => {
    const land = masks.map((m) => m.reduce((n, v) => n + (v > 0 ? 1 : 0), 0));
    expect(land.every((v, i) => i === 0 || v > land[i - 1]!)).toBe(true);
    const finalLand = finalMask.reduce((n, v) => n + (v > 0 ? 1 : 0), 0);
    expect(land[0]! / finalLand).toBeLessThan(0.15); // 1850: an early world
    expect(land.at(-1)! / finalLand).toBeGreaterThan(0.9); // 2000: nearly the atlas
  });

  it("every nation exists in every era (at least an embryonic islet)", () => {
    const nations = new Set<number>();
    for (const v of finalMask) if (v !== 0) nations.add(v);
    for (const m of masks) {
      const present = new Set<number>();
      for (const v of m) if (v !== 0) present.add(v);
      expect(present.size).toBe(nations.size);
    }
  });

  it("bake provenance is recorded", () => {
    expect(eras.derivedFrom).toContain("territory");
    expect(eras.seed).toBe(20260817);
    expect(eras.params.growth).toContain("publishedWorksShare");
    expect(eras.params.erosion).toContain("nested");
  });
});
