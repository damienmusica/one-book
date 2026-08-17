import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { UI } from "../src/i18n/index.ts";
import { METHODOLOGY } from "../src/i18n/methodology.ts";

/**
 * Truth contract (2026-08-16 4th review P0-1): what the UI says a visual
 * variable means must match the baked formula and the art thesis. A legend
 * once claimed "size AND height = documented influence" while the bake is
 * tier-first with ±30% all-relation modulation and the thesis bans height
 * outright. This test makes that class of drift a red build.
 */

const meta = JSON.parse(readFileSync(new URL("../data/territory.v1.json", import.meta.url), "utf8"))
  .params as Record<string, string>;

describe("legend/methodology ↔ territory bake contract", () => {
  it("the baked area formula is what the contract expects", () => {
    // if the bake formula ever changes, this pins force a legend +
    // methodology review in the same change
    expect(meta.areaWeight).toBe(
      "tierBase(anchor 2.4, major 1.0, context 0.55) * (1 + 0.3 * degreeHat)"
    );
    expect(Object.keys(meta)).not.toContain("elevation");
    expect(Object.keys(meta)).not.toContain("heightmap");
  });

  it("legend states tier-first area, ±30% modulation, and the absence of height", () => {
    for (const locale of ["ko", "en"] as const) {
      const s = UI[locale].legendTerrain;
      expect(s).toMatch(/±\s?30%/);
      expect(s).toMatch(locale === "ko" ? /편집 위계/ : /editorial tier/i);
      expect(s).toMatch(locale === "ko" ? /높이 없음/ : /no elevation/i);
      // the retired false claim must not come back
      expect(s).not.toMatch(locale === "ko" ? /크기·높이|높이\s*=/ : /size and height\s*=/i);
      const title = UI[locale].legendTerrainTitle;
      expect(title).toContain("2.4");
      expect(title).toContain("0.55");
      expect(title).toContain("0.3");
    }
  });

  it("methodology tells the same story as the legend", () => {
    for (const locale of ["ko", "en"] as const) {
      const body = METHODOLOGY[locale].coord.terrainBody;
      expect(body).toContain("2.4");
      expect(body).toContain("0.55");
      expect(body).toMatch(/±\s?30%/);
      expect(body).toContain("territory.v1.json");
    }
  });

  it("the art thesis height ban still stands in the design record", () => {
    const thesis = readFileSync(new URL("../docs/terrain-art-thesis.md", import.meta.url), "utf8");
    expect(thesis).toContain("높이 금지");
  });
});
