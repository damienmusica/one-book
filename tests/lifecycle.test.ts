import { describe, expect, it } from "vitest";
import {
  GHOST,
  buildLifeTexData,
  lifecycleEngaged,
  lifecycleOf,
  treatyOf,
  treatyPresence
} from "../src/globe/lifecycle.ts";
import { TIMELINE_MAX } from "../src/lib/filter.ts";
import { makeAuthor } from "./fixtures.ts";

const kafka = makeAuthor({
  id: "franz-kafka",
  activeRange: [1908, 1924],
  anchorYear: 1915,
  periods: ["early-modernism"]
});
const borges = makeAuthor({
  id: "jorge-luis-borges",
  activeRange: [1923, 1985],
  anchorYear: 1944,
  periods: ["mid-century"]
});
const dickinson = makeAuthor({
  id: "emily-dickinson",
  activeRange: [1858, 1886],
  anchorYear: 1862,
  periods: ["early-modernism"]
});

describe("lifecycleOf (cumulative)", () => {
  it("unformed land is a coast ghost", () => {
    const l = lifecycleOf(kafka, 1880, "cumulative");
    expect(l.presence).toBe(GHOST);
    expect(l.patina).toBe(0);
  });

  it("the founding ramp crosses half strength at activeRange[0]", () => {
    const l = lifecycleOf(kafka, 1908, "cumulative");
    expect(l.presence).toBeCloseTo(GHOST + (1 - GHOST) * 0.5, 5);
  });

  it("active years hold full presence with no patina", () => {
    const l = lifecycleOf(kafka, 1915, "cumulative");
    expect(l.presence).toBe(1);
    expect(l.patina).toBe(0);
  });

  it("heritage keeps the land and takes on patina — land is never lost", () => {
    const l = lifecycleOf(kafka, 1960, "cumulative");
    expect(l.presence).toBe(1);
    expect(l.patina).toBeCloseTo(0.85, 5);
  });
});

describe("lifecycleOf (active mode)", () => {
  it("ghosts nations outside their active range on both sides", () => {
    expect(lifecycleOf(kafka, 1890, "active").presence).toBe(GHOST);
    expect(lifecycleOf(kafka, 1915, "active").presence).toBe(1);
    expect(lifecycleOf(kafka, 1960, "active").presence).toBe(GHOST);
    expect(lifecycleOf(kafka, 1960, "active").patina).toBe(0);
  });
});

describe("lifecycleEngaged (default-look bypass)", () => {
  it("bypasses at 전체 시기 cumulative so the v1 plate is untouched", () => {
    expect(lifecycleEngaged(TIMELINE_MAX, "cumulative")).toBe(false);
  });
  it("engages when scrubbing or in active mode", () => {
    expect(lifecycleEngaged(1930, "cumulative")).toBe(true);
    expect(lifecycleEngaged(TIMELINE_MAX, "active")).toBe(true);
  });
});

describe("buildLifeTexData", () => {
  it("writes one RGBA texel per author (R=presence, G=patina)", () => {
    const data = buildLifeTexData([kafka, borges], 1960, "cumulative");
    expect(data[0]).toBe(255); // kafka presence 1
    expect(data[1]).toBe(Math.round(0.85 * 255)); // kafka full patina
    expect(data[4]).toBe(255); // borges active in 1960
    expect(data[5]).toBe(0);
  });
});

describe("treatyOf", () => {
  it("runs while at least two members are active concurrently", () => {
    const t = treatyOf([kafka, borges]); // overlap 1923–1924
    expect(t).toEqual({
      intervals: [{ start: 1923, end: 1924 }],
      start: 1923,
      end: 1924
    });
  });

  it("no concurrent overlap → no treaty", () => {
    expect(treatyOf([kafka, dickinson])).toBeNull();
    expect(treatyOf([kafka])).toBeNull();
  });

  it("a corpus lull stays a separate interval — gaps are never merged (5th review)", () => {
    const c = makeAuthor({
      id: "elias-canetti",
      activeRange: [1935, 1994],
      anchorYear: 1960,
      periods: ["mid-century"]
    });
    // ≥2-deep spans: 1923–24 (kafka+borges), 1935–85 (borges+canetti);
    // 1925–34 has only borges — not treaty time
    const t = treatyOf([kafka, borges, c]);
    expect(t?.intervals).toEqual([
      { start: 1923, end: 1924 },
      { start: 1935, end: 1985 }
    ]);
    // the cartouche's ≈ display span is the outer envelope
    expect(t?.start).toBe(1923);
    expect(t?.end).toBe(1985);
  });
});

describe("treatyPresence", () => {
  const t = { intervals: [{ start: 1910, end: 1945 }], start: 1910, end: 1945 };
  it("full strength at the atlas view (fader parked)", () => {
    expect(treatyPresence(t, TIMELINE_MAX, "cumulative")).toBe(1);
  });
  it("rises with founding, dissolves after the last members part", () => {
    expect(treatyPresence(t, 1900, "cumulative")).toBe(0);
    expect(treatyPresence(t, 1925, "cumulative")).toBe(1);
    expect(treatyPresence(t, 1965, "cumulative")).toBe(0);
  });
  it("multi-interval treaties dip in the gap and re-form with the next generation", () => {
    const g = {
      intervals: [
        { start: 1900, end: 1912 },
        { start: 1930, end: 1950 }
      ],
      start: 1900,
      end: 1950
    };
    expect(treatyPresence(g, 1906, "cumulative")).toBe(1); // first span holds
    const lull = treatyPresence(g, 1924, "cumulative");
    expect(lull).toBeLessThan(0.2); // ink dissolved 12y past the first span
    expect(treatyPresence(g, 1940, "cumulative")).toBe(1); // re-formed
  });
});
