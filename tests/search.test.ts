import { describe, expect, it } from "vitest";
import { buildSearchIndex, normalizeQuery, searchAuthors } from "../src/lib/search.ts";
import { makeAuthor } from "./fixtures.ts";

const authors = [
  makeAuthor({
    id: "ts-eliot",
    names: { ko: "T. S. 엘리엇", original: "T. S. Eliot", aliases: ["엘리엇", "Thomas Stearns Eliot"] }
  }),
  makeAuthor({
    id: "franz-kafka",
    names: { ko: "프란츠 카프카", original: "Franz Kafka", aliases: ["카프카"] }
  }),
  makeAuthor({
    id: "yi-sang",
    names: { ko: "이상", original: "李箱", aliases: ["김해경", "Yi Sang"] }
  })
];
const index = buildSearchIndex(authors);

describe("normalizeQuery", () => {
  it("strips dots and spaces so initials match", () => {
    expect(normalizeQuery("T.S. Eliot")).toBe(normalizeQuery("ts eliot"));
    expect(normalizeQuery("T. S. 엘리엇")).toBe("ts엘리엇");
  });
});

describe("searchAuthors", () => {
  it("finds by Korean name", () => {
    expect(searchAuthors(index, "카프카")[0]?.author.id).toBe("franz-kafka");
  });

  it("finds by original spelling, case-insensitive", () => {
    expect(searchAuthors(index, "kafka")[0]?.author.id).toBe("franz-kafka");
  });

  it("finds by alias (본명)", () => {
    const hits = searchAuthors(index, "김해경");
    expect(hits[0]?.author.id).toBe("yi-sang");
    expect(hits[0]?.matched).toBe("김해경");
  });

  it("matches dotted-initial queries", () => {
    expect(searchAuthors(index, "ts엘리")[0]?.author.id).toBe("ts-eliot");
    expect(searchAuthors(index, "t.s. eliot")[0]?.author.id).toBe("ts-eliot");
  });

  it("ranks prefix over substring", () => {
    const withPrefix = [
      ...authors,
      makeAuthor({
        id: "kafka-like",
        names: { ko: "가짜카프카", original: "Fake", aliases: [] }
      })
    ];
    const hits = searchAuthors(buildSearchIndex(withPrefix), "카프카");
    expect(hits[0]?.author.id).toBe("franz-kafka");
  });

  it("returns nothing for empty queries", () => {
    expect(searchAuthors(index, "  ")).toHaveLength(0);
  });
});
