// R11 성계 구조의 계약 — 표현은 소유가 아니라 거리의 함수이고,
// 성좌는 데이터에 새겨진 소속이 아니라 켜져 있는 렌즈의 산물이다.

import { describe, expect, it } from "vitest";
import { makeAuthor, makeRelation } from "./fixtures.ts";
import {
  LANDING_ALT,
  LENS_MAX,
  LENS_MIN,
  lensCompress,
  lensPosition,
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
  SILHOUETTE_AMP,
  silhouetteRadius,
  SHELF_LON,
  VOL_AIR,
  VOL_ASPECT,
  VOL_DEPTH,
  VOL_W_MAX,
  volumeWidth,
  shelfLongitudes,
  shelfTickStep,
  yearToLon
} from "../src/universe/grammar.ts";
import { LENSES, buildLens, type LensInput } from "../src/universe/lenses.ts";
import {
  READINESS,
  READY_IDS,
  isLandable,
  readinessState
} from "../src/universe/readiness.ts";
import {
  decodeShare,
  emptyPersonal,
  encodeShare,
  growth,
  readOrder,
  recommendTracks
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

describe("관측 렌즈 — 회귀 방지 계약(지각적 성공은 사람이 판정한다)", () => {
  it("압축은 단조 증가한다", () => {
    const a = lensCompress(200, 200, 1600);
    const b = lensCompress(800, 200, 1600);
    const c = lensCompress(1600, 200, 1600);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });

  it("압축 결과는 렌즈 반경 범위 안에 있다 — 확대된 천체와 겹치지 않는다", () => {
    for (const d of [200, 500, 900, 1600]) {
      const r = lensCompress(d, 200, 1600);
      expect(r).toBeGreaterThanOrEqual(LENS_MIN);
      expect(r).toBeLessThanOrEqual(LENS_MAX);
    }
  });

  it("각방향을 정확히 보존한다 — 반경만 바뀐다", () => {
    // 이전 테스트는 `lensCompress(500) === lensCompress(500)` 이라는 결정성만
    // 확인하는 오탐이었다(R11-c). 이제 장면이 실제로 쓰는 함수를 검증한다.
    const focus: [number, number, number] = [900, 0, 0];
    const unit = (v: number[]): number[] => {
      const n = Math.hypot(v[0] as number, v[1] as number, v[2] as number);
      return v.map((x) => x / n);
    };
    for (const orig of [
      [400, 700, 200],
      [-100, -300, 850],
      [905, 3, -1200]
    ] as Array<[number, number, number]>) {
      const moved = lensPosition(focus, orig, 200, 1600);
      const before = unit([orig[0] - focus[0], orig[1] - focus[1], orig[2] - focus[2]]);
      const after = unit([moved[0] - focus[0], moved[1] - focus[1], moved[2] - focus[2]]);
      for (let k = 0; k < 3; k++)
        expect(after[k] as number).toBeCloseTo(before[k] as number, 10);
      // 그리고 반경은 실제로 바뀌었다
      const dBefore = Math.hypot(orig[0] - focus[0], orig[1] - focus[1], orig[2] - focus[2]);
      const dAfter = Math.hypot(moved[0] - focus[0], moved[1] - focus[1], moved[2] - focus[2]);
      expect(dAfter).not.toBeCloseTo(dBefore, 1);
      expect(dAfter).toBeGreaterThanOrEqual(LENS_MIN - 1e-9);
      expect(dAfter).toBeLessThanOrEqual(LENS_MAX + 1e-9);
    }
  });

  it("초점 자신은 움직이지 않는다", () => {
    expect(lensPosition([900, 0, 0], [900, 0, 0], 200, 1600)).toEqual([900, 0, 0]);
  });

  it("범위가 퇴화해도 하한을 돌려준다", () => {
    expect(lensCompress(5, 10, 10)).toBe(LENS_MIN);
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
    expect(byMovement.marks.get("a1")).toBeDefined();
    expect(byLanguage.marks.get("a1")).toBeDefined();
  });

  it("속성 렌즈는 선을 그리지 않는다 — 선 채널은 실제 관계의 것이다", () => {
    for (const id of ["movement", "language", "exile"] as const)
      expect(buildLens(id, lensInput()).lines).toHaveLength(0);
  });

  it("소속은 색인 번호로만 말한다 — 밝기·색·링을 빌리지 않는다", () => {
    const r = buildLens("movement", lensInput());
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]?.index).toBe(1);
    expect(r.marks.get("a1")).toEqual([1]);
    expect(r.marks.has("a4")).toBe(false);
  });

  it("여러 그룹에 속하면 색인 번호가 여러 개 붙는다", () => {
    // 이전 테스트는 `v.length >= 1` 이어서 소속이 하나여도 통과하는 오탐이었다.
    const input = lensInput();
    // a3 를 두 언어에 소속시킨다 (일본어 + 영어)
    const a3 = input.authors.find((a) => a.id === "a3");
    if (a3) a3.languages = ["ja", "en"];
    const a1 = input.authors.find((a) => a.id === "a1");
    if (a1) a1.languages = ["de", "en"];
    const r = buildLens("language", input);
    expect(r.marks.get("a3")?.length).toBe(2);
    expect(r.marks.get("a2")?.length).toBe(1);
    // 서로 다른 그룹의 번호가 붙는다
    expect(new Set(r.marks.get("a3") ?? []).size).toBe(2);
  });

  it("모든 색인 번호는 범례에 실린 그룹의 것이다 — 미아 번호 없음", () => {
    for (const id of ["movement", "language", "exile"] as const) {
      const r = buildLens(id, lensInput());
      const listed = new Set(r.groups.map((g) => g.index));
      for (const nums of r.marks.values())
        for (const n of nums) expect(listed.has(n)).toBe(true);
    }
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

describe("착륙지 준비도 — 자산 존재가 아니라 명시적 검증 상태", () => {
  it("파일이 스키마를 지킨다", () => {
    expect(READINESS.version).toBe(1);
    expect(READINESS.default).toBe("not-started");
    for (const e of READINESS.entries) {
      expect(["ready", "in-progress", "not-started"]).toContain(e.state);
      expect(e.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.verifiedBy.length).toBeGreaterThan(3);
      for (const m of e.met) expect(Object.keys(READINESS.criteria)).toContain(m);
    }
  });

  it("ready 는 네 기준을 전부 충족해야 한다", () => {
    for (const e of READINESS.entries.filter((x) => x.state === "ready"))
      expect(e.met.length).toBe(Object.keys(READINESS.criteria).length);
  });

  it("기재되지 않은 작가는 착륙할 수 없다", () => {
    expect(isLandable("marcel-proust")).toBe(false);
    expect(readinessState("marcel-proust")).toBe("not-started");
  });

  it("검수된 작가만 착륙이 열린다", () => {
    expect([...READY_IDS].sort()).toEqual(
      ["franz-kafka", "natsume-soseki", "rabindranath-tagore"].sort()
    );
    for (const id of READY_IDS) expect(isLandable(id)).toBe(true);
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

  it("갈래는 서로 다른 목적을 따로 답한다 — 하나의 점수로 뭉치지 않는다", () => {
    const authors = [
      // 읽은 작가에게 **한 갈래 이상 자격을 준다**(난도 1 → gentle 후보).
      // 그러지 않으면 "읽은 작가 제외" 규칙이 사라져도 다른 필터가 우연히
      // 가려서 테스트가 통과한다 — 변이 스윕이 이 오탐을 적발했다(2026-08-20).
      makeAuthor({ id: "read1", regions: ["western-europe"], languages: ["fr"], difficulty: 1 }),
      makeAuthor({ id: "near", regions: ["western-europe"], languages: ["fr"], difficulty: 5 }),
      makeAuthor({ id: "gap", regions: ["sub-saharan-africa"], languages: ["yo"], difficulty: 4 }),
      makeAuthor({ id: "easy", regions: ["western-europe"], languages: ["fr"], difficulty: 1 })
    ];
    const rels = [makeRelation("read1", "near"), makeRelation("read1", "gap")];
    const p = emptyPersonal();
    p.read.read1 = 1;
    const tracks = recommendTracks(p, authors, rels, (a) => a.difficulty, LABELS);
    const byId = Object.fromEntries(tracks.map((t) => [t.id, t.items.map((i) => i.authorId)]));
    expect(byId.lineage?.[0]).toBe("near");
    expect(byId.unfamiliar).toContain("gap");
    expect(byId.unfamiliar).not.toContain("near");
    expect(byId.gentle?.[0]).toBe("easy");
    for (const t of tracks) expect(t.items.map((i) => i.authorId)).not.toContain("read1");
  });

  it("모든 추천은 근거 문장을 갖는다 — 블랙박스 금지", () => {
    const authors = [makeAuthor({ id: "r" }), makeAuthor({ id: "x", difficulty: 1 })];
    const p = emptyPersonal();
    p.read.r = 1;
    const tracks = recommendTracks(p, authors, [makeRelation("r", "x")], (a) => a.difficulty, LABELS);
    expect(tracks.length).toBeGreaterThan(0);
    for (const t of tracks) for (const rec of t.items) expect(rec.reasons.length).toBeGreaterThan(0);
  });

  it("아무것도 안 읽었으면 추천하지 않는다", () => {
    expect(recommendTracks(emptyPersonal(), [makeAuthor({ id: "a" })], [], () => 3, LABELS)).toEqual(
      []
    );
  });
});

describe("색인은 전부 해독 가능해야 한다", () => {
  it("모든 언어 코드에 한국어 이름이 있다", async () => {
    const { LANGUAGE_KO } = await import("../src/universe/lenses.ts");
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = path.resolve(import.meta.dirname, "../data/authors");
    const codes = new Set<string>();
    for (const f of fs.readdirSync(dir)) {
      const authors = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Array<{
        languages: string[];
      }>;
      for (const a of authors) for (const l of a.languages) codes.add(l);
    }
    const missing = [...codes].filter((c) => !LANGUAGE_KO[c]);
    expect(missing, `한국어 이름이 없는 언어 코드: ${missing.join(", ")}`).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 연도 서가 — 작품 도시의 배치
// ---------------------------------------------------------------------------

describe("연도 서가 — 두 권이 한 자리를 다투지 않는다", () => {
  const KAFKA = [1913, 1915, 1919, 1925, 1926];

  it("경도 순서는 연도 순서다", () => {
    const lons = shelfLongitudes(KAFKA, volumeWidth(KAFKA.length) * VOL_AIR);
    for (let i = 1; i < lons.length; i++) expect(lons[i]!).toBeGreaterThan(lons[i - 1]!);
  });

  it("인접 연도라도 책 폭만큼의 간격은 남는다 — 겹침은 기하의 문제다", () => {
    // 비례 배치만 쓰면 1925 와 1926 이 책 폭보다 좁게 붙는다. 아래에서 그
    // 사실 자체를 계산해 확인한다 — 수치를 주석에 박아 두면 SHELF_LON 이
    // 바뀔 때마다 주석이 조용히 틀려진다(실측: 22° 시절의 3.4° 가 남아 있었다).
    const minGap = volumeWidth(KAFKA.length) * VOL_AIR;
    const naive = KAFKA.map(
      (y) => -SHELF_LON + 2 * SHELF_LON * ((y - 1913) / (1926 - 1913))
    );
    expect(naive[4]! - naive[3]!).toBeLessThan(minGap);
    const lons = shelfLongitudes(KAFKA, minGap);
    for (let i = 1; i < lons.length; i++)
      expect(lons[i]! - lons[i - 1]!).toBeGreaterThanOrEqual(minGap - 1e-9);
  });

  it("서가 띠를 넘어가지 않는다", () => {
    for (const years of [KAFKA, [1892, 1910, 1910, 1912, 1916, 1917], [1900, 1901]]) {
      const lons = shelfLongitudes(years, volumeWidth(years.length) * VOL_AIR);
      for (const l of lons) {
        expect(l).toBeGreaterThanOrEqual(-SHELF_LON - 1e-9);
        expect(l).toBeLessThanOrEqual(SHELF_LON + 1e-9);
      }
    }
  });

  it("작품이 많으면 책이 줄지, 책이 겹치지 않는다", () => {
    expect(volumeWidth(2)).toBe(VOL_W_MAX);
    expect(volumeWidth(12)).toBeLessThan(volumeWidth(5));
    const many = Array.from({ length: 12 }, (_, i) => 1900 + i);
    const lons = shelfLongitudes(many, volumeWidth(12) * VOL_AIR);
    for (let i = 1; i < lons.length; i++)
      expect(lons[i]! - lons[i - 1]!).toBeGreaterThanOrEqual(volumeWidth(12) * VOL_AIR - 1e-9);
  });

  it("한 해에 몰린 작품도 자리를 나눠 갖는다", () => {
    const lons = shelfLongitudes([1910, 1910, 1910], volumeWidth(3) * VOL_AIR);
    const sorted = [...lons].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++)
      expect(sorted[i]! - sorted[i - 1]!).toBeGreaterThan(0);
  });

  it("눈금은 같은 사상을 통과한다 — 밀린 구간에서 눈금도 같이 밀린다", () => {
    const minGap = volumeWidth(KAFKA.length) * VOL_AIR;
    const lons = shelfLongitudes(KAFKA, minGap);
    const pairs = KAFKA.map((y, i) => [y, lons[i]!] as const);
    // 작품 연도에 놓인 눈금은 그 작품의 경도와 정확히 같다
    KAFKA.forEach((y, i) => expect(yearToLon(y, pairs)).toBeCloseTo(lons[i]!, 9));
    // 사이의 눈금은 두 작품 사이에 단조롭게 놓인다
    expect(yearToLon(1920, pairs)).toBeGreaterThan(yearToLon(1919, pairs));
    expect(yearToLon(1920, pairs)).toBeLessThan(yearToLon(1925, pairs));
    // 범위 밖은 끝값에 붙는다 — 축 밖으로 새지 않는다
    expect(yearToLon(1800, pairs)).toBe(lons[0]!);
    expect(yearToLon(2100, pairs)).toBe(lons[4]!);
  });

  it("눈금 단위는 3~6개가 놓이도록 고른다", () => {
    for (const [lo, hi] of [
      [1913, 1926],
      [1892, 1917],
      [1900, 2000],
      [1910, 1912]
    ] as const) {
      const step = shelfTickStep(lo, hi);
      const n = Math.floor(hi / step) - Math.ceil(lo / step) + 1;
      expect(n).toBeLessThanOrEqual(6);
    }
  });

  it("판형은 세로로 길고 두께는 상수다 — 쪽수를 갖고 있지 않으므로", () => {
    expect(VOL_ASPECT).toBeGreaterThan(1.2);
    expect(VOL_DEPTH).toBeLessThan(0.4);
  });
});

describe("표면에 놓이는 것은 실루엣을 따른다", () => {
  it("장르 조화가 표면 반경을 ±6% 안에서 흔든다", () => {
    const poet = genreHarmonics(makeAuthor({ id: "p", genres: ["poetry"] }));
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < 120; i++)
      for (let j = 0; j < 120; j++) {
        const th = (i / 120) * Math.PI;
        const ph = (j / 120) * Math.PI * 2;
        const r = silhouetteRadius(
          poet,
          Math.sin(th) * Math.cos(ph),
          Math.cos(th),
          Math.sin(th) * Math.sin(ph)
        );
        lo = Math.min(lo, r);
        hi = Math.max(hi, r);
      }
    expect(hi - 1).toBeLessThanOrEqual(SILHOUETTE_AMP + 1e-9);
    expect(1 - lo).toBeLessThanOrEqual(SILHOUETTE_AMP + 1e-9);
    // 상수 1.0 을 쓰면 부푼 쪽에서 지각 안으로 파묻힌다 — 그 폭이 0 이 아님을 못박는다
    expect(hi).toBeGreaterThan(1.001);
  });
});
