import { describe, expect, it } from "vitest";
import { sentencesOf, sidOf } from "../scripts/lib/drawn.ts";
import { uncoveredOf } from "../scripts/lib/closeread.ts";

describe("그려진 문장 — 붉은 인장은 문장 단위로 센다", () => {
  it("문장을 마침표 뒤에서 나눈다(닫는 괄호·따옴표 포함)", () => {
    expect(sentencesOf("첫 문장이다. 「둘째」라고 했다.」 셋째다")).toEqual(["첫 문장이다.", "「둘째」라고 했다.」", "셋째다"]);
  });
  it("같은 글이면 같은 sid, 글이 바뀌면 다른 sid", () => {
    expect(sidOf("author.importanceReason", "가 나 다.")).toBe(sidOf("author.importanceReason", "가  나 다. "));
    expect(sidOf("author.importanceReason", "가 나 다.")).not.toBe(sidOf("author.importanceReason", "가 나 라."));
  });
});

describe("덮개 — 원장이 문장을 덮는가", () => {
  const d = [{ sid: "a", text: "A" }, { sid: "b", text: "B" }, { sid: "c", text: "C" }, { sid: "e", text: "E" }];
  const plates = [{ claims: [
    { sids: ["a"], verdict: "confirmed" },
    { sids: ["b"], verdict: "contradicted", resolution: "corrected" },
    { sids: ["e"], verdict: "unverifiable" }
  ], noClaim: { c: "읽기 조언" } }];
  const why = Object.fromEntries(uncoveredOf(d, plates).map((u) => [u.sid, u.why]));
  it("확정된 주장이 덮은 문장은 덮였다", () => expect(why.a).toBeUndefined());
  it("「사실 주장 없음」으로 적힌 문장은 덮였다", () => expect(why.c).toBeUndefined());
  it("고치기로 한 문장이 그대로 있으면 덮이지 않았다 — 고침이 적용되지 않았다", () => expect(why.b).toMatch(/그대로/));
  it("미결 주장이 있으면 덮이지 않았다", () => expect(why.e).toMatch(/미결/));
  it("원장에 없는 문장은 덮이지 않았다", () => expect(uncoveredOf([{ sid: "z", text: "Z" }], plates)[0]?.why).toMatch(/없는/));
});

describe("덮개 — 두 문장에 걸친 주장", () => {
  it("걸친 문장 가운데 하나가 고쳐졌으면 고침은 적용된 것이다", () => {
    const plates = [{ claims: [{ sids: ["x", "y-old"], verdict: "contradicted", resolution: "corrected" }, { sids: ["x"], verdict: "confirmed" }, { sids: ["y-new"], verdict: "confirmed" }] }];
    expect(uncoveredOf([{ sid: "x", text: "X" }, { sid: "y-new", text: "Y" }], plates)).toEqual([]);
  });
  it("걸친 문장이 전부 그대로면 고침이 적용되지 않았다", () => {
    const plates = [{ claims: [{ sids: ["x", "y"], verdict: "contradicted", resolution: "corrected" }, { sids: ["x", "y"], verdict: "confirmed" }] }];
    expect(uncoveredOf([{ sid: "x", text: "X" }, { sid: "y", text: "Y" }], plates).map((u) => u.why)).toEqual(["고치기로 한 문장이 그대로 있다", "고치기로 한 문장이 그대로 있다"]);
  });
});
