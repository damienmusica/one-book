// 판본 원장 계약 — 규칙 하나당 케이스 하나.
//
// 이 파일은 변이 스윕이 시켜서 생겼다. 원장을 비운 채로 출시했더니 스윕이
// 즉시 두 자리를 SURVIVED 로 표시했다 — ISBN 체크섬을 지워도, 존재하지 않는
// 작품에 판본을 붙여도 아무 검사도 빨개지지 않았다. **레코드가 0개인 검증기는
// 아무것도 증명하지 않는다.** 실제 판본이 들어오기 전까지 그 규칙을 실행하는
// 것은 여기 합성 케이스뿐이다.
import { describe, expect, it } from "vitest";
import { assembleDataset } from "../src/data/assemble.ts";
import { isbn13Valid } from "../src/schema.ts";
import { showsPhysicalRecord } from "../src/book/readiness.ts";
import { loadRawCollections } from "../scripts/lib/load-node.ts";

const REAL = loadRawCollections();

/** 실제 코퍼스 위에 합성 원장 하나만 얹어 조립한다 */
const withEditions = (editions: unknown) => assembleDataset({ ...REAL, editions });

const ok = {
  isbn13: "9788937460449",
  title: "변신·시골 의사",
  publisher: "민음사",
  translator: "전영애",
  year: 2009,
  language: "ko",
  verifiedFrom: "합성 케이스 — 실제 검수가 아니다",
  verifiedAt: "2026-08-31"
};
const file = (editions: Record<string, unknown[]>) => ({
  version: "1",
  checkedAt: "2026-08-31",
  note: "test",
  editions
});
const WORK = "franz-kafka--die-verwandlung";

describe("ISBN-13 체크섬", () => {
  it("맞는 번호를 받는다", () => {
    expect(isbn13Valid("9788937460449")).toBe(true);
  });
  it("체크 자리가 틀리면 거절한다", () => {
    expect(isbn13Valid("9788937460448")).toBe(false);
  });
  it("13자리가 아니면 거절한다", () => {
    expect(isbn13Valid("978893746044")).toBe(false);
    expect(isbn13Valid("97889374604490")).toBe(false);
  });
  it("숫자가 아니면 거절한다 — 형태가 맞아 보여도", () => {
    expect(isbn13Valid("97889374604X9")).toBe(false);
  });
});

describe("판본 원장 조립", () => {
  it("검수된 판본 하나는 통과하고 데이터셋에 실린다", () => {
    const { dataset, errors } = withEditions(file({ [WORK]: [ok] }));
    expect(errors).toEqual([]);
    expect(dataset?.editions.editions[WORK]?.[0]?.publisher).toBe("민음사");
  });

  it("체크섬이 틀린 ISBN 은 조립을 막는다", () => {
    const { dataset, errors } = withEditions(file({ [WORK]: [{ ...ok, isbn13: "9788937460448" }] }));
    expect(dataset).toBeNull();
    expect(errors.join(" ")).toContain("ISBN-13");
  });

  it("존재하지 않는 작품에 붙은 판본은 조립을 막는다", () => {
    const { dataset, errors } = withEditions(file({ "no-such-work": [ok] }));
    expect(dataset).toBeNull();
    expect(errors.join(" ")).toContain("unknown work id");
  });

  it("같은 ISBN 이 두 번 나오면 조립을 막는다", () => {
    const { dataset, errors } = withEditions(
      file({ [WORK]: [ok, { ...ok, title: "다른 표제" }] })
    );
    expect(dataset).toBeNull();
    expect(errors.join(" ")).toContain("중복");
  });

  it("작품보다 앞선 연도의 판본은 조립을 막는다 — 나오기 전에 팔린 책은 없다", () => {
    const { dataset, errors } = withEditions(file({ [WORK]: [{ ...ok, year: 1900 }] }));
    expect(dataset).toBeNull();
    expect(errors.join(" ")).toContain("앞선다");
  });

  it("확인 출처와 확인 날짜가 없으면 판본이 아니다", () => {
    const { verifiedFrom: _f, ...noFrom } = ok;
    expect(withEditions(file({ [WORK]: [noFrom] })).dataset).toBeNull();
    const { verifiedAt: _a, ...noAt } = ok;
    expect(withEditions(file({ [WORK]: [noAt] })).dataset).toBeNull();
  });

  it("빈 원장은 유효하다 — 비어 있음도 사실이고 checkedAt 이 날짜를 붙인다", () => {
    const { dataset, errors } = withEditions(file({}));
    expect(errors).toEqual([]);
    expect(dataset?.editions.checkedAt).toBe("2026-08-31");
    expect(Object.keys(dataset?.editions.editions ?? {})).toHaveLength(0);
  });

  it("실제 원장이 스키마를 통과한다 — 오늘의 배포본", () => {
    const { dataset, errors } = assembleDataset(REAL);
    expect(errors).toEqual([]);
    expect(dataset?.editions.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("실물 기록 게이트 — 준비도 사다리가 표면을 지배한다", () => {
  it("검수된 작가 + 실물 데이터 → 선다", () => {
    expect(showsPhysicalRecord({ authorId: "franz-kafka", world: { opening: {} } })).toBe(true);
  });
  it("미검수 작가는 실물 데이터가 있어도 주장하지 않는다", () => {
    expect(showsPhysicalRecord({ authorId: "marcel-proust", world: { opening: {} } })).toBe(false);
  });
  it("검수된 작가라도 실물 데이터가 없으면 서지 않는다", () => {
    expect(showsPhysicalRecord({ authorId: "franz-kafka" })).toBe(false);
  });
});
