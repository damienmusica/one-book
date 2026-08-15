import { describe, expect, it } from "vitest";
import { labelBudget, labelPriority, lodLevel, tierVisibleAtLod } from "../src/lib/lod.ts";

describe("lodLevel", () => {
  it("maps camera distance to levels", () => {
    expect(lodLevel(420)).toBe("far");
    expect(lodLevel(250)).toBe("mid");
    expect(lodLevel(150)).toBe("near");
  });
});

describe("tierVisibleAtLod", () => {
  it("far shows anchors only; near shows everyone", () => {
    expect(tierVisibleAtLod("anchor", "far")).toBe(true);
    expect(tierVisibleAtLod("major", "far")).toBe(false);
    expect(tierVisibleAtLod("major", "mid")).toBe(true);
    expect(tierVisibleAtLod("context", "mid")).toBe(false);
    expect(tierVisibleAtLod("context", "near")).toBe(true);
  });
});

describe("labelPriority", () => {
  const base = {
    tier: "major" as const,
    isSelected: false,
    isHovered: false,
    isNeighborOfSelected: false,
    facingDot: 0.9
  };

  it("never labels the back hemisphere", () => {
    expect(labelPriority({ ...base, facingDot: -0.2 })).toBeLessThan(0);
  });

  it("selection beats hover beats neighbor beats anchor tier", () => {
    const sel = labelPriority({ ...base, isSelected: true });
    const hov = labelPriority({ ...base, isHovered: true });
    const nb = labelPriority({ ...base, isNeighborOfSelected: true });
    const anchor = labelPriority({ ...base, tier: "anchor" });
    expect(sel).toBeGreaterThan(hov);
    expect(hov).toBeGreaterThan(nb);
    expect(nb).toBeGreaterThan(anchor);
    expect(anchor).toBeGreaterThan(labelPriority(base));
  });

  it("budget grows as you zoom in", () => {
    expect(labelBudget("far")).toBeLessThan(labelBudget("mid"));
    expect(labelBudget("mid")).toBeLessThan(labelBudget("near"));
  });
});
