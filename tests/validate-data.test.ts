import { describe, expect, it } from "vitest";
import { assembleDataset } from "../src/data/assemble.ts";
import { loadRawCollections } from "../scripts/lib/load-node.ts";
import { makeAuthor, makeDataset, makeRelation, makeWork } from "./fixtures.ts";
import type { RawCollections } from "../src/data/assemble.ts";

function rawFrom(ds: ReturnType<typeof makeDataset>): RawCollections {
  return {
    authorFiles: { "authors/test.json": ds.authors },
    workFiles: { "works/test.json": ds.works },
    relationFiles: { "relations/test.json": ds.relations },
    sourceFiles: { "sources/test.json": ds.sources },
    movements: ds.movements,
    tours: ds.tours,
    positions: ds.positions,
    registry: ds.registry
  };
}

describe("invariant checks (synthetic)", () => {
  it("accepts a well-formed dataset", () => {
    const ds = makeDataset(
      [makeAuthor({ id: "a" }), makeAuthor({ id: "b" })],
      [makeRelation("a", "b")]
    );
    const { errors } = assembleDataset(rawFrom(ds));
    expect(errors).toEqual([]);
  });

  it("blocks documented influence without sources", () => {
    const ds = makeDataset(
      [makeAuthor({ id: "a" }), makeAuthor({ id: "b" })],
      [makeRelation("a", "b", "documented_influence", { sourceIds: [] })]
    );
    const { errors } = assembleDataset(rawFrom(ds));
    expect(errors.some((e) => e.includes("requires at least one source"))).toBe(true);
  });

  it("blocks affinity claiming documented evidence", () => {
    const ds = makeDataset(
      [makeAuthor({ id: "a" }), makeAuthor({ id: "b" })],
      [makeRelation("a", "b", "affinity", { evidenceLevel: "documented" })]
    );
    const { errors } = assembleDataset(rawFrom(ds));
    expect(errors.some((e) => e.includes("not allowed for type 'affinity'"))).toBe(true);
  });

  it("blocks duplicate wikidata QIDs and reviewed authors without one", () => {
    const ds = makeDataset([
      makeAuthor({ id: "a", externalIds: { wikidata: "Q1" } }),
      makeAuthor({ id: "b", externalIds: { wikidata: "Q1" } }),
      makeAuthor({
        id: "c",
        externalIds: undefined,
        reviewStatus: "reviewed",
        reviewedAt: "2026-08-15"
      })
    ]);
    const { errors } = assembleDataset(rawFrom(ds));
    expect(errors.some((e) => e.includes("duplicate author wikidata QID"))).toBe(true);
    expect(errors.some((e) => e.includes("requires externalIds.wikidata"))).toBe(true);
  });

  it("blocks self-relations, unknown endpoints, duplicates and reverse duplicates", () => {
    const a = makeAuthor({ id: "a" });
    const b = makeAuthor({ id: "b" });
    const ds = makeDataset(
      [a, b],
      [
        makeRelation("a", "a"),
        makeRelation("a", "ghost"),
        makeRelation("a", "b"),
        makeRelation("b", "a")
      ]
    );
    const { errors } = assembleDataset(rawFrom(ds));
    expect(errors.some((e) => e.includes("self-relation"))).toBe(true);
    expect(errors.some((e) => e.includes("unknown targetId ghost"))).toBe(true);
    expect(errors.some((e) => e.includes("reverse duplicate"))).toBe(true);
  });

  it("blocks a readingEntry that is not one of the author's works", () => {
    const a = makeAuthor({ id: "a", readingEntry: "b--w1", readingOrder: ["b--w1"] });
    const ds = makeDataset([a, makeAuthor({ id: "b" })]);
    const { errors } = assembleDataset(rawFrom(ds));
    expect(errors.some((e) => e.includes("readingEntry"))).toBe(true);
  });

  it("blocks fewer than 3 works without an exception note", () => {
    const a = makeAuthor({ id: "a" });
    const ds = makeDataset([a]);
    ds.works = [makeWork("a", 1)];
    const { errors } = assembleDataset(rawFrom({ ...ds, works: [makeWork("a", 1)] }));
    expect(errors.some((e) => e.includes("fewer than 3 works"))).toBe(true);
  });

  it("blocks implausible years", () => {
    const a = makeAuthor({ id: "a", birthYear: 1900, deathYear: 1890 });
    const { errors } = assembleDataset(rawFrom(makeDataset([a])));
    expect(errors.some((e) => e.includes("birthYear >= deathYear"))).toBe(true);
  });

  it("blocks positions off the unit sphere", () => {
    const ds = makeDataset([makeAuthor({ id: "a" })]);
    ds.positions.positions["a"] = [2, 0, 0];
    const { errors } = assembleDataset(rawFrom(ds));
    expect(errors.some((e) => e.includes("not on unit sphere"))).toBe(true);
  });
});

describe("real dataset", () => {
  it("validates (strict once positions are frozen)", () => {
    const raw = loadRawCollections();
    const positions = raw.positions as { version?: string };
    const allowPartial = positions.version === "0.0.0";
    const { errors } = assembleDataset(raw, { allowPartial });
    expect(errors).toEqual([]);
  });
});

describe("imagined portraits (thesis ④ rights ladder)", () => {
  const basePortraits = (entries: unknown[]) => ({
    version: "0.1.0",
    model: "test-model",
    postProcess: "test grayscale pipeline for fixture purposes",
    entries
  });
  const faceEntry = (authorId: string, overrides: Record<string, unknown> = {}) => ({
    authorId,
    mode: "face",
    rung: 1,
    motif: null,
    motifRationale: null,
    iconographyNote: "fixture iconography note long enough for the schema",
    prompt:
      "fixture prompt describing an antique engraving frontispiece portrait, long enough to satisfy the schema minimum length",
    seed: 1,
    generatedAt: "2026-08-16",
    reviewStatus: "draft",
    ...overrides
  });

  it("accepts a dead author's face and a living author's object portrait", () => {
    const ds = makeDataset([
      makeAuthor({ id: "dead-face" }),
      makeAuthor({ id: "living-object", deathYear: undefined })
    ]);
    const raw = {
      ...rawFrom(ds),
      portraits: basePortraits([
        faceEntry("dead-face"),
        faceEntry("living-object", {
          mode: "object",
          rung: 3,
          motif: "a muted post horn",
          motifRationale: "fixture rationale grounded in the author's central emblem"
        })
      ])
    };
    const { errors, dataset } = assembleDataset(raw);
    expect(errors).toEqual([]);
    expect(dataset?.portraits.length).toBe(2);
  });

  it("blocks a generated face for a living author", () => {
    const ds = makeDataset([makeAuthor({ id: "alive", deathYear: undefined })]);
    const raw = { ...rawFrom(ds), portraits: basePortraits([faceEntry("alive")]) };
    const { errors } = assembleDataset(raw);
    expect(errors.some((e) => e.includes("living") && e.includes("prohibited"))).toBe(true);
  });

  it("blocks rung 3 with face mode and objects without motif at the schema", () => {
    const ds = makeDataset([makeAuthor({ id: "a" })]);
    const rungFace = { ...rawFrom(ds), portraits: basePortraits([faceEntry("a", { rung: 3 })]) };
    expect(
      assembleDataset(rungFace).errors.some((e) => e.includes("object portrait"))
    ).toBe(true);
    const noMotif = {
      ...rawFrom(ds),
      portraits: basePortraits([faceEntry("a", { mode: "object", rung: 3 })])
    };
    expect(assembleDataset(noMotif).errors.some((e) => e.includes("motif"))).toBe(true);
  });

  it("blocks unknown authors and duplicates", () => {
    const ds = makeDataset([makeAuthor({ id: "a" })]);
    const raw = {
      ...rawFrom(ds),
      portraits: basePortraits([faceEntry("a"), faceEntry("a"), faceEntry("ghost")])
    };
    const { errors } = assembleDataset(raw);
    expect(errors.some((e) => e.includes("unknown author ghost"))).toBe(true);
    expect(errors.some((e) => e.includes("duplicate entry"))).toBe(true);
  });
});
