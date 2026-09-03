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

});

describe("real dataset", () => {
  it("validates strictly", () => {
    const raw = loadRawCollections();
    const { errors } = assembleDataset(raw);
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

describe("배차 원장은 도판 작가만 잰다", () => {
  // 실루엣이 들어오면서 "모든 작가는 배차된 작가다"라는 전제가 사라졌다.
  // 세 문장이 남는다 — 그 셋이 실제로 무엇을 막는지 여기서 잰다.
  const silhouette = (id: string) =>
    makeAuthor({ id, depth: "silhouette", reviewStatus: "draft", readingOrder: [], readingEntry: undefined });

  it("원장에 없는 실루엣은 통과한다", () => {
    const ds = makeDataset([makeAuthor({ id: "a" }), silhouette("s")], []);
    ds.registry = [{ id: "a", ko: "가", original: "A", layer: "roots", tier: "anchor", batch: "t" }];
    ds.works = ds.works.filter((w) => w.authorId !== "s");
    const { errors } = assembleDataset(rawFrom(ds));
    expect(errors).toEqual([]);
  });

  it("원장에 올랐는데 실루엣이면 막는다 — 그리기로 한 작가를 그리지 않았다", () => {
    const ds = makeDataset([makeAuthor({ id: "a" }), silhouette("s")], []);
    ds.registry = [
      { id: "a", ko: "가", original: "A", layer: "roots", tier: "anchor", batch: "t" },
      { id: "s", ko: "실", original: "S", layer: "roots", tier: "context", batch: "t" }
    ];
    ds.works = ds.works.filter((w) => w.authorId !== "s");
    const { errors } = assembleDataset(rawFrom(ds));
    expect(errors.some((e) => e.includes("registry author is only a silhouette: s"))).toBe(true);
  });

  it("원장에 없는 도판 작가는 여전히 막는다", () => {
    const ds = makeDataset([makeAuthor({ id: "a" }), makeAuthor({ id: "b" })], []);
    ds.registry = [{ id: "a", ko: "가", original: "A", layer: "roots", tier: "anchor", batch: "t" }];
    const { errors } = assembleDataset(rawFrom(ds));
    expect(errors.some((e) => e.includes("author not in registry: b"))).toBe(true);
  });
});

describe("작품에도 깊이가 있다 (2026-09-04)", () => {
  // 실루엣 작가에게 산문 30자를 요구하면 그 요구가 곧 "책이 없다"가 된다.
  // 실루엣 작품은 서가의 책등이다 — 제목·원제·연도·장르. 그 경계를 여기서 잰다.
  const silAuthor = (id: string) =>
    makeAuthor({ id, depth: "silhouette", reviewStatus: "draft", readingOrder: [], readingEntry: undefined });
  const silWork = (authorId: string, n: number) =>
    makeWork(authorId, n, { depth: "silhouette", significance: undefined, sourceIds: [] });

  it("실루엣 작가가 실루엣 작품을 갖는 것은 정상이다", () => {
    const ds = makeDataset([makeAuthor({ id: "a" }), silAuthor("s")], []);
    ds.works = ds.works.filter((w) => w.authorId !== "s").concat([silWork("s", 1), silWork("s", 2)]);
    ds.registry = ds.registry.filter((r) => r.id !== "s");
    const { errors } = assembleDataset(rawFrom(ds));
    expect(errors).toEqual([]);
  });

  it("작품이 작가보다 깊을 수는 없다", () => {
    const ds = makeDataset([makeAuthor({ id: "a" }), silAuthor("s")], []);
    ds.works = ds.works.filter((w) => w.authorId !== "s").concat([makeWork("s", 1)]);
    ds.registry = ds.registry.filter((r) => r.id !== "s");
    const { errors } = assembleDataset(rawFrom(ds));
    expect(errors.some((e) => e.includes("작가가 실루엣인데 작품이"))).toBe(true);
  });

  it("실루엣 작품은 산문을 갖지 못한다", () => {
    const ds = makeDataset([makeAuthor({ id: "a" }), silAuthor("s")], []);
    ds.works = ds.works
      .filter((w) => w.authorId !== "s")
      .concat([makeWork("s", 1, { depth: "silhouette", sourceIds: [] })]);
    ds.registry = ds.registry.filter((r) => r.id !== "s");
    const { errors } = assembleDataset(rawFrom(ds));
    expect(errors.some((e) => e.includes("실루엣 작품은 산문을 갖지 않는다"))).toBe(true);
  });

  it("도판 작품에서 산문을 빼면 막는다", () => {
    const ds = makeDataset([makeAuthor({ id: "a" }), makeAuthor({ id: "b" })], []);
    ds.works = ds.works.map((w) => (w.authorId === "b" ? { ...w, significance: undefined } : w));
    const { errors } = assembleDataset(rawFrom(ds));
    expect(errors.some((e) => e.includes("도판 작품에는 significance 가 필요하다"))).toBe(true);
  });
});

describe("사후 출간 검사는 연도 오타를 잡는 것이지 문학사에 대한 주장이 아니다", () => {
  // 고전이 들어오자 이 규칙이 참인 사실 7건을 거짓으로 판정했다(첼리니 1728 ·
  // 윤선도 1798 · 김시습 1583). 전부 사후 편찬이 정상인 문학이고, 전부 이미
  // `yearBasis: first-print` 로 그 수가 무엇인지 말하고 있었다.
  const late = (basis?: string) => {
    const ds = makeDataset([makeAuthor({ id: "a", birthYear: 1500, deathYear: 1571 })], []);
    ds.works = ds.works.map((w, i) =>
      i === 0 ? { ...w, year: 1728, ...(basis ? { yearBasis: basis as never } : {}) } : { ...w, year: 1560 }
    );
    return assembleDataset(rawFrom(ds)).errors;
  };
  it("무슨 수인지 말하지 않으면 막는다 — 오타일 수 있다", () => {
    expect(late().some((e) => e.includes("posthumously"))).toBe(true);
  });
  it("첫 인쇄라고 말하면 통과시킨다", () => {
    expect(late("first-print").some((e) => e.includes("posthumously"))).toBe(false);
  });
  it("성립 시기 추정도 통과시킨다", () => {
    expect(late("composition-range").some((e) => e.includes("posthumously"))).toBe(false);
  });
});

describe("스케치는 축소된 도판이 아니라 한 문장을 더한 실루엣이다", () => {
  // 이 칸에 도판의 요구(장소·3편·입문 순서)를 걸면 그 칸은 영원히 비고
  // 사다리는 두 칸으로 되돌아간다.
  const sketch = (id: string, over: Record<string, unknown> = {}) =>
    makeAuthor({
      id,
      depth: "sketch",
      reviewStatus: "draft",
      importanceReason: "한 문장으로 왜 이 사람이 지도에 있는지 말한다.",
      locations: [],
      genres: [],
      difficulty: undefined,
      sourceIds: [],
      readingEntry: undefined,
      readingOrder: [],
      ...over
    });

  it("장소도 난도도 출처도 없이 선다", () => {
    const ds = makeDataset([makeAuthor({ id: "a" }), sketch("s")], []);
    ds.works = ds.works
      .filter((w) => w.authorId !== "s")
      .concat([makeWork("s", 1, { depth: "silhouette", significance: undefined, sourceIds: [] })]);
    ds.registry = ds.registry.filter((r) => r.id !== "s");
    expect(assembleDataset(rawFrom(ds)).errors).toEqual([]);
  });

  it("한 문장이 없으면 스케치가 아니다", () => {
    const ds = makeDataset([makeAuthor({ id: "a" }), sketch("s", { importanceReason: undefined })], []);
    ds.works = ds.works.filter((w) => w.authorId !== "s");
    ds.registry = ds.registry.filter((r) => r.id !== "s");
    expect(assembleDataset(rawFrom(ds)).errors.some((e) => e.includes("importanceReason"))).toBe(true);
  });

  it("작품이 작가보다 깊을 수 없다 — 스케치에도 같은 규칙", () => {
    const ds = makeDataset([makeAuthor({ id: "a" }), sketch("s")], []);
    ds.works = ds.works.filter((w) => w.authorId !== "s").concat([makeWork("s", 1)]);
    ds.registry = ds.registry.filter((r) => r.id !== "s");
    expect(assembleDataset(rawFrom(ds)).errors.some((e) => e.includes("작가가 스케치인데"))).toBe(true);
  });

  it("입문 순서는 큐레이션이고 도판의 것이다", () => {
    const ds = makeDataset([makeAuthor({ id: "a" }), sketch("s", { readingOrder: ["s--w1"] })], []);
    ds.works = ds.works
      .filter((w) => w.authorId !== "s")
      .concat([makeWork("s", 1, { depth: "silhouette", significance: undefined, sourceIds: [] })]);
    ds.registry = ds.registry.filter((r) => r.id !== "s");
    expect(assembleDataset(rawFrom(ds)).errors.some((e) => e.includes("스케치에는 입문 순서가 없다"))).toBe(true);
  });

  it("도판은 여전히 전부 요구받는다 — 사다리가 무너지지 않았다", () => {
    // 장소를 아예 비우면 스키마가 먼저 잡는다. 여기서 재는 것은 그 다음 문 —
    // 장소는 있는데 어느 것이 그 사람의 자리인지 말하지 않는 경우다.
    const noPrimary = makeAuthor({ id: "b" });
    const ds = makeDataset(
      [makeAuthor({ id: "a" }), { ...noPrimary, locations: noPrimary.locations.map((l) => ({ ...l, primary: false })) }],
      []
    );
    expect(assembleDataset(rawFrom(ds)).errors.some((e) => e.includes("primary location"))).toBe(true);
  });
});
