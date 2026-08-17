import { describe, expect, it } from "vitest";
import {
  EGO_CAP,
  FAR_ROUTE_CAP,
  orderEgo,
  resolveRelationView
} from "../src/globe/layers/relation-view.ts";
import type { Relation } from "../src/types.ts";

function rel(over: Partial<Relation>): Relation {
  return {
    id: over.id ?? `influence--a--b`,
    type: "documented_influence",
    direction: "directed",
    sourceId: "a",
    targetId: "b",
    evidenceLevel: "documented",
    weight: 0.8,
    summaryKo: "",
    sourceIds: [],
    ...over
  } as Relation;
}

const REGION: Record<string, string> = {
  sel: "europe-central",
  a1: "europe-central",
  a2: "europe-west",
  a3: "europe-west",
  a4: "north-america"
};

const MOVEMENT: Record<string, string> = {
  a1: "mv:modernism",
  a2: "mv:surrealism",
  a3: "mv:surrealism",
  a4: "mv:beat"
};

const base = {
  regionOf: (id: string) => REGION[id],
  clusterGroupOf: (id: string) => (id === "a1" || id === "sel" ? "rep1" : "rep2"),
  movementOf: (id: string) => MOVEMENT[id],
  egoExpanded: false
};

describe("resolveRelationView — ego cap (6th review: never silently drop)", () => {
  const many = Array.from({ length: 25 }, (_, i) =>
    rel({
      id: `influence--sel--n${i}`,
      sourceId: "sel",
      targetId: `n${i}`,
      evidenceLevel: i < 5 ? "editorial_inference" : "documented",
      weight: (i % 10) / 10
    })
  );

  it("caps at 20 with the hidden count reported", () => {
    const v = resolveRelationView({
      ...base,
      mode: "geo",
      lod: "mid",
      selectedAuthorId: "sel",
      visibleRelations: many
    });
    expect(v.raw.length).toBe(EGO_CAP);
    expect(v.hiddenCount).toBe(5);
    expect(v.reason).toBe("ego");
    // the knowledge ladder holds: everything shown is documented before any
    // editorial inference appears
    expect(v.raw.every((r) => r.evidenceLevel === "documented")).toBe(true);
  });

  it("show-all expands to the full ego set", () => {
    const v = resolveRelationView({
      ...base,
      egoExpanded: true,
      mode: "geo",
      lod: "mid",
      selectedAuthorId: "sel",
      visibleRelations: many
    });
    expect(v.raw.length).toBe(25);
    expect(v.hiddenCount).toBe(0);
    expect(v.reason).toBe("ego-expanded");
  });

  it("orderEgo ranks evidence level before weight", () => {
    const ordered = orderEgo([
      rel({ id: "x", evidenceLevel: "editorial_inference", weight: 0.9 }),
      rel({ id: "y", evidenceLevel: "documented", weight: 0.3 })
    ]);
    expect(ordered[0]!.id).toBe("y");
  });
});

describe("resolveRelationView — geo aggregates replace the raw tangle", () => {
  const rels = [
    rel({ id: "r1", sourceId: "a1", targetId: "a2" }),
    rel({ id: "r2", sourceId: "a1", targetId: "a3", type: "translation" }),
    rel({ id: "r3", sourceId: "a2", targetId: "a3" }), // intra europe-west: no route
    rel({ id: "r4", sourceId: "a1", targetId: "a4" })
  ];

  it("far: 0 raw, region-pair routes with dominant type", () => {
    const v = resolveRelationView({
      ...base,
      mode: "geo",
      lod: "far",
      selectedAuthorId: null,
      visibleRelations: rels
    });
    expect(v.raw.length).toBe(0);
    expect(v.aggregates.length).toBeLessThanOrEqual(FAR_ROUTE_CAP);
    const ec = v.aggregates.find((a) => a.a.includes("central") && a.b.includes("west"));
    expect(ec?.count).toBe(2);
    expect(v.aggregates.some((a) => a.b.includes("north-america") || a.a.includes("north-america"))).toBe(true);
  });

  it("mid: routes between screen clusters, intra-cluster links silent", () => {
    const v = resolveRelationView({
      ...base,
      mode: "geo",
      lod: "mid",
      selectedAuthorId: null,
      visibleRelations: rels
    });
    expect(v.raw.length).toBe(0);
    // a1(rep1)↔a2/a3/a4(rep2): three cross-cluster links on one route
    expect(v.aggregates).toEqual([
      { a: "rep1", b: "rep2", count: 3, dominantType: "documented_influence" }
    ]);
  });

  it("near unselected stays quiet; the milky way is a FAR reading only", () => {
    const near = resolveRelationView({
      ...base,
      mode: "geo",
      lod: "near",
      selectedAuthorId: null,
      visibleRelations: rels
    });
    expect(near.raw.length + near.aggregates.length).toBe(0);
    const semFar = resolveRelationView({
      ...base,
      mode: "semantic",
      lod: "far",
      selectedAuthorId: null,
      visibleRelations: rels
    });
    expect(semFar.raw.length).toBe(rels.length);
    expect(semFar.reason).toBe("semantic-overview");
  });

  it("semantic mid unselected: constellation routes, 0 raw (7th review)", () => {
    const sem = resolveRelationView({
      ...base,
      mode: "semantic",
      lod: "mid",
      selectedAuthorId: null,
      visibleRelations: rels
    });
    expect(sem.raw.length).toBe(0);
    expect(sem.reason).toBe("semantic-aggregate");
    // r1 modernism↔surrealism, r2 modernism↔surrealism (r3 intra-surrealism
    // silent), r4 modernism↔beat
    const ms = sem.aggregates.find((a) => a.a === "mv:modernism" && a.b === "mv:surrealism");
    expect(ms?.count).toBe(2);
    expect(sem.aggregates.length).toBe(2);
    // authors without a movement fall back to their region group
    const semFallback = resolveRelationView({
      ...base,
      movementOf: () => undefined,
      mode: "semantic",
      lod: "near",
      selectedAuthorId: null,
      visibleRelations: rels
    });
    expect(semFallback.raw.length).toBe(0);
    expect(semFallback.aggregates.length).toBeGreaterThan(0);
  });
});
