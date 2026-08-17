import { describe, expect, it } from "vitest";
import {
  LOD_DWELL_MS,
  LOD_ENTER_MID,
  LOD_ENTER_NEAR,
  LOD_EXIT_MID,
  LOD_EXIT_NEAR,
  LodGate
} from "../src/lib/lod.ts";
import { FOCUS_MAX_MS, FOCUS_MIN_MS, focusDuration } from "../src/globe/camera-controller.ts";

// 7th review PR1: boundary oscillation must not thrash tiers, deliberate
// travel must still change them, and focus durations stay in the 450–650 band.

describe("LodGate hysteresis", () => {
  it("±3% oscillation around the old 310 boundary never changes tier", () => {
    const g = new LodGate(340); // far
    let t = 0;
    for (let i = 0; i < 30; i++) {
      const dist = i % 2 === 0 ? 310 * 0.97 : 310 * 1.03; // 300.7 / 319.3
      g.update(dist, (t += 40));
    }
    expect(g.tier).toBe("far");
    expect(g.transitions).toBe(0);
  });

  it("±3% oscillation around the old 205 boundary never changes tier", () => {
    const g = new LodGate(250); // mid
    let t = 0;
    for (let i = 0; i < 30; i++) {
      const dist = i % 2 === 0 ? 205 * 0.97 : 205 * 1.03; // 198.9 / 211.2
      g.update(dist, (t += 40));
    }
    expect(g.tier).toBe("mid");
    expect(g.transitions).toBe(0);
  });

  it("entering and leaving happen at different distances (deadband)", () => {
    const g = new LodGate(340);
    let now = 0;
    expect(g.update(LOD_ENTER_MID - 1, (now += 200))).toBe("mid");
    // inside the deadband: no way back yet
    expect(g.update(LOD_ENTER_MID + 5, (now += 200))).toBe("mid");
    expect(g.update(LOD_EXIT_MID - 1, (now += 200))).toBe("mid");
    // past the exit: far again
    expect(g.update(LOD_EXIT_MID + 1, (now += 200))).toBe("far");
    expect(g.transitions).toBe(2);
  });

  it("near tier honours its own exit threshold", () => {
    const g = new LodGate(180); // near
    let now = 0;
    expect(g.update(LOD_EXIT_NEAR - 1, (now += 200))).toBe("near");
    expect(g.update(LOD_EXIT_NEAR + 1, (now += 200))).toBe("mid");
    expect(g.update(LOD_ENTER_NEAR + 1, (now += 200))).toBe("mid");
    expect(g.update(LOD_ENTER_NEAR - 1, (now += 200))).toBe("near");
  });

  it("a deep programmatic dive crosses both tiers, dwell-spaced", () => {
    const g = new LodGate(360);
    // instant jump to reading distance: first frame grants mid OR near?
    // far→near is a legal single step (the gate reads the distance, not the
    // path) — what dwell forbids is a SECOND change inside 120ms
    expect(g.update(150, 1000)).toBe("near");
    expect(g.update(360, 1000 + LOD_DWELL_MS - 20)).toBe("near"); // too soon
    expect(g.update(360, 1000 + LOD_DWELL_MS + 20)).toBe("far");
    expect(g.transitions).toBe(2);
  });

  it("dwell blocks immediate re-transition after a change", () => {
    const g = new LodGate(340);
    g.update(290, 1000); // far→mid
    expect(g.tier).toBe("mid");
    g.update(330, 1050); // wants far, but inside dwell
    expect(g.tier).toBe("mid");
    g.update(330, 1000 + LOD_DWELL_MS + 1);
    expect(g.tier).toBe("far");
  });
});

describe("focusDuration", () => {
  it("stays inside the 450–650ms band", () => {
    expect(focusDuration(0, 0, 280)).toBe(FOCUS_MIN_MS);
    expect(focusDuration(Math.PI, 280, 280)).toBe(FOCUS_MAX_MS);
    expect(focusDuration(Math.PI * 4, 9999, 280)).toBe(FOCUS_MAX_MS); // clamped
  });

  it("scales with the larger of angle and distance travel", () => {
    const half = focusDuration(Math.PI / 2, 0, 280);
    expect(half).toBeGreaterThan(FOCUS_MIN_MS);
    expect(half).toBeLessThan(FOCUS_MAX_MS);
    // distance-only travel also raises it
    expect(focusDuration(0, 140, 280)).toBeGreaterThan(FOCUS_MIN_MS);
  });
});
