import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { UI } from "../src/i18n/index.ts";
import { METHODOLOGY } from "../src/i18n/methodology.ts";
import { UNION_COLORS } from "../src/theme.ts";

/**
 * Truth contract (2026-08-16 4th review P0-1): what the UI says a visual
 * variable means must match the baked formula and the art thesis. A legend
 * once claimed "size AND height = documented influence" while the bake is
 * tier-first with ±30% all-relation modulation and the thesis bans height
 * outright. This test makes that class of drift a red build.
 */

const meta = JSON.parse(readFileSync(new URL("../data/territory.v1.json", import.meta.url), "utf8"))
  .params as Record<string, string>;

const eras = JSON.parse(
  readFileSync(new URL("../data/territory.v1.eras.json", import.meta.url), "utf8")
) as { params: Record<string, unknown>; keyframes: Array<{ year: number }> };

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

  it("union legend declares the landless-treaty model (D1)", () => {
    expect(UI.ko.legendUnion).toContain("조약");
    expect(UI.ko.legendUnion).toContain("작가");
    expect(UI.en.legendUnion.toLowerCase()).toContain("treat");
    expect(UNION_COLORS.length).toBeGreaterThanOrEqual(8);
  });

  it("treaty spans are marked as computed, not historical (5th review P0-2)", () => {
    expect(UI.ko.legendUnion).toContain("≈");
    expect(UI.ko.legendUnion).toContain("계산");
    expect(UI.en.legendUnion).toContain("≈");
    expect(UI.en.legendUnion.toLowerCase()).toContain("computed");
    expect(METHODOLOGY.ko.coord.terrainBody).toContain("활동 중첩");
    expect(METHODOLOGY.en.coord.terrainBody.toLowerCase()).toContain("active ranges");
  });

  it("legend + methodology tell the v2.5 tectonic story the bake actually implements", () => {
    // the retired claim must never come back: the fader DOES move coastlines
    expect(METHODOLOGY.ko.coord.terrainBody).not.toContain("해안선을 움직이지 않는다");
    expect(METHODOLOGY.en.coord.terrainBody.toLowerCase()).not.toContain("moves no coastline");

    // bind the user-facing numbers to the shipped eras file
    const years = eras.keyframes.map((k) => k.year);
    const span = `${years[0]}–${years[years.length - 1]}`;
    const count = String(eras.keyframes.length);
    const gMin = String(eras.params.gMin);
    for (const locale of ["ko", "en"] as const) {
      const legend = UI[locale].legendEra;
      const title = UI[locale].legendEraTitle;
      const body = METHODOLOGY[locale].coord.terrainBody;
      expect(legend).toContain(span);
      expect(legend).toMatch(new RegExp(`${count}\\s?(개 키프레임|keyframes)`));
      expect(legend).toMatch(locale === "ko" ? /계산치/ : /computed/i);
      expect(title).toContain(gMin);
      expect(title).toContain("territory.v1.eras.json");
      expect(body).toContain(gMin);
      expect(body).toContain(String(years[0]));
      expect(body).toContain(String(years[years.length - 1]));
      // the curated-corpus caveat: growth is editorial, not measured output
      expect(body).toMatch(locale === "ko" ? /수록 작품|선별/ : /curated/i);
    }
    // the growth story in prose must stay anchored to the bake's formula string
    expect(String(eras.params.growth)).toContain("0.5*foundingRamp");
    expect(String(eras.params.growth)).toContain("0.5*publishedWorksShare");
    expect(UI.ko.legendEraTitle).toContain("0.5 × 건국 램프");
    expect(UI.en.legendEraTitle).toContain("0.5 × founding ramp");
  });

  it("sovereignty states named in the legend match the lifecycle model", () => {
    for (const [ko, en] of [
      ["미형성", "unformed"],
      ["형성", "founding"],
      ["활동", "active"],
      ["유산", "heritage"]
    ] as const) {
      expect(UI.ko.legendEra).toContain(ko);
      expect(UI.en.legendEra.toLowerCase()).toContain(en);
    }
    expect(UI.ko.legendEra).toContain("출간");
    expect(UI.en.legendEra.toLowerCase()).toContain("publication");
  });
});
