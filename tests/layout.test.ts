import { describe, expect, it } from "vitest";
import { computeLayout, layoutQuality } from "../scripts/generate-layout.ts";
import { geodesic, norm, type Vec3 } from "../src/lib/sphere.ts";
import { makeAuthor, makeDataset, makeRelation } from "./fixtures.ts";

// two tight clusters joined by weak ties: layout should keep clusters together
const authors = [
  makeAuthor({ id: "k1", movements: [], languages: ["de"] }),
  makeAuthor({ id: "k2", movements: [], languages: ["de"] }),
  makeAuthor({ id: "k3", movements: [], languages: ["de"] }),
  makeAuthor({ id: "l1", movements: [], languages: ["es"] }),
  makeAuthor({ id: "l2", movements: [], languages: ["es"] }),
  makeAuthor({ id: "l3", movements: [], languages: ["es"] }),
  makeAuthor({ id: "solo", movements: [], languages: ["ja"] })
];
const relations = [
  makeRelation("k1", "k2", "documented_influence", { weight: 0.9 }),
  makeRelation("k2", "k3", "documented_influence", { weight: 0.9 }),
  makeRelation("k1", "k3", "dialogue", { weight: 0.8 }),
  makeRelation("l1", "l2", "documented_influence", { weight: 0.9 }),
  makeRelation("l2", "l3", "mentorship", { weight: 0.9 }),
  makeRelation("k1", "l1", "affinity", { weight: 0.3, evidenceLevel: "editorial_inference" })
];
const dataset = makeDataset(authors, relations);

describe("computeLayout", () => {
  it("is deterministic: same data + seed → identical coordinates", () => {
    const a = computeLayout(dataset, { seed: 123, iterations: 200 });
    const b = computeLayout(dataset, { seed: 123, iterations: 200 });
    for (const id of a.keys()) {
      expect(a.get(id)).toEqual(b.get(id));
    }
  });

  it("different seeds give different coordinates", () => {
    const a = computeLayout(dataset, { seed: 1, iterations: 100 });
    const b = computeLayout(dataset, { seed: 2, iterations: 100 });
    const moved = [...a.keys()].some(
      (id) => geodesic(a.get(id)!, b.get(id)!) > 0.01
    );
    expect(moved).toBe(true);
  });

  it("keeps every node on the unit sphere", () => {
    const pos = computeLayout(dataset, { seed: 5, iterations: 200 });
    for (const p of pos.values()) {
      expect(Math.abs(norm(p) - 1)).toBeLessThan(1e-6);
    }
  });

  it("places linked pairs markedly closer than random pairs", () => {
    const pos = computeLayout(dataset, { seed: 7, iterations: 400 });
    const q = layoutQuality(dataset, pos);
    expect(q.meanLinked).toBeLessThan(q.meanRandom * 0.8);
  });

  it("cluster members end up nearer each other than to the other cluster", () => {
    const pos = computeLayout(dataset, { seed: 7, iterations: 400 });
    const within = geodesic(pos.get("k1")!, pos.get("k2")!);
    const across = geodesic(pos.get("k1")!, pos.get("l3")!);
    expect(within).toBeLessThan(across);
  });

  it("incremental mode keeps frozen coordinates byte-identical", () => {
    const first = computeLayout(dataset, { seed: 9, iterations: 300 });
    const frozen = new Map<string, Vec3>(first);
    const newcomer = makeAuthor({ id: "newbie", movements: [], languages: ["de"] });
    const grown = makeDataset(
      [...authors, newcomer],
      [...relations, makeRelation("k1", "newbie", "documented_influence", { weight: 0.9 })]
    );
    const second = computeLayout(grown, { seed: 9, iterations: 300, frozen });
    for (const [id, p] of frozen) {
      expect(second.get(id)).toEqual(p);
    }
    // the newcomer lands in the neighborhood of its only link
    const d = geodesic(second.get("newbie")!, second.get("k1")!);
    expect(d).toBeLessThan(Math.PI / 2);
  });
});
