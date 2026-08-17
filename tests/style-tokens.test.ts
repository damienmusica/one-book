import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// 7th review PR3: the legend/fallback had drifted onto a pre-warm-black cold
// palette because nothing stopped a hard-coded color from landing in a new
// rule. Every color now lives in the :root token sheet; this lint keeps it so.

describe("styles.css color-token lint", () => {
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

  it("declares the token sheet", () => {
    expect(css.includes(":root {")).toBe(true);
    expect(css.includes("--brass:")).toBe(true);
  });

  it("has no color literals outside :root", () => {
    const rootStart = css.indexOf(":root {");
    const rootEnd = css.indexOf("}", rootStart);
    const outside = css.slice(0, rootStart) + css.slice(rootEnd + 1);
    const noComments = outside.replace(/\/\*[\s\S]*?\*\//g, "");
    const hex = noComments.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    const rgb = noComments.match(/rgba?\(/g) ?? [];
    expect(hex, `hex literals outside :root: ${hex.join(", ")}`).toEqual([]);
    expect(rgb.length, `rgb()/rgba() literals outside :root: ${rgb.length}`).toBe(0);
  });

  it("map text floor: no label font-size below 13px (1080p reference)", () => {
    // every .globe-label* rule's font-size must be ≥13px — the 7th review
    // measured 11px relation labels as unreadable at the core map
    const labelBlocks = css.match(/\.globe-label[^{]*\{[^}]*\}/g) ?? [];
    const tooSmall: string[] = [];
    for (const block of labelBlocks) {
      const m = block.match(/font-size:\s*([\d.]+)px/);
      if (m && Number(m[1]) < 13) tooSmall.push(block.split("{")[0]!.trim() + ` (${m[1]}px)`);
    }
    expect(tooSmall, tooSmall.join("; ")).toEqual([]);
  });
});
