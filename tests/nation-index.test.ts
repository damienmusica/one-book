import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildLifeTexData, lifecycleOf, ownerOrderedAuthors } from "../src/globe/lifecycle.ts";
import type { Author } from "../src/types.ts";

/**
 * Owner-texture index contract (8th review). The terrain shader reads every
 * per-nation lookup (lifeTex, uLensNation, uContactIdx) at `oid`, an index
 * into territory.geometry.authors. Dataset order is DIFFERENT — 99/100 ids
 * diverge — and for one release the lens relief, contact flash and lifecycle
 * presence were painted on the wrong nations while state-level QA passed.
 * These pins make that class of bug a red build.
 */

const territory = JSON.parse(
  readFileSync(new URL("../data/territory.v1.json", import.meta.url), "utf8")
) as { geometry: { authors: string[] } };

const authorsDir = new URL("../data/authors/", import.meta.url);
const authors: Author[] = readdirSync(authorsDir)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .flatMap((f) => JSON.parse(readFileSync(new URL(f, authorsDir), "utf8")) as Author[]);

const geomIds = territory.geometry.authors;

describe("owner-texture index space", () => {
  it("dataset order ≠ owner order — the misindexing class is real, not hypothetical", () => {
    const datasetIds = authors.map((a) => a.id);
    expect(geomIds.length).toBe(datasetIds.length);
    const mismatches = geomIds.filter((id, i) => id !== datasetIds[i]).length;
    // if a future re-bake happens to align the orders this pin may relax,
    // but TODAY divergence is the reality every oid consumer must survive
    expect(mismatches).toBeGreaterThan(0);
  });

  it("ownerOrderedAuthors puts geometry.authors[i] at slot i with no slot drift", () => {
    const ordered = ownerOrderedAuthors(geomIds, authors);
    expect(ordered.length).toBe(geomIds.length);
    for (let i = 0; i < ordered.length; i++) {
      expect(ordered[i]!.id).toBe(geomIds[i]);
    }
  });

  it("lifeTex slot i carries the lifecycle of the nation the shader shades at oid i", () => {
    const ordered = ownerOrderedAuthors(geomIds, authors);
    const data = buildLifeTexData(ordered, 1920, "cumulative");
    for (const i of [0, 7, 21, 55, geomIds.length - 1]) {
      const a = ordered[i]!;
      const { presence, patina } = lifecycleOf(a, 1920, "cumulative");
      expect(data[i * 4]).toBe(Math.round(presence * 255));
      expect(data[i * 4 + 1]).toBe(Math.round(patina * 255));
    }
  });
});
