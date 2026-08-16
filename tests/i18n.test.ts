import { describe, expect, it } from "vitest";
import {
  GENRE_DEFS,
  LANGUAGE_LABELS,
  LANGUAGE_LABELS_EN,
  PERIOD_DEFS,
  REGION_DEFS,
  RELATION_DEFS
} from "../src/types.ts";
import { buildContentAccess, translationSearchForms } from "../src/i18n/index.ts";
import { buildSearchIndex, searchAuthors } from "../src/lib/search.ts";
import { parseHash, serializeState } from "../src/state/url.ts";
import { initialState } from "../src/state/store.ts";
import { assembleDataset, type RawCollections } from "../src/data/assemble.ts";
import { makeAuthor, makeDataset } from "./fixtures.ts";

const VALID = {
  authorIds: new Set(["a"]),
  tourIds: new Set<string>(),
  workIds: new Set<string>()
};

describe("locale in the URL", () => {
  it("serializes only when non-default and round-trips", () => {
    const s = initialState();
    expect(serializeState(s)).not.toContain("l=");
    const en = { ...s, locale: "en" as const };
    const hash = serializeState(en);
    expect(hash).toContain("l=en");
    expect(parseHash(hash, VALID).locale).toBe("en");
    expect(parseHash("#/", VALID).locale).toBe("ko");
    expect(parseHash("#/?l=xx", VALID).locale).toBe("ko");
  });
});

describe("dictionary completeness", () => {
  it("every display registry carries an English label", () => {
    for (const p of PERIOD_DEFS) {
      expect(p.en.length).toBeGreaterThan(0);
      expect(p.shortEn.length).toBeGreaterThan(0);
      expect(p.descriptionEn.length).toBeGreaterThan(0);
    }
    for (const g of GENRE_DEFS) expect(g.en.length).toBeGreaterThan(0);
    for (const r of RELATION_DEFS) {
      expect(r.en.length).toBeGreaterThan(0);
      expect(r.shortEn.length).toBeGreaterThan(0);
      expect(r.descriptionEn.length).toBeGreaterThan(0);
    }
    for (const r of REGION_DEFS) expect(r.en.length).toBeGreaterThan(0);
    expect(Object.keys(LANGUAGE_LABELS_EN).sort()).toEqual(
      Object.keys(LANGUAGE_LABELS).sort()
    );
  });
});

describe("content access", () => {
  const base = makeAuthor({
    id: "a",
    names: { ko: "프란츠 카프카", original: "Franz Kafka", aliases: ["카프카"] }
  });

  it("falls back to the original name when no pack exists", () => {
    const ds = makeDataset([base]);
    const c = buildContentAccess(ds, "en");
    expect(c.authorName(base)).toBe("Franz Kafka");
    expect(c.authorField(base, "importanceReason")).toBe(base.importanceReason);
  });

  it("uses the pack when present", () => {
    const ds = makeDataset([base]);
    ds.translations = [
      {
        locale: "en",
        authors: [
          {
            id: "a",
            name: "Franz Kafka",
            importanceReason: "An importance line long enough to satisfy readers of the map.",
            readingEntryReason: "Start here because it is short and complete.",
            difficultyReason: "Sentence-level clarity, structure-level dread."
          }
        ],
        works: [{ id: "a--w1", title: "The Trial", significance: "The essential nightmare of process itself." }],
        relations: [],
        movements: [],
        tours: []
      }
    ];
    const c = buildContentAccess(ds, "en");
    expect(c.authorName(base)).toBe("Franz Kafka");
    expect(c.authorField(base, "importanceReason")).toContain("importance line");
    const w = ds.works.find((x) => x.id === "a--w1")!;
    expect(c.workTitle(w)).toBe("The Trial");
  });
});

describe("search with translated names", () => {
  it("finds an author by their English pack name", () => {
    const a = makeAuthor({
      id: "a",
      names: { ko: "박경리", original: "朴景利", aliases: [] }
    });
    const ds = makeDataset([a]);
    ds.translations = [
      {
        locale: "en",
        authors: [
          {
            id: "a",
            name: "Park Kyong-ni",
            importanceReason: "A long enough English importance sentence for the fixture.",
            readingEntryReason: "A long enough entry reason for the fixture.",
            difficultyReason: "A difficulty reason for the fixture."
          }
        ],
        works: [],
        relations: [],
        movements: [],
        tours: []
      }
    ];
    const index = buildSearchIndex(ds.authors, translationSearchForms(ds));
    const hits = searchAuthors(index, "Park Kyong");
    expect(hits[0]?.author.id).toBe("a");
  });
});

describe("translation invariants", () => {
  function rawWith(translationFiles: Record<string, unknown>): RawCollections {
    const ds = makeDataset([makeAuthor({ id: "a" })]);
    return {
      authorFiles: { "authors/test.json": ds.authors },
      workFiles: { "works/test.json": ds.works },
      relationFiles: { "relations/test.json": ds.relations },
      sourceFiles: { "sources/test.json": ds.sources },
      movements: ds.movements,
      tours: ds.tours,
      positions: ds.positions,
      registry: ds.registry,
      translationFiles
    };
  }

  const enAuthor = {
    id: "a",
    name: "Author One",
    importanceReason: "A sufficiently long English importance sentence for the invariants.",
    readingEntryReason: "A sufficiently long entry reason for the invariants.",
    difficultyReason: "A difficulty reason for the invariants."
  };
  const enWorks = [1, 2, 3].map((n) => ({
    id: `a--w${n}`,
    title: `Work ${n}`,
    significance: "A sufficiently long significance line for the invariants."
  }));

  it("accepts a complete pack", () => {
    const { errors } = assembleDataset(
      rawWith({
        "en/authors/test.json": [enAuthor],
        "en/works/test.json": enWorks
      })
    );
    expect(errors).toEqual([]);
  });

  it("rejects unknown ids and enforces full coverage", () => {
    const { errors } = assembleDataset(
      rawWith({
        "en/authors/test.json": [{ ...enAuthor, id: "ghost" }]
      })
    );
    expect(errors.some((e) => e.includes("unknown author ghost"))).toBe(true);
    expect(errors.some((e) => e.includes("incomplete author coverage"))).toBe(true);
    expect(errors.some((e) => e.includes("incomplete work coverage"))).toBe(true);
  });

  it("rejects orphan optional fields", () => {
    const { errors } = assembleDataset(
      rawWith({
        "en/authors/test.json": [{ ...enAuthor, readingWarning: "Do not start with the late diaries." }],
        "en/works/test.json": enWorks
      })
    );
    expect(errors.some((e) => e.includes("readingWarning translation has no source field"))).toBe(
      true
    );
  });
});
