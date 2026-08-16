// Regression pins for the 2026-08-16 real-use feedback (all three were
// verified live before fixing): reversed compare-path arrows, array-order
// "major works", and the unexplained 229-vs-263 relation count.

import { describe, expect, it } from "vitest";
import { assembleDataset } from "../src/data/assemble.ts";
import { loadRawCollections } from "../scripts/lib/load-node.ts";
import { buildAdjacency, pathHops, shortestPath } from "../src/lib/graph.ts";
import { majorWorksOf } from "../src/lib/works.ts";
import { defaultFilters } from "../src/state/store.ts";

const { dataset, errors } = assembleDataset(loadRawCollections());
if (!dataset) throw new Error(`dataset failed to assemble: ${errors.join("; ")}`);

describe("compare path direction (real data)", () => {
  it("renders Flaubert's influence on Proust backward when walking Proust→Kafka", () => {
    const adj = buildAdjacency(dataset.relations);
    const path = shortestPath(adj, "marcel-proust", "franz-kafka");
    expect(path).not.toBeNull();
    const hops = pathHops(path!, "marcel-proust");
    // every hop must keep its relation's canonical source/target
    for (const h of hops) {
      if (h.along === "forward") {
        expect(h.relation.sourceId).toBe(h.fromId);
        expect(h.relation.targetId).toBe(h.toId);
      } else {
        expect(h.relation.sourceId).toBe(h.toId);
        expect(h.relation.targetId).toBe(h.fromId);
      }
    }
    // the reported repro, pinned exactly: Proust ← Flaubert → Kafka
    expect(hops.map((h) => [h.fromId, h.toId, h.along])).toEqual([
      ["marcel-proust", "gustave-flaubert", "backward"],
      ["gustave-flaubert", "franz-kafka", "forward"]
    ]);
  });

  it("keeps canonical direction on every shortest path between direct-influence endpoints", () => {
    const adj = buildAdjacency(dataset.relations);
    for (const r of dataset.relations.filter((x) => x.direction === "directed").slice(0, 40)) {
      const path = shortestPath(adj, r.targetId, r.sourceId);
      if (!path) continue;
      for (const h of pathHops(path, r.targetId)) {
        const ok =
          h.along === "forward"
            ? h.relation.sourceId === h.fromId && h.relation.targetId === h.toId
            : h.relation.sourceId === h.toId && h.relation.targetId === h.fromId;
        expect(ok).toBe(true);
      }
    }
  });
});

describe("major works come from the editorial readingOrder (real data)", () => {
  it("keeps The Master and Margarita in Bulgakov's top three", () => {
    const author = dataset.authors.find((a) => a.id === "mikhail-bulgakov")!;
    const works = dataset.works.filter((w) => w.authorId === author.id);
    const top3 = majorWorksOf(author, works, 3).map((w) => w.id);
    expect(top3).toContain("mikhail-bulgakov--master-i-margarita");
    // file order (year-sorted) would have dropped it behind three 1920s works
    const byYear = [...works].sort((a, b) => a.year - b.year).slice(0, 3);
    expect(byYear.map((w) => w.id)).not.toContain("mikhail-bulgakov--master-i-margarita");
  });

  it("puts the entry work first for every author", () => {
    for (const a of dataset.authors) {
      const works = dataset.works.filter((w) => w.authorId === a.id);
      const major = majorWorksOf(a, works);
      expect(major[0]?.id).toBe(a.readingEntry);
      expect(major).toHaveLength(works.length);
    }
  });
});

describe("relation counts (real data)", () => {
  it("default filters hide exactly the contrast relations", () => {
    const d = defaultFilters();
    const visibleTypes = new Set(d.relationTypes);
    const hidden = dataset.relations.filter((r) => !visibleTypes.has(r.type));
    expect(hidden.every((r) => r.type === "contrast")).toBe(true);
    expect(hidden.length + dataset.relations.filter((r) => visibleTypes.has(r.type)).length).toBe(
      dataset.relations.length
    );
  });
});
