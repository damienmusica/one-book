import { describe, expect, it } from "vitest";
import { buildAdjacency, neighborsOf, shortestPath } from "../src/lib/graph.ts";
import { makeRelation } from "./fixtures.ts";

// a→b→c→d chain plus a shortcut a~d via affinity? no — test both cases
const chain = [
  makeRelation("a", "b"),
  makeRelation("b", "c"),
  makeRelation("c", "d"),
  makeRelation("x", "y")
];

describe("shortestPath", () => {
  it("finds the chain a→d in three hops", () => {
    const adj = buildAdjacency(chain);
    const path = shortestPath(adj, "a", "d");
    expect(path?.map((r) => r.id)).toEqual([
      "influence--a--b",
      "influence--b--c",
      "influence--c--d"
    ]);
  });

  it("uses a shortcut when one exists", () => {
    const adj = buildAdjacency([...chain, makeRelation("a", "d", "affinity")]);
    const path = shortestPath(adj, "a", "d");
    expect(path).toHaveLength(1);
    expect(path?.[0]?.type).toBe("affinity");
  });

  it("works against edge direction (undirected search)", () => {
    const adj = buildAdjacency(chain);
    const path = shortestPath(adj, "d", "a");
    expect(path).toHaveLength(3);
  });

  it("returns null across disconnected components", () => {
    const adj = buildAdjacency(chain);
    expect(shortestPath(adj, "a", "y")).toBeNull();
  });

  it("returns empty path for identical endpoints", () => {
    const adj = buildAdjacency(chain);
    expect(shortestPath(adj, "a", "a")).toEqual([]);
  });
});

describe("neighborsOf", () => {
  it("sorts neighbors by weight descending", () => {
    const adj = buildAdjacency([
      makeRelation("a", "b", "documented_influence", { weight: 0.3 }),
      makeRelation("a", "c", "documented_influence", { weight: 0.9 })
    ]);
    expect(neighborsOf(adj, "a").map((n) => n.otherId)).toEqual(["c", "b"]);
  });
});
