import { describe, expect, it } from "vitest";
import { editionTitleNote, jsonForScript } from "../scripts/lib/html.ts";

describe("<script> 안의 JSON", () => {
  it("제목에 </script> 가 들어와도 스크립트 밖으로 나가지 않는다", () => {
    const out = jsonForScript({ name: "</script><script>window.__pwned=1</script>" });
    expect(out).not.toMatch(/</);
    expect(JSON.parse(out).name).toBe("</script><script>window.__pwned=1</script>");
  });
});

describe("판본 제목 — 수록은 정말 다른 책일 때만", () => {
  const w = { titleKo: "피네건의 경야", titleOriginal: "Finnegans Wake" };
  const en = (title: string) => editionTitleNote({ title, language: "en" }, w);
  it("대소문자만 다르면 같은 책이다", () => expect(en("Finnegans wake")).toBe(""));
  it("목록의 책임 표시는 제목이 아니다", () => expect(en("Finnegans Wake / James Joyce ; introduction by Seamus Deane")).toBe(""));
  it("부제가 붙은 같은 책은 제목을 보이되 수록이라 하지 않는다", () => {
    const out = editionTitleNote({ title: "Les choses : une histoire des années soixante", language: "fr" }, { titleKo: "사물들", titleOriginal: "Les Choses" });
    expect(out).toContain("Les choses");
    expect(out).not.toContain("수록");
  });
  it("다른 책에 실려 있으면 수록이라 한다", () => {
    const out = editionTitleNote({ title: "변신·시골의사", language: "ko" }, { titleKo: "시골의사", titleOriginal: "Ein Landarzt" });
    expect(out).toContain("수록");
  });
});
