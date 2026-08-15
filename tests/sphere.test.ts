import { describe, expect, it } from "vitest";
import {
  angleBetween,
  arcPoints,
  geodesic,
  latLonToVec3,
  norm,
  slerp
} from "../src/lib/sphere.ts";

describe("latLonToVec3", () => {
  it("maps the poles and equator correctly", () => {
    const north = latLonToVec3(90, 0);
    expect(north[1]).toBeCloseTo(1);
    const greenwich = latLonToVec3(0, 0);
    expect(greenwich).toEqual([0, 0, 1]);
    const east90 = latLonToVec3(0, 90);
    expect(east90[0]).toBeCloseTo(1);
    expect(east90[2]).toBeCloseTo(0);
  });

  it("always returns unit vectors", () => {
    for (const [lat, lon] of [
      [50.09, 14.42],
      [-33.45, -70.66],
      [35.68, 139.69]
    ] as const) {
      expect(norm(latLonToVec3(lat, lon))).toBeCloseTo(1);
    }
  });
});

describe("slerp", () => {
  it("hits both endpoints and stays on the sphere", () => {
    const a = latLonToVec3(0, 0);
    const b = latLonToVec3(0, 90);
    expect(slerp(a, b, 0)).toEqual(a);
    const end = slerp(a, b, 1);
    expect(end[0]).toBeCloseTo(b[0]);
    const mid = slerp(a, b, 0.5);
    expect(norm(mid)).toBeCloseTo(1);
    expect(angleBetween(a, mid)).toBeCloseTo(angleBetween(mid, end));
  });
});

describe("arcPoints", () => {
  it("lifts the middle of the arc above the sphere", () => {
    const pts = arcPoints(latLonToVec3(0, 0), latLonToVec3(0, 60), 16, 100);
    expect(pts).toHaveLength(17);
    expect(norm(pts[0]!)).toBeCloseTo(100, 1);
    expect(norm(pts[16]!)).toBeCloseTo(100, 1);
    expect(norm(pts[8]!)).toBeGreaterThan(100.5);
  });
});

describe("geodesic", () => {
  it("quarter turn is π/2", () => {
    expect(geodesic(latLonToVec3(0, 0), latLonToVec3(0, 90))).toBeCloseTo(Math.PI / 2);
  });
});
