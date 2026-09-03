// 도감 엔진 계약 — 결정 (137). 규칙 하나당 케이스 하나.
//
// 이 엔진의 주장은 하나다: **읽은 것이 다음 것을 연다.** 통계가 아니라 구조이고,
// 사용자 0명에서도 돈다. 아래가 그 주장을 실제로 재는 자리다.
import { describe, expect, it } from "vitest";
// @ts-expect-error — 브라우저 ESM 이지만 순수 함수는 그대로 import 된다
import { authorOf, census, KIND_KO, litAuthors, openAt, readiness, isoWeek } from "../public/atlas.js";

const A = (i: string, over: Record<string, unknown> = {}) => ({
  i, k: i, o: i, b: 1900, e: 1980, y: 1950, r: "western-europe", l: "fr",
  p: ["mid-century"], d: "plate", t: "context", w: 3, ...over
});
const E = (s: string, t: string, over: Record<string, unknown> = {}) =>
  ({ s, t, y: "documented_influence", d: 1, v: 3, m: `${s}가 ${t}에게`, ...over });

/** graph() 는 fetch 를 쓰므로, 테스트는 같은 모양의 객체를 손으로 만든다. */
function buildGraph(authors: unknown[], edges: unknown[], near: number[][] = []) {
  const byId = new Map(authors.map((a: any) => [a.i, a]));
  const out = new Map(); const inn = new Map(); const side = new Map();
  const push = (m: Map<string, unknown[]>, k: string, v: unknown) => m.set(k, (m.get(k) || []).concat([v]));
  for (const e of edges as any[]) {
    const rec = (to: string) => ({ to, type: e.y, ev: e.v, why: e.m });
    if (e.d) { push(out, e.s, rec(e.t)); push(inn, e.t, rec(e.s)); }
    else { push(side, e.s, rec(e.t)); push(side, e.t, rec(e.s)); }
  }
  const nearMap = new Map<string, string[]>();
  near.forEach((list, i) => {
    const from = (authors as any[])[i];
    if (from) nearMap.set(from.i, list.map((n) => (authors as any[])[n]).filter(Boolean).map((b: any) => b.i));
  });
  return { raw: { authors, edges, near }, byId, out, inn, side, near: nearMap } as any;
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

describe("격자 — 세계의 93%가 첫 장에 오는 길", () => {
  // 준비도(엣지)와 격자(같은 때 같은 자리)는 다른 물음이다. 인구조사의 '지금 열린 쪽'은
  // 준비도만 세고, 오늘 어느 쪽이 열리는가에는 둘 다 후보가 된다 — 아니면 도판 100인이
  // 100주에 소진되고 실루엣 1,365명은 영영 첫 장에 오지 못한다.
  const four = () => [A("kafka"), A("rilke"), A("musil"), A("broch", { d: "silhouette" })];

  // 세 주에 한 주는 이웃의 주다. 계약은 두 종류의 주를 다 시험해야 하므로 둘을 찾아둔다.
  const NEAR_WEEK = [...Array(60).keys()].find((w) => {
    const g = buildGraph(four(), [E("kafka", "musil")], [[1, 2, 3], [0], [0], [0]]);
    return openAt(g, litAuthors({ state: { "kafka--w": { s: "read", at: 1 } } }), w)?.kind === "near";
  })!;
  const EDGE_WEEK = [...Array(60).keys()].find((w) => {
    const g = buildGraph(four(), [E("kafka", "musil")], [[1, 2, 3], [0], [0], [0]]);
    return openAt(g, litAuthors({ state: { "kafka--w": { s: "read", at: 1 } } }), w)?.kind === "opens";
  })!;

  it("두 종류의 주가 둘 다 존재한다 — 한쪽만 있으면 규칙이 죽은 것이다", () => {
    expect(NEAR_WEEK).toBeDefined();
    expect(EDGE_WEEK).toBeDefined();
  });

  it("엣지가 하나도 없어도 표시가 있으면 쪽이 열린다", () => {
    const g = buildGraph(four(), [], [[1, 2, 3], [0], [0], [0]]);
    const o = openAt(g, litAuthors({ state: { "kafka--w": { s: "read", at: 1 } } }), EDGE_WEEK);
    expect(o?.first).toBe(false);
    expect(o?.kind).toBe("near");
    expect(["rilke", "musil", "broch"]).toContain(o?.id);
  });

  it("격자로 열린 쪽은 다른 문장을 쓴다", () => {
    expect(KIND_KO.near("카프카")).toBe("카프카와 같은 때, 같은 자리에 있었다");
    expect(KIND_KO.near("카프카")).not.toBe(KIND_KO.beside("카프카"));
  });

  it("보통 주에는 엣지가 이긴다 — 근거가 다른 종류다", () => {
    const g = buildGraph(four(), [E("kafka", "musil")], [[1, 2, 3], [0], [0], [0]]);
    const o = openAt(g, litAuthors({ state: { "kafka--w": { s: "read", at: 1 } } }), EDGE_WEEK);
    expect(o?.kind).toBe("opens");
    expect(o?.id).toBe("musil");
  });

  it("이웃의 주에는 엣지가 있어도 이웃이 온다 — 점수가 아니라 자리다", () => {
    const g = buildGraph(four(), [E("kafka", "musil")], [[1, 2, 3], [0], [0], [0]]);
    const o = openAt(g, litAuthors({ state: { "kafka--w": { s: "read", at: 1 } } }), NEAR_WEEK);
    expect(o?.kind).toBe("near");
  });

  it("이웃의 주라도 이웃이 없으면 엣지로 연다 — 빈 주는 없다", () => {
    const g = buildGraph([A("kafka"), A("musil")], [E("kafka", "musil")], [[], []]);
    const o = openAt(g, litAuthors({ state: { "kafka--w": { s: "read", at: 1 } } }), NEAR_WEEK);
    expect(o?.kind).toBe("opens");
  });

  it("책이 없는 이웃은 열지 않는다 — 열어도 담을 것이 없다", () => {
    const g = buildGraph([A("kafka"), A("rilke", { w: 0 })], [], [[1], [0]]);
    const o = openAt(g, litAuthors({ state: { "kafka--w": { s: "read", at: 1 } } }), NEAR_WEEK);
    expect(o?.first).toBe(true);
  });

  it("이미 만난 사람은 격자로도 다시 열리지 않는다", () => {
    const g = buildGraph([A("kafka"), A("rilke")], [], [[1], [0]]);
    const lit = litAuthors({ state: { "kafka--w": { s: "read", at: 1 }, "rilke--w": { s: "read", at: 2 } } });
    expect(openAt(g, lit, NEAR_WEEK)?.first).toBe(true);
  });

  it("인구조사의 '지금 열린 쪽'은 격자를 세지 않는다", () => {
    const g = buildGraph(four(), [], [[1, 2, 3], [0], [0], [0]]);
    expect(census(g, litAuthors({ state: { "kafka--w": { s: "read", at: 1 } } })).openNow).toBe(0);
  });
});

describe("조사 — 이름은 데이터에서 오고 데이터에는 둘 다 있다", () => {
  it("받침이 있으면 을·과", () => {
    expect(KIND_KO.opens("토니 모리슨")).toBe("토니 모리슨을 읽었으니 이제 열린다");
    expect(KIND_KO.near("토니 모리슨")).toBe("토니 모리슨과 같은 때, 같은 자리에 있었다");
  });
  it("받침이 없으면 를·와", () => {
    expect(KIND_KO.opens("프란츠 카프카")).toBe("프란츠 카프카를 읽었으니 이제 열린다");
    expect(KIND_KO.near("프란츠 카프카")).toBe("프란츠 카프카와 같은 때, 같은 자리에 있었다");
  });
  it("이름 앞이 로마자여도 끝글자로 판정한다 — '트'는 종성이 없다", () => {
    expect(KIND_KO.near("W. G. 제발트")).toBe("W. G. 제발트와 같은 때, 같은 자리에 있었다");
    expect(KIND_KO.opens("김소월")).toBe("김소월을 읽었으니 이제 열린다");
  });
  it("한글이 아닌 끝글자는 받침 없음으로 읽는다", () => {
    expect(KIND_KO.near("Kafka")).toBe("Kafka와 같은 때, 같은 자리에 있었다");
    expect(KIND_KO.opens("魯迅")).toBe("魯迅를 읽었으니 이제 열린다");
  });
});
