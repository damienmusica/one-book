// R11 성계 구조의 계약 — 표현은 소유가 아니라 거리의 함수이고,
// 성좌는 데이터에 새겨진 소속이 아니라 켜져 있는 렌즈의 산물이다.

import { describe, expect, it } from "vitest";
import { makeAuthor, makeRelation } from "./fixtures.ts";
import {
  LANDING_ALT,
  SHELL_R,
  STAR_TO_DISC_PX,
  apparentRadiusPx,
  bodyRadius,
  genreHarmonics,
  influenceWeight,
  magnitude,
  periodOf,
  representationFor,
  starLife,
  starPixels,
  SILHOUETTE_AMP
} from "../src/universe/grammar.ts";
import { LENSES, buildLens, type LensInput } from "../src/universe/lenses.ts";
import {
  decodeShare,
  emptyPersonal,
  encodeShare,
  growth,
  readOrder,
  recommend
} from "../src/universe/personal.ts";

const LABELS = { region: (id: string) => id, language: (c: string) => c };

describe("표현 사다리 — 계층이 아니라 겉보기 크기", () => {
  it("같은 천체가 거리에 따라 별·구·지각이 된다", () => {
    const r = bodyRadius(1);
    const h = 900;
    const far = apparentRadiusPx(r, SHELL_R * 2, 42, h);
    const mid = apparentRadiusPx(r, 60, 42, h);
    const near = apparentRadiusPx(r, r * LANDING_ALT, 42, h);
    expect(representationFor(far, h)).toBe("star");
    expect(representationFor(mid, h)).toBe("resolved");
    expect(representationFor(near, h)).toBe("surface");
  });

  it("착륙 고도에서 천체가 화면을 지배한다 (겉보기 반경 > 화면 높이의 22%)", () => {
    const r = bodyRadius(0.4);
    const h = 900;
    expect(apparentRadiusPx(r, r * LANDING_ALT, 42, h)).toBeGreaterThan(h * 0.22);
  });

  it("천구 안으로 들어가도 이웃 천체는 별로 남는다 (검은 하늘 회귀 방지)", () => {
    // 원점에서 900 떨어진 껍질 위, 서로 900 쯤 떨어진 이웃
    const ap = apparentRadiusPx(bodyRadius(1), 900, 42, 900);
    expect(ap).toBeLessThan(STAR_TO_DISC_PX);
    expect(representationFor(ap, 900)).toBe("star");
  });
});

describe("광도 = 영향력 (R10 영토 면적과 같은 산식)", () => {
  it("tier 가 우선하고 관계 차수가 보정한다", () => {
    expect(influenceWeight("anchor", 0, 10)).toBeGreaterThan(influenceWeight("major", 10, 10));
    expect(influenceWeight("major", 10, 10)).toBeGreaterThan(influenceWeight("major", 0, 10));
  });

  it("광도가 별 크기와 천체 반경 모두를 정한다 — 채널이 갈라지지 않는다", () => {
    expect(starPixels(magnitude(influenceWeight("anchor", 10, 10)))).toBeGreaterThan(
      starPixels(magnitude(influenceWeight("context", 0, 10)))
    );
    expect(bodyRadius(1)).toBeGreaterThan(bodyRadius(0));
  });
});

describe("시간 — 별의 생성·활동·잔광", () => {
  const a = makeAuthor({ id: "x", birthYear: 1880, deathYear: 1940, activeRange: [1905, 1940] });
  it("태어나기 전에는 없다", () => {
    expect(starLife(a, 1870).presence).toBe(0);
  });
  it("활동기에는 최대로 점등한다", () => {
    expect(starLife(a, 1920).presence).toBe(1);
    expect(starLife(a, 1920).afterglow).toBe(false);
  });
  it("사후에는 잔광으로 남는다 — 작가는 죽고 작품은 남는다", () => {
    const after = starLife(a, 1980);
    expect(after.afterglow).toBe(true);
    expect(after.presence).toBeGreaterThan(0);
    expect(after.presence).toBeLessThan(1);
  });
});

describe("실루엣 = 장르 구성", () => {
  it("장르가 다르면 조화 계수가 다르다", () => {
    const poet = genreHarmonics(makeAuthor({ id: "p", genres: ["poetry"] }));
    const novelist = genreHarmonics(makeAuthor({ id: "n", genres: ["fiction"] }));
    expect(poet).not.toEqual(novelist);
  });
  it("진폭은 6% 를 넘지 않는다 — 실루엣이 광도 채널을 침범하지 않게", () => {
    const h = genreHarmonics(
      makeAuthor({ id: "all", genres: ["fiction", "poetry", "drama", "essay-criticism"] })
    );
    const worst = h.reduce((s, x) => s + Math.abs(x), 0) * SILHOUETTE_AMP;
    expect(worst).toBeLessThanOrEqual(0.13);
  });
});

describe("시대 = 색", () => {
  it("anchorYear 가 시대층을 정한다", () => {
    expect(periodOf(makeAuthor({ id: "a", anchorYear: 1885 }))).toBe("roots");
    expect(periodOf(makeAuthor({ id: "b", anchorYear: 1925 }))).toBe("early-modernism");
    expect(periodOf(makeAuthor({ id: "c", anchorYear: 1993 }))).toBe("contemporary");
  });
});

// ---------------------------------------------------------------------------

function lensInput(over: Partial<LensInput> = {}): LensInput {
  const authors = [
    makeAuthor({ id: "a1", movements: ["modernism"], languages: ["de"] }),
    makeAuthor({ id: "a2", movements: ["modernism"], languages: ["de"] }),
    makeAuthor({ id: "a3", movements: ["modernism"], languages: ["ja"] }),
    makeAuthor({
      id: "a4",
      movements: [],
      languages: ["ja"],
      locations: [{ label: "망명지", lat: 0, lon: 0, role: "exile", primary: true }]
    })
  ];
  return {
    authors,
    relations: [
      makeRelation("a1", "a2", "documented_influence"),
      makeRelation("a3", "a4", "translation"),
      makeRelation("a2", "a3", "affinity")
    ],
    positions: {
      a1: [1, 0, 0],
      a2: [0.9, 0.1, 0],
      a3: [0, 1, 0],
      a4: [0, 0, 1]
    },
    movementLabel: (id) => id,
    readOrder: [],
    wantIds: [],
    ...over
  };
}

describe("관측층 — 성좌는 켜져 있는 렌즈의 산물", () => {
  it("한 별이 여러 하늘에 동시에 속한다", () => {
    const input = lensInput();
    const byMovement = buildLens("movement", input);
    const byLanguage = buildLens("language", input);
    expect(byMovement.lit.has("a1")).toBe(true);
    expect(byLanguage.lit.has("a1")).toBe(true);
    // 같은 별이지만 이웃이 다르다 — 소속이 아니라 해석이기 때문
    expect(byMovement.groups[0]?.memberIds).not.toEqual(byLanguage.groups[0]?.memberIds);
  });

  it("속성 성좌는 그룹당 n-1 개의 선으로 이어진다 (각거리 최소신장트리)", () => {
    const r = buildLens("movement", lensInput());
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]?.memberIds).toHaveLength(3);
    expect(r.lines).toHaveLength(2);
  });

  it("관계 렌즈는 해당 유형만 그린다", () => {
    const t = buildLens("translation", lensInput());
    expect(t.lines).toHaveLength(1);
    expect(t.lines[0]?.relationId).toContain("translation");
    const i = buildLens("influence", lensInput());
    expect(i.lines).toHaveLength(1);
  });

  it("망명 렌즈는 기록된 망명 이력만 밝힌다", () => {
    const e = buildLens("exile", lensInput());
    expect([...e.lit]).toEqual(["a4"]);
  });

  it("개인 성좌는 읽은 순서를 따라 이어지고 담은 별도 밝힌다", () => {
    const r = buildLens("personal", lensInput({ readOrder: ["a1", "a3", "a2"], wantIds: ["a4"] }));
    expect(r.lines.map((l) => [l.a, l.b])).toEqual([
      ["a1", "a3"],
      ["a3", "a2"]
    ]);
    expect(r.lit.has("a4")).toBe(true);
  });

  it("일곱 개 렌즈가 모두 정의돼 있다", () => {
    expect(LENSES).toHaveLength(7);
  });
});

describe("개인 성좌 — 계정 없이", () => {
  it("공유 링크는 왕복한다", () => {
    const p = emptyPersonal();
    p.read["franz-kafka"] = 1;
    p.read["natsume-soseki"] = 2;
    p.want["rabindranath-tagore"] = 3;
    const back = decodeShare(encodeShare(p));
    expect(back && readOrder(back)).toEqual(["franz-kafka", "natsume-soseki"]);
    expect(back && Object.keys(back.want)).toEqual(["rabindranath-tagore"]);
  });

  it("성좌의 성장은 표시한 시각 순서다", () => {
    const p = emptyPersonal();
    p.read.b = 200;
    p.read.a = 100;
    expect(growth(p).map((g) => g.n)).toEqual([1, 2]);
    expect(readOrder(p)).toEqual(["a", "b"]);
  });

  it("추천은 읽은 별을 제외하고, 비어 있는 지역에 가산점을 준다", () => {
    const authors = [
      makeAuthor({ id: "read1", regions: ["western-europe"] }),
      makeAuthor({ id: "near", regions: ["western-europe"] }),
      makeAuthor({ id: "gap", regions: ["sub-saharan-africa"], languages: ["yo"] })
    ];
    const rels = [makeRelation("read1", "near"), makeRelation("read1", "gap")];
    const p = emptyPersonal();
    p.read.read1 = 1;
    const recs = recommend(p, authors, rels, (a) => a.difficulty, LABELS, 5);
    expect(recs.map((r) => r.authorId)).not.toContain("read1");
    const gap = recs.find((r) => r.authorId === "gap");
    const near = recs.find((r) => r.authorId === "near");
    expect(gap && near && gap.score).toBeGreaterThan(near!.score);
    expect(gap?.reasons.join(" ")).toContain("아직 비어 있는 지역");
  });

  it("모든 추천은 근거 문장을 갖는다 — 블랙박스 금지", () => {
    const authors = [makeAuthor({ id: "r" }), makeAuthor({ id: "x" })];
    const p = emptyPersonal();
    p.read.r = 1;
    for (const rec of recommend(p, authors, [makeRelation("r", "x")], (a) => a.difficulty, LABELS))
      expect(rec.reasons.length).toBeGreaterThan(0);
  });

  it("아무것도 안 읽었으면 추천하지 않는다", () => {
    expect(recommend(emptyPersonal(), [makeAuthor({ id: "a" })], [], () => 3, LABELS)).toEqual([]);
  });
});
