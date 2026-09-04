import { describe, expect, it } from "vitest";
import { REGION_DEFS, REGION_NEIGHBORS } from "../src/types.ts";

describe("권역 인접은 지리 사실이고 사실은 대칭이다", () => {
  // 격자가 같은 권역에서 이웃을 못 찾을 때 여기서 이웃한 자리를 찾는다. 동남아 59명이
  // 도판 100인에서 닿지 않던 것이 이 표로 풀렸다 — 다리는 사람이 아니라 지리다.
  const ids = new Set(REGION_DEFS.map((r) => r.id));

  it("모든 권역이 인접을 갖는다 — 인접 없는 권역은 섬이다", () => {
    for (const r of ids) expect(REGION_NEIGHBORS[r]?.length ?? 0, r).toBeGreaterThan(0);
  });
  it("인접은 실재하는 권역만 가리킨다", () => {
    for (const [r, ns] of Object.entries(REGION_NEIGHBORS)) {
      expect(ids.has(r), r).toBe(true);
      for (const n of ns) expect(ids.has(n), `${r} → ${n}`).toBe(true);
    }
  });
  it("A 가 B 와 접하면 B 도 A 와 접한다", () => {
    for (const [r, ns] of Object.entries(REGION_NEIGHBORS))
      for (const n of ns) expect(REGION_NEIGHBORS[n], `${n} 에 ${r} 가 없다`).toContain(r);
  });
  it("자기 자신과 접하지 않는다", () => {
    for (const [r, ns] of Object.entries(REGION_NEIGHBORS)) expect(ns, r).not.toContain(r);
  });
  it("전체가 하나로 이어진다 — 어느 권역에서 출발해도 전부에 닿는다", () => {
    const start = "western-europe";
    const seen = new Set([start]);
    const q = [start];
    while (q.length) for (const n of REGION_NEIGHBORS[q.shift()!] ?? []) if (!seen.has(n)) { seen.add(n); q.push(n); }
    expect([...ids].filter((r) => !seen.has(r))).toEqual([]);
  });
});
