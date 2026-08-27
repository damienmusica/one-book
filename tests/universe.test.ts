// R11 성계 구조의 계약 — 표현은 소유가 아니라 거리의 함수이고,
// 성좌는 데이터에 새겨진 소속이 아니라 켜져 있는 렌즈의 산물이다.

import { describe, expect, it } from "vitest";
import { makeAuthor, makeRelation } from "./fixtures.ts";
import {
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
  starDiameterPx,
  STAR_MAX_PX,
  SILHOUETTE_AMP,
  silhouetteRadius,

  VOL_AIR,
  VOL_ASPECT,
  VOL_DEPTH,
  VOL_W_MAX,
  volumeWidth,
  corridorSpan,
  corridorTheta,
  corridorCellArc,
  anchorYearOf,
  CORRIDOR_LEAD_YEARS,
  CORRIDOR_TAIL_YEARS,
  CORRIDOR_ARC_MAX,
  CORRIDOR_CELL_AIR
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
    const near = apparentRadiusPx(r, r * 1.5, 42, h);
    expect(representationFor(far, h)).toBe("star");
    expect(representationFor(mid, h)).toBe("resolved");
    expect(representationFor(near, h)).toBe("surface");
  });

  it("착륙 고도에서 천체가 화면을 지배한다 (겉보기 반경 > 화면 높이의 22%)", () => {
    const r = bodyRadius(0.4);
    const h = 900;
    expect(apparentRadiusPx(r, r * 1.5, 42, h)).toBeGreaterThan(h * 0.22);
  });

  it("천구 안으로 들어가도 이웃 천체는 별로 남는다 (검은 하늘 회귀 방지)", () => {
    // 원점에서 900 떨어진 껍질 위, 서로 900 쯤 떨어진 이웃
    const ap = apparentRadiusPx(bodyRadius(1), 900, 42, 900);
    expect(ap).toBeLessThan(STAR_TO_DISC_PX);
    expect(representationFor(ap, 900)).toBe("star");
  });
});

describe("별에도 크기가 있다 — 광휘 바닥과 실제 원반", () => {
  const h = 900;
  const glareOf = (mag: number) => starPixels(mag);
  const discAt = (mag: number, d: number) => apparentRadiusPx(bodyRadius(mag), d, 42, h);

  it("먼 하늘에서는 광도만 말한다 — 거리가 절반이 되어도 크기가 같다", () => {
    const mag = 1;
    const a = starDiameterPx(glareOf(mag), discAt(mag, SHELL_R * 3));
    const b = starDiameterPx(glareOf(mag), discAt(mag, SHELL_R * 1.5));
    expect(a).toBe(glareOf(mag));
    expect(b).toBe(a);
  });

  it("다가가면 자란다 — 이전 판이 잃고 있던 사실", () => {
    // 실측(2026-08-27): 이 항이 없던 판에서 카메라가 2189 → 379 로 다가가는
    // 동안 카프카의 발광 픽셀 폭은 2~3px 로 고정이었다. 크기가 자라는 유일한
    // 길이 구로 분해되는 것이었고, 분해는 준비된 작가 셋에게만 열린다.
    const mag = 0.2;
    const sizes = [900, 400, 200, 100].map((d) => starDiameterPx(glareOf(mag), discAt(mag, d)));
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i] as number).toBeGreaterThanOrEqual(sizes[i - 1] as number);
    }
    expect(sizes[3] as number).toBeGreaterThan((sizes[0] as number) * 1.5);
  });

  it("같은 거리에서는 영향력이 큰 별이 더 크다", () => {
    const d = 150;
    expect(starDiameterPx(glareOf(1), discAt(1, d))).toBeGreaterThan(
      starDiameterPx(glareOf(0), discAt(0, d))
    );
  });

  it("구가 나타나는 순간의 스프라이트는 이미 그 구의 지름이다 (전환이 연속이다)", () => {
    // 전환은 겉보기 반경 STAR_TO_DISC_PX 에서 일어난다 — 그때 원반 지름은
    // 2×STAR_TO_DISC_PX 이고, 광휘가 그보다 작으면 스프라이트는 이미 원반이다.
    const mag = 0.2;
    const d = bodyRadius(mag) / Math.tan((42 * Math.PI) / 360) / ((2 * STAR_TO_DISC_PX) / h);
    expect(apparentRadiusPx(bodyRadius(mag), d, 42, h)).toBeCloseTo(STAR_TO_DISC_PX, 1);
    expect(starDiameterPx(glareOf(mag), STAR_TO_DISC_PX)).toBe(2 * STAR_TO_DISC_PX);
  });

  it("별이 화면을 통째로 덮지 않는다 — 넘겨받을 구가 없는 별에도 상한이 있다", () => {
    expect(starDiameterPx(10, 10_000)).toBe(STAR_MAX_PX);
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

  it("ready 가 주장하는 자산은 매니페스트에 실재한다 — 추론이 아니라 주장의 정합성 검사", async () => {
    // R11-c 는 "자산 존재로 준비도를 추론하지 않는다"고 했다. 이것은 그 반대
    // 방향이다: 기재된 주장(met)이 실제 자산과 어긋나면 기재가 거짓이다.
    const m = (await import("../public/art/manifest.json")).default as {
      grounds: Record<string, unknown>;
      archival: Record<string, unknown>;
      covers: Record<string, unknown>;
    };
    for (const e of READINESS.entries.filter((x) => x.state === "ready")) {
      if (e.met.includes("manuscriptGround")) expect(m.grounds[e.authorId]).toBeTruthy();
      if (e.met.includes("archivalPortrait")) expect(m.archival[e.authorId]).toBeTruthy();
      if (e.met.includes("coverPlates"))
        expect(Object.keys(m.covers).filter((w) => w.startsWith(`${e.authorId}--`)).length).toBeGreaterThanOrEqual(2);
      expect(e.verifiedBy).not.toMatch(/^R10 art pass/); // 과정 이름이 아니라 사람·세션
    }
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

describe("서가 회랑 — 연도 칸은 균일하고 회랑은 행성을 감지 않는다", () => {
  it("구간은 작품·앵커·사망 연도를 전부 품고 앞뒤 여유를 갖는다", () => {
    // 기대값은 **리터럴**이다 — 상수로 검증하면 상수 변이가 검증식도 같이
    // 바꿔 동어반복이 된다(스윕 실측: 꼬리 여유 변이가 생존했다).
    const span = corridorSpan([1915, 1925], [1947, 1969], 1924);
    expect(span.yStart).toBe(1915 - 2);
    expect(span.yEnd).toBe(1969 + 4);
    // 사망 연도가 최댓값이면 그것이 구간을 정한다
    expect(corridorSpan([1905], [], 1916).yEnd).toBe(1916 + 4);
    // 앵커는 **뒤로만** 늘린다. 첫 작품 이전의 앵커(상대의 전사)는 구간을
    // 앞으로 끌지 않는다 — 마샤두의 1881 이 소세키의 서가를 1879 부터 세우면
    // 첫 책까지 24칸이 빈다. 원장에는 남고 회랑만 세우지 않는다.
    const soseki = corridorSpan([1905, 1914], [1881, 1915, 1923], 1916);
    expect(soseki.yStart).toBe(1905 - 2);
    expect(soseki.yEnd).toBe(1923 + 4);
    // 작품이 없고 앵커만 있는 경우에는 앵커가 시작을 정한다(빈 배열 방어)
    expect(corridorSpan([], [1930], undefined).yStart).toBe(1930 - 2);
  });

  it("연도 → 호는 균일하다 — 연도가 다르면 자리도 다르고 간격은 같다", () => {
    const span = { yStart: 1900, yEnd: 1960 };
    const arc = 0.04;
    const a = corridorTheta(1910, span, arc);
    const b = corridorTheta(1911, span, arc);
    const c = corridorTheta(1912, span, arc);
    expect(b - a).toBeCloseTo(arc, 12);
    expect(c - b).toBeCloseTo(arc, 12);
    expect(corridorTheta(span.yStart, span, arc)).toBe(0);
  });

  it("회랑 전체 호는 상한을 넘지 않는다 — 책이 행성을 감으면 회랑이 아니다", () => {
    for (const bays of [10, 17, 62, 120]) {
      const arc = corridorCellArc(bays, volumeWidth(5));
      // 리터럴 2.4 — 상수로 재면 상수 변이가 검증식을 함께 바꾼다
      expect(arc * bays).toBeLessThanOrEqual(2.4 + 1e-9);
      expect(arc).toBeGreaterThan(0);
    }
    // 칸이 적으면 책 폭 비례가 그대로 산다 · 칸은 언제나 책보다 넓다(관통 불가)
    expect(corridorCellArc(5, 0.05)).toBeCloseTo(0.05 * CORRIDOR_CELL_AIR, 12);
    expect(CORRIDOR_CELL_AIR).toBeGreaterThan(1.2);
  });

  it("책 앵커는 그 책의 발표 연도로 해상된다 — 모르는 책은 연도로 물러난다", () => {
    const yearOf = (id: string) => ({ "a--w1": 1915 })[id];
    expect(anchorYearOf({ workId: "a--w1", year: 1947 }, yearOf)).toBe(1915);
    expect(anchorYearOf({ workId: "a--nope", year: 1947 }, yearOf)).toBe(1947);
    expect(anchorYearOf({ year: 1913 }, yearOf)).toBe(1913);
    expect(anchorYearOf({ workId: "a--nope" }, yearOf)).toBeUndefined();
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

// ---------------------------------------------------------------------------
// 관계 인과성 (R12) — 선은 왜 그어졌는가
// ---------------------------------------------------------------------------
import {
  EVIDENCE_KO,
  REL_KO,
  anchorChips,
  isDirected,
  relationCaption,
  relationGlyph,
  sortRelations
} from "../src/universe/relations.ts";

describe("relation causality — glyph, order, caption", () => {
  const self = "franz-kafka";
  const out = makeRelation(self, "jorge-luis-borges");
  const inc = makeRelation("fyodor-dostoevsky", self);
  const mutual = makeRelation(self, "samuel-beckett", "affinity");

  it("reads direction from the selected star's side", () => {
    expect(relationGlyph(out, self)).toBe("→");
    expect(relationGlyph(inc, self)).toBe("←");
    expect(relationGlyph(mutual, self)).toBe("↔");
    // 같은 관계를 상대편에서 보면 화살이 뒤집힌다
    expect(relationGlyph(out, "jorge-luis-borges")).toBe("←");
  });

  it("gives arrowheads only to directed relations", () => {
    expect(isDirected(out)).toBe(true);
    expect(isDirected(mutual)).toBe(false);
  });

  it("orders strong evidence first, then weight, deterministically", () => {
    const rows = [
      { rel: { ...mutual, evidenceLevel: "editorial_inference" as const, weight: 0.9 } },
      { rel: { ...inc, evidenceLevel: "documented" as const, weight: 0.5 } },
      { rel: { ...out, evidenceLevel: "documented" as const, weight: 0.8 } },
      { rel: { ...makeRelation(self, "kobo-abe"), evidenceLevel: "scholarly_consensus" as const, weight: 0.95 } }
    ];
    const ids = sortRelations(rows).map((r) => r.rel.id);
    expect(ids).toEqual([out.id, inc.id, "influence--franz-kafka--kobo-abe", mutual.id]);
    // 입력 순서에 무관하다
    expect(sortRelations([...rows].reverse()).map((r) => r.rel.id)).toEqual(ids);
  });

  it("never shows a code value to the reader", () => {
    for (const v of Object.values(EVIDENCE_KO)) expect(v).not.toMatch(/[a-z_]/);
    for (const v of Object.values(REL_KO)) expect(v).not.toMatch(/[a-z_]/);
  });

  it("writes the caption from the origin toward the destination", () => {
    const name = (id: string) => ({ "franz-kafka": "카프카", "fyodor-dostoevsky": "도스토옙스키", "jorge-luis-borges": "보르헤스", "samuel-beckett": "베케트" })[id] ?? id;
    const o = relationCaption({ ...out, summary: "보르헤스가 서문을 썼다." }, self, name);
    expect(o.startsWith("카프카 → 보르헤스 · 영향 · ")).toBe(true);
    expect(o.endsWith("— 보르헤스가 서문을 썼다.")).toBe(true);
    const i = relationCaption({ ...inc, summary: "편지의 혈족." }, self, name);
    expect(i.startsWith("도스토옙스키 → 카프카")).toBe(true);
    expect(relationCaption({ ...mutual, summary: "x" }, self, name).startsWith("카프카 ↔ 베케트 · 친연")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 작품 세계 (R12) — 여는 문장·판본·유고는 출처와 연도 논리를 갖는다
// ---------------------------------------------------------------------------
import { assembleDataset, type RawCollections } from "../src/data/assemble.ts";
import { makeDataset, makeWork } from "./fixtures.ts";
import { workWorldSchema } from "../src/schema.ts";

function rawOf(ds: ReturnType<typeof makeDataset>): RawCollections {
  return {
    authorFiles: { "authors/t.json": ds.authors },
    workFiles: { "works/t.json": ds.works },
    relationFiles: { "relations/t.json": ds.relations },
    sourceFiles: { "sources/t.json": ds.sources },
    movements: ds.movements,
    tours: ds.tours,
    positions: ds.positions,
    registry: ds.registry
  };
}

describe("work world — schema and validation", () => {
  const WORLD = {
    opening: { original: "Es war spät abends, als K. ankam.", ko: "K.가 도착한 것은 늦은 저녁이었다.", translation: "self" as const, sourceId: "src--britannica" },
    editions: [{ kind: "first-edition" as const, publisher: "Kurt Wolff", place: "München", year: 1940, sourceIds: ["src--britannica"] }]
  };

  it("accepts a well-formed world and refuses a translation that is not declared ours", () => {
    expect(workWorldSchema.safeParse(WORLD).success).toBe(true);
    expect(workWorldSchema.safeParse({ ...WORLD, opening: { ...WORLD.opening, translation: "published" } }).success).toBe(false);
    expect(workWorldSchema.safeParse({ ...WORLD, editions: [] }).success).toBe(false);
  });

  it("rejects an edition dated before the work's publication year", () => {
    const a = makeAuthor({ id: "a", deathYear: 1950 });
    const ds = makeDataset([a], []);
    ds.works = [makeWork("a", 1, { year: 1940, world: { ...WORLD, editions: [{ ...WORLD.editions[0]!, year: 1939 }] } })];
    const { errors } = assembleDataset(rawOf(ds));
    expect(errors.some((e) => e.includes("precedes the work's publication year"))).toBe(true);
  });

  it("rejects a posthumous claim when the first edition is not after the author's death", () => {
    const a = makeAuthor({ id: "a", deathYear: 1950 });
    const ds = makeDataset([a], []);
    ds.works = [
      makeWork("a", 1, {
        year: 1940,
        world: { ...WORLD, posthumous: { editor: "편집자", note: "사후에 엮어 냈다는 주장이다.", sourceIds: ["src--britannica"] } }
      })
    ];
    const { errors } = assembleDataset(rawOf(ds));
    expect(errors.some((e) => e.includes("posthumous claim"))).toBe(true);
    // 사망 뒤의 초판이면 통과
    ds.works[0]!.world!.editions[0]!.year = 1951;
    ds.works[0]!.year = 1951;
    expect(assembleDataset(rawOf(ds)).errors.filter((e) => e.includes("posthumous"))).toEqual([]);
  });

  it("rejects world claims that cite unknown sources", () => {
    const a = makeAuthor({ id: "a", deathYear: 1950 });
    const ds = makeDataset([a], []);
    ds.works = [makeWork("a", 1, { year: 1940, world: { ...WORLD, opening: { ...WORLD.opening, sourceId: "src--nowhere" } } })];
    const { errors } = assembleDataset(rawOf(ds));
    expect(errors.some((e) => e.includes("world.opening cites unknown source"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 서명 파도 (R12) — 매니페스트의 마크는 전부 근거를 달고, 생존 작가는 없다
// ---------------------------------------------------------------------------
import { readFileSync as readFs, readdirSync as readDir } from "node:fs";

describe("signature wave — every mark ships with provenance, no living author", () => {
  const manifest = JSON.parse(readFs(new URL("../public/art/manifest.json", import.meta.url), "utf8"));
  const authors = readDir(new URL("../data/authors", import.meta.url)).flatMap((f) =>
    JSON.parse(readFs(new URL(`../data/authors/${f}`, import.meta.url), "utf8"))
  ) as Array<{ id: string; deathYear?: number }>;
  const byId = new Map(authors.map((a) => [a.id, a]));

  const all = { ...manifest.marks, ...manifest.signatures } as Record<string, { file: string; provenance: { pageUrl?: string; licence?: string } | null }>;

  it("keeps the shipped app's seal set at the R10 three and carries the wave apart", () => {
    expect(Object.keys(manifest.marks)).toEqual(["franz-kafka", "rabindranath-tagore", "natsume-soseki"]);
    expect(Object.keys(manifest.signatures).length).toBeGreaterThanOrEqual(59);
    for (const id of Object.keys(manifest.signatures)) expect(manifest.marks[id], id).toBeUndefined();
  });

  it("every mark and signature names a file page and a licence, and belongs to a corpus author", () => {
    for (const [id, m] of Object.entries(all)) {
      expect(byId.has(id), id).toBe(true);
      expect(/^(marks|signatures)\//.test(m.file), id).toBe(true);
      expect(m.provenance?.pageUrl?.startsWith("https://"), id).toBe(true);
      expect((m.provenance?.licence ?? "").length, id).toBeGreaterThan(2);
    }
  });

  it("holds living authors out of the wave (conservative rule)", () => {
    for (const id of Object.keys(all)) expect(byId.get(id)?.deathYear, id).toBeDefined();
  });
});

describe("relation anchors — the line knows which book and which year", () => {
  it("turns anchors into chips and refuses a title it does not know", () => {
    const titleOf = (id: string) => ({ "franz-kafka--die-verwandlung": "변신" })[id];
    expect(anchorChips({ anchors: [{ workId: "franz-kafka--die-verwandlung", year: 1947 }, { year: 1913 }, { workId: "x--unknown" }] }, titleOf))
      .toEqual(["『변신』 1947", "1913"]);
    expect(anchorChips({ anchors: undefined }, titleOf)).toEqual([]);
  });

  it("validation refuses an anchor on a third party's work or an unknown work", () => {
    const a = makeAuthor({ id: "a", deathYear: 1950 });
    const b = makeAuthor({ id: "b", deathYear: 1960 });
    const c = makeAuthor({ id: "c", deathYear: 1970 });
    const ds = makeDataset([a, b, c], [makeRelation("a", "b", "documented_influence", { anchors: [{ workId: "c--w1" }] })]);
    let { errors } = assembleDataset(rawOf(ds));
    expect(errors.some((e) => e.includes("belongs to neither party"))).toBe(true);
    ds.relations[0]!.anchors = [{ workId: "a--nope" }];
    ({ errors } = assembleDataset(rawOf(ds)));
    expect(errors.some((e) => e.includes("unknown work"))).toBe(true);
    ds.relations[0]!.anchors = [{ workId: "a--w1", year: 1940 }];
    ({ errors } = assembleDataset(rawOf(ds)));
    expect(errors.filter((e) => e.includes("anchor"))).toEqual([]);
  });
});
