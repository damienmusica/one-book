// 고전 확장 스키마 계약 — 결정 (134).
//
// 새 필드는 **담을 자리를 늘린다.** 담긴 것이 정직한지는 자동으로 검사되지
// 않는다 — 적대 검토가 정확히 그 점을 지적했다. 이 파일이 그 검사다.
import { describe, expect, it } from "vitest";
import { assembleDataset } from "../src/data/assemble.ts";
import { editionsFileSchema, workSchema, authorSchema } from "../src/schema.ts";
import { GENRE_DEFS, LANGUAGE_LABELS, PERIOD_DEFS, REGION_DEFS } from "../src/types.ts";
import { loadRawCollections } from "../scripts/lib/load-node.ts";
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const REAL = loadRawCollections();

const work = (over: Record<string, unknown> = {}) => ({
  id: "homeros--ilias",
  authorId: "homeros",
  titleKo: "일리아스",
  titleOriginal: "Ἰλιάς",
  year: -750,
  genre: "epic",
  significance: "서양 서사시의 출발점이며, 이후 모든 영웅 서사가 이 형식을 참조한다.",
  sourceIds: [],
  ...over
});

// 실제 작가 하나를 복제해 연도만 옮긴다 — 손으로 쓴 합성 레코드는 다른 필수
// 필드에서 먼저 걸려 정작 재려는 검사에 도달하지 못한다(실측: 변이 4건 생존).
const donorAuthor = (over: Record<string, unknown>) => {
  const files = REAL.authorFiles as Record<string, unknown>;
  const key = Object.keys(files).find((k) => Array.isArray(files[k]) && (files[k] as unknown[]).length)!;
  const a = structuredClone((files[key] as Record<string, unknown>[])[0]!);
  return { ...a, ...over };
};
const donorWork = (over: Record<string, unknown>) => {
  const files = REAL.workFiles as Record<string, unknown>;
  const key = Object.keys(files).find((k) => Array.isArray(files[k]) && (files[k] as unknown[]).length)!;
  const w = structuredClone((files[key] as Record<string, unknown>[])[0]!);
  return { ...w, ...over };
};

describe("연도 — 타입이 셋으로 갈렸다", () => {
  it("기원전에 산 작가가 들어온다 (옛 min(1700) 이 죽이던 자리)", () => {
    const r = authorSchema.safeParse(
      donorAuthor({ birthYear: -800, deathYear: -700, activeRange: [-780, -700], anchorYear: -750 })
    );
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues.slice(0, 3))).toBe(true);
  });
  it("기원전 작품이 들어온다", () => {
    const r = workSchema.safeParse(donorWork({ year: -750 }));
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues.slice(0, 3))).toBe(true);
  });
  it("생몰 연도는 -3000 아래로 못 간다", () => {
    expect(authorSchema.safeParse(donorAuthor({ birthYear: -9000 })).success).toBe(false);
  });
  it("초간 연도는 구텐베르크 이전이 될 수 없다 — 일괄 완화가 약화시킬 뻔한 검사", () => {
    const withWorld = REAL.workFiles as Record<string, unknown>;
    const key = Object.keys(withWorld).find(
      (k) => Array.isArray(withWorld[k]) && (withWorld[k] as Record<string, unknown>[]).some((w) => w["world"])
    )!;
    const w = structuredClone(
      (withWorld[key] as Record<string, unknown>[]).find((x) => x["world"])!
    ) as Record<string, unknown>;
    const world = w["world"] as { editions: Record<string, unknown>[] };
    // 오늘 통과하는 실제 레코드에서 초간 연도만 기원전으로 옮긴다
    expect(workSchema.safeParse(w).success, "기증자 자체가 통과해야 한다").toBe(true);
    world.editions[0]!["year"] = -750;
    expect(workSchema.safeParse(w).success).toBe(false);
  });
});

describe("yearBasis — 연도 한 칸이 무엇인지 말한다", () => {
  it("전승 시기 추정으로 표시할 수 있다", () => {
    expect(workSchema.safeParse(work({ yearBasis: "composition-range" })).success).toBe(true);
  });
  it("아무 문자열이나 들어가지 않는다", () => {
    expect(workSchema.safeParse(work({ yearBasis: "대충" })).success).toBe(false);
  });
});

describe("택소노미가 고전을 담는다", () => {
  it("세 층이 이름으로 존재한다 — 범위만 맞고 id 가 바뀌면 데이터가 못 붙는다", () => {
    const ids = PERIOD_DEFS.map((p) => p.id);
    for (const id of ["antiquity-medieval", "renaissance-baroque", "enlightenment-romantic"]) {
      expect(ids, `${id} 없음`).toContain(id);
    }
  });
  it("1400년 이전에 정직한 시대층이 있다", () => {
    const lowest = Math.min(...PERIOD_DEFS.map((p) => p.range[0]));
    expect(lowest).toBeLessThan(0);
  });
  it("시대층이 -3000 부터 현재까지 빈틈 없이 덮는다", () => {
    const sorted = [...PERIOD_DEFS].sort((a, b) => a.range[0] - b.range[0]);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]!.range[0]).toBeLessThanOrEqual(sorted[i - 1]!.range[1]);
    }
  });
  it("서사시와 역사에 장르가 있다", () => {
    const ids = GENRE_DEFS.map((g) => g.id);
    expect(ids).toContain("epic");
    expect(ids).toContain("history");
  });
  it("고전 언어 코드가 실재하는 ISO 코드다 — 발명하지 않았다", () => {
    for (const c of ["la", "grc", "sa", "pi", "ta", "he", "lzh", "ojp", "okm", "gez", "nah", "qu"]) {
      expect(LANGUAGE_LABELS[c], `${c} 라벨 없음`).toBeTruthy();
    }
  });
  it("빠져 있던 권역이 채워졌다", () => {
    const ids = REGION_DEFS.map((r) => r.id);
    for (const r of ["central-asia", "southeast-asia", "mesoamerica", "andes", "east-africa"]) {
      expect(ids).toContain(r);
    }
  });
});

describe("authorKind — 없는 저자를 만들지 않는다", () => {
  it("두 값은 받는다", () => {
    expect(authorSchema.safeParse(donorAuthor({ authorKind: "person" })).success).toBe(true);
    expect(authorSchema.safeParse(donorAuthor({ authorKind: "corpus" })).success).toBe(true);
  });
  it("세 번째 값은 받지 않는다 — 통과하는 레코드에서 이 필드만 오염시킨다", () => {
    const r = authorSchema.safeParse(donorAuthor({ authorKind: "anonymous" }));
    expect(r.success).toBe(false);
    expect(r.success ? [] : r.error.issues.map((i) => i.path.join("."))).toContain("authorKind");
  });
  it("생몰년은 원래 선택이라 corpus 항목이 비워도 통과한다", () => {
    const a = donorAuthor({ authorKind: "corpus" }) as Record<string, unknown>;
    delete a["birthYear"];
    delete a["deathYear"];
    expect(authorSchema.safeParse(a).success).toBe(true);
  });
});

describe("판본 — 중역·번안이 원전 직역으로 통과하지 않는다", () => {
  const ed = {
    isbn13: "9788937460449",
    title: "샤나메",
    publisher: "X",
    year: 2015,
    language: "ko",
    verifiedFrom: "합성 케이스",
    verifiedAt: "2026-08-31"
  };
  const file = (over: Record<string, unknown>) => ({
    version: "1",
    checkedAt: "2026-08-31",
    note: "test",
    editions: {},
    ...over
  });
  it("저본 유형을 적을 수 있다", () => {
    expect(
      editionsFileSchema.safeParse(
        file({ editions: { "franz-kafka--die-verwandlung": [{ ...ed, sourceTextBasis: "relay" }] } })
      ).success
    ).toBe(true);
  });
  it("저본 유형은 세 값만 받는다", () => {
    expect(
      editionsFileSchema.safeParse(
        file({ editions: { "franz-kafka--die-verwandlung": [{ ...ed, sourceTextBasis: "요약본" }] } })
      ).success
    ).toBe(false);
  });
});

describe("없음의 원장 — 지도에서 지우지 않고 적는다", () => {
  const file = (absent: unknown) => ({
    version: "1",
    checkedAt: "2026-08-31",
    note: "test",
    editions: {},
    absent
  });
  it("찾았고 없었다를 날짜·뒤진 곳과 함께 적는다", () => {
    const r = editionsFileSchema.safeParse(
      file({
        "franz-kafka--die-verwandlung": {
          checkedAt: "2026-08-31",
          searched: ["민음사 세계문학전집", "알라딘", "국립중앙도서관"]
        }
      })
    );
    expect(r.success).toBe(true);
  });
  it("한 곳만 뒤지고 없다고 적을 수 없다 — 서양 99건의 교훈", () => {
    const r = editionsFileSchema.safeParse(
      file({ "franz-kafka--die-verwandlung": { checkedAt: "2026-08-31", searched: ["알라딘"] } })
    );
    expect(r.success).toBe(false);
  });
  it("날짜 없는 부재는 부재가 아니다", () => {
    const r = editionsFileSchema.safeParse(
      file({ "franz-kafka--die-verwandlung": { searched: ["알라딘", "국립중앙도서관"] } })
    );
    expect(r.success).toBe(false);
  });
  it("존재하지 않는 작품의 부재는 조립을 막는다", () => {
    const { dataset, errors } = assembleDataset({
      ...REAL,
      editions: file({ "no-such-work": { checkedAt: "2026-08-31", searched: ["알라딘", "국립중앙도서관"] } })
    });
    expect(dataset).toBeNull();
    expect(errors.join(" ")).toContain("unknown work id");
  });
});

describe("표면 — 부재와 관계 0이 화면에서 다른 문장이 된다", () => {
  it("관계가 0이면 빈 제목이 아니라 없다는 문장이 선다", async () => {
    const { relationsSection } = await import("../scripts/generate-static-pages.ts");
    const empty = relationsSection([], "someone");
    expect(empty).not.toContain("이어지는 한 사람");
    expect(empty).toContain("긋지 못했다");
  });

  it("부재 원장이 지목한 작품은 '찾지 못했다'로 렌더된다 — '아직 안 봤다'가 아니라", () => {
    const out = mkdtempSync(join(tmpdir(), "one-book-absent-"));
    // 원장은 출력 **밖에** 둔다 — 생성기가 출력을 먼저 비우므로 안에 두면 지워진다
    const box = mkdtempSync(join(tmpdir(), "one-book-ledger-"));
    const led = join(box, "editions.json");
    try {
      writeFileSync(
        led,
        JSON.stringify({
          version: "1",
          checkedAt: "2026-08-31",
          note: "계약용 합성 원장 — 실제 검수가 아니다",
          editions: {},
          absent: {
            "franz-kafka--die-verwandlung": {
              checkedAt: "2026-08-31",
              searched: ["민음사 세계문학전집", "알라딘", "국립중앙도서관"],
              note: "합성 케이스."
            }
          }
        })
      );
      execSync(
        `npx tsx scripts/generate-static-pages.ts --out ${JSON.stringify(out)} --editions ${JSON.stringify(led)}`,
        { stdio: "pipe" }
      );
      const page = readFileSync(join(out, "works", "franz-kafka--die-verwandlung", "index.html"), "utf8");
      expect(page).toContain("찾지 못했다");
      expect(page).toContain("뒤진 곳");
      expect(page).toContain("2026-08-31");
      expect(page).not.toContain("아직 검수하지 않았다");
      // 지도에서 지우지 않는다 — 페이지는 여전히 서고, 나가는 문도 있다
      expect(page).toContain("지도에 남는다");
      expect(page).toContain("aladin.co.kr");
    } finally {
      rmSync(out, { recursive: true, force: true });
      rmSync(box, { recursive: true, force: true });
    }
  }, 120_000);
});
