import { describe, expect, it } from "vitest";
import { isAuthorVisible, visibleRelations, visibleAuthorIds } from "../src/lib/filter.ts";
import { defaultFilters } from "../src/state/store.ts";
import { makeAuthor, makeRelation } from "./fixtures.ts";

const kafka = makeAuthor({
  id: "franz-kafka",
  periods: ["early-modernism"],
  genres: ["fiction"],
  activeRange: [1908, 1924],
  languages: ["de"],
  regions: ["central-europe"]
});
const atwood = makeAuthor({
  id: "margaret-atwood",
  periods: ["late-postmodern", "contemporary"],
  genres: ["fiction", "poetry"],
  activeRange: [1961, 2023],
  speculative: true
});

describe("isAuthorVisible", () => {
  it("hides an author whose every period is off", () => {
    const f = { ...defaultFilters(), periods: ["mid-century" as const] };
    expect(isAuthorVisible(kafka, f, 2026, "cumulative")).toBe(false);
  });

  it("keeps a multi-period author when one period stays on", () => {
    // contemporary is off by default — atwood remains via late-postmodern
    expect(defaultFilters().periods).not.toContain("contemporary");
    expect(isAuthorVisible(atwood, defaultFilters(), 2026, "cumulative")).toBe(true);
  });

  it("cumulative year hides authors who start later", () => {
    expect(isAuthorVisible(kafka, defaultFilters(), 1900, "cumulative")).toBe(false);
    expect(isAuthorVisible(kafka, defaultFilters(), 1910, "cumulative")).toBe(true);
    expect(isAuthorVisible(kafka, defaultFilters(), 1980, "cumulative")).toBe(true);
  });

  it("active year keeps only authors active that year", () => {
    expect(isAuthorVisible(kafka, defaultFilters(), 1915, "active")).toBe(true);
    expect(isAuthorVisible(kafka, defaultFilters(), 1980, "active")).toBe(false);
  });

  it("speculative-only keeps only tagged authors", () => {
    const f = { ...defaultFilters(), speculativeOnly: true };
    expect(isAuthorVisible(kafka, f, 2026, "cumulative")).toBe(false);
    expect(isAuthorVisible(atwood, f, 2026, "cumulative")).toBe(true);
  });

  it("language and region filters restrict", () => {
    expect(
      isAuthorVisible(kafka, { ...defaultFilters(), languages: ["ja"] }, 2026, "cumulative")
    ).toBe(false);
    expect(
      isAuthorVisible(kafka, { ...defaultFilters(), regions: ["central-europe"] }, 2026, "cumulative")
    ).toBe(true);
  });
});

describe("visibleRelations", () => {
  it("hides relations with a hidden endpoint or disabled type", () => {
    const authors = [kafka, atwood];
    const rels = [
      makeRelation("franz-kafka", "margaret-atwood", "affinity"),
      makeRelation("franz-kafka", "margaret-atwood", "contrast")
    ];
    const f = defaultFilters(); // contrast off by default
    const vis = visibleAuthorIds(authors, f, 2026, "cumulative");
    expect(visibleRelations(rels, f, vis).map((r) => r.type)).toEqual(["affinity"]);

    const early = visibleAuthorIds(authors, f, 1930, "cumulative"); // atwood not yet
    expect(visibleRelations(rels, f, early)).toHaveLength(0);
  });
});
