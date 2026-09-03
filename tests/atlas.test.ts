// 도감 엔진 계약 — 결정 (137). 규칙 하나당 케이스 하나.
//
// 이 엔진의 주장은 하나다: **읽은 것이 다음 것을 연다.** 통계가 아니라 구조이고,
// 사용자 0명에서도 돈다. 아래가 그 주장을 실제로 재는 자리다.
import { describe, expect, it } from "vitest";
// @ts-expect-error — 브라우저 ESM 이지만 순수 함수는 그대로 import 된다
import { authorOf, census, litAuthors, openAt, readiness, isoWeek } from "../public/atlas.js";

const A = (i: string, over: Record<string, unknown> = {}) => ({
  i, k: i, o: i, b: 1900, e: 1980, y: 1950, r: "western-europe", l: "fr",
  p: ["mid-century"], d: "plate", t: "context", w: 3, ...over
});
const E = (s: string, t: string, over: Record<string, unknown> = {}) =>
  ({ s, t, y: "documented_influence", d: 1, v: 3, m: `${s}가 ${t}에게`, ...over });

/** graph() 는 fetch 를 쓰므로, 테스트는 같은 모양의 객체를 손으로 만든다. */
function buildGraph(authors: unknown[], edges: unknown[]) {
  const byId = new Map(authors.map((a: any) => [a.i, a]));
  const out = new Map(); const inn = new Map(); const side = new Map();
  const push = (m: Map<string, unknown[]>, k: string, v: unknown) => m.set(k, (m.get(k) || []).concat([v]));
  for (const e of edges as any[]) {
    const rec = (to: string) => ({ to, type: e.y, ev: e.v, why: e.m });
    if (e.d) { push(out, e.s, rec(e.t)); push(inn, e.t, rec(e.s)); }
    else { push(side, e.s, rec(e.t)); push(side, e.t, rec(e.s)); }
  }
  return { raw: { authors, edges }, byId, out, inn, side } as any;
}

describe("불이 켜진 작가 — 작품 표시가 작가로 올라간다", () => {
  it("작품 id 에서 작가를 뽑는다", () => {
    expect(authorOf("franz-kafka--die-verwandlung")).toBe("franz-kafka");
  });
  it("칸이 높을수록 밝다 (읽음 > 펼침 > 관심)", () => {
    const lit = litAuthors({ state: { "a--x": { s: "want" }, "b--y": { s: "read" } } });
    expect(lit.get("a")).toBe(1);
    expect(lit.get("b")).toBe(3);
  });
  it("같은 작가의 여러 책 중 가장 높은 칸이 이긴다", () => {
    const lit = litAuthors({ state: { "a--x": { s: "want" }, "a--y": { s: "read" } } });
    expect(lit.get("a")).toBe(3);
  });
});

describe("준비도 — 읽은 것이 다음 것을 연다", () => {
  const g = buildGraph([A("kafka"), A("marquez"), A("dostoevsky")], [
    E("kafka", "marquez"),      // 카프카 → 마르케스 (카프카가 영향을 주었다)
    E("dostoevsky", "kafka")    // 도스토옙스키 → 카프카
  ]);
  const lit = new Map([["kafka", 3]]);

  it("읽은 작가가 영향을 준 쪽이 '열린다'", () => {
    const r = readiness(g, lit);
    const m = r.find((x: any) => x.id === "marquez");
    expect(m.kind).toBe("opens");
    expect(m.from).toBe("kafka");
  });
  it("읽은 작가에게 영향을 준 쪽은 '뿌리'다 — 다른 문장이다", () => {
    const d = readiness(g, lit).find((x: any) => x.id === "dostoevsky");
    expect(d.kind).toBe("root");
  });
  it("이미 만난 사람은 열 것이 없다", () => {
    const r = readiness(g, new Map([["kafka", 3], ["marquez", 1]]));
    expect(r.find((x: any) => x.id === "marquez")).toBeUndefined();
  });
  it("표시가 없으면 아무것도 열리지 않는다 — 추측하지 않는다", () => {
    expect(readiness(g, new Map())).toEqual([]);
  });
  it("읽음이 담기보다 밝다 — 칸이 신호의 세기다", () => {
    const hi = readiness(g, new Map([["kafka", 3]])).find((x: any) => x.id === "marquez").score;
    const lo = readiness(g, new Map([["kafka", 1]])).find((x: any) => x.id === "marquez").score;
    expect(hi).toBeGreaterThan(lo);
  });
  it("근거가 강한 엣지가 더 밝다 — 정직성이 순위에 들어간다", () => {
    const strong = buildGraph([A("a"), A("b")], [E("a", "b", { v: 3 })]);
    const weak = buildGraph([A("a"), A("b")], [E("a", "b", { v: 1 })]);
    const s = readiness(strong, new Map([["a", 3]]))[0].score;
    const w = readiness(weak, new Map([["a", 3]]))[0].score;
    expect(s).toBeGreaterThan(w);
  });
  it("여러 선행자가 가리키면 더 밝다", () => {
    const g2 = buildGraph([A("a"), A("b"), A("c")], [E("a", "c"), E("b", "c")]);
    const one = readiness(g2, new Map([["a", 3]]))[0].score;
    const two = readiness(g2, new Map([["a", 3], ["b", 3]]))[0].score;
    expect(two).toBeGreaterThan(one);
  });
  it("방향 없는 관계는 '곁'이다 — 인과를 약속하지 않는다", () => {
    const g3 = buildGraph([A("a"), A("b")], [E("a", "b", { d: 0, y: "affinity" })]);
    expect(readiness(g3, new Map([["a", 3]]))[0].kind).toBe("beside");
  });
});

describe("조우 — 책이 열리는 쪽", () => {
  const g = buildGraph([A("kafka"), A("marquez")], [E("kafka", "marquez")]);
  it("표시가 없으면 도판에서 한 사람이 열린다 (묻지 않는다)", () => {
    const o = openAt(g, new Map());
    expect(o.first).toBe(true);
    expect(["kafka", "marquez"]).toContain(o.id);
  });
  it("같은 주에는 같은 쪽이 열린다 — 다시 찾을 수 있어야 오솔길이다", () => {
    expect(openAt(g, new Map()).id).toBe(openAt(g, new Map()).id);
  });
  it("표시가 있으면 준비도에서 열린다", () => {
    const o = openAt(g, new Map([["kafka", 3]]));
    expect(o.first).toBe(false);
    expect(o.id).toBe("marquez");
  });
  it("실루엣만 있는 세계에서도 죽지 않는다", () => {
    const only = buildGraph([A("s", { d: "silhouette", w: 0 })], []);
    expect(openAt(only, new Map())).toBeNull();
  });
});

describe("도감 계수 — 세계를 얼마나 봤는가", () => {
  const g = buildGraph(
    [A("a"), A("b"), A("c", { r: "east-asia" })],
    [E("a", "b")]
  );
  it("만난 수와 전체를 센다", () => {
    const c = census(g, new Map([["a", 3]]));
    expect(c.total).toBe(3);
    expect(c.met).toBe(1);
  });
  it("지금 열린 수를 센다", () => {
    expect(census(g, new Map([["a", 3]])).openNow).toBe(1);
  });
  it("권역별로 나눈다 — 문해의 지도이지 점수가 아니다", () => {
    const c = census(g, new Map([["a", 3]]));
    expect(c.byRegion.get("western-europe")).toEqual({ total: 2, met: 1 });
    expect(c.byRegion.get("east-asia")).toEqual({ total: 1, met: 0 });
  });
  it("아무것도 안 봤어도 세계는 완전하다", () => {
    expect(census(g, new Map()).total).toBe(3);
  });
});

describe("주차", () => {
  it("ISO 주차가 1..53 안에 있다", () => {
    const w = isoWeek(new Date("2026-09-04"));
    expect(w).toBeGreaterThan(0);
    expect(w).toBeLessThanOrEqual(53);
  });
});
