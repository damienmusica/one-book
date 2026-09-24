import { describe, expect, it } from "vitest";
import { buildNameIndex, DOOR_JS, doorMatch, lpNorm, type NameRow, type TitleRow } from "../scripts/lib/door.ts";
import { assembleDataset } from "../src/data/assemble.ts";
import { loadRawCollections } from "../scripts/lib/load-node.ts";

// 브라우저가 받는 것은 함수의 원문이다 — 모듈 밖에서, 아무것도 없는 스코프에서 도는지 여기서 본다.
const shipped = new Function(`${DOOR_JS}; return { lpNorm, doorMatch };`)() as { lpNorm: typeof lpNorm; doorMatch: typeof doorMatch };

describe("이름 키 — 공백·기호·발음 구별 기호를 지우고, 글자와 숫자는 지우지 않는다", () => {
  for (const f of [lpNorm, shipped.lpNorm]) {
    it("띄어 쓴 것과 붙여 쓴 것이 같다", () => expect(f("조지 오웰")).toBe(f("조지오웰")));
    it("영문자 s 와 숫자를 지우지 않는다", () => {
      expect(f("Hesse")).toBe("hesse");
      expect(f("1984")).toBe("1984");
    });
    it("악센트 없이 친 이름이 같다", () => expect(f("José Saramago")).toBe(f("Jose Saramago")));
    it("한글 음절은 풀지 않는다", () => expect(f("도스토옙스키")).toBe("도스토옙스키"));
  }
});

describe("문 — 확실할 때만 연다", () => {
  const N: NameRow[] = [
    ["george-orwell", "조지 오웰", "George Orwell", "p"],
    ["haruki-murakami", "무라카미 하루키", "村上春樹", "p"],
    ["franz-kafka", "프란츠 카프카", "Franz Kafka", "p"],
    ["henry-james", "헨리 제임스", "Henry James", "p"],
    ["james-joyce", "제임스 조이스", "James Joyce", "p"],
    ["baruch-spinoza", "바뤼흐 스피노자", "Baruch Spinoza", "s"],
    ["jose-saramago", "주제 사라마구", "José Saramago", "p"],
    ["ovid", "오비디우스", "Publius Ovidius Naso", "p"]
  ];
  const T: TitleRow[] = [["1984", 0], ["변신", 2], ["변신 이야기", 7], ["노르웨이의 숲", 1]];
  for (const m of [doorMatch, shipped.doorMatch]) {
    it("붙여 쓴 이름이 연다", () => expect(m(N, T, "조지오웰")).toEqual({ kind: "open", id: "george-orwell" }));
    it("악센트 없는 원어 이름이 연다", () => expect(m(N, T, "Jose Saramago")).toEqual({ kind: "open", id: "jose-saramago" }));
    it("책 제목이 그 작가를 연다", () => expect(m(N, T, "1984")).toEqual({ kind: "title", id: "george-orwell", title: "1984" }));
    it("제목 전체가 같을 때만 — 『변신』은 카프카, 『변신 이야기』가 아니다", () => expect(m(N, T, "변신")).toMatchObject({ kind: "title", id: "franz-kafka" }));
    it("이름의 한 낱말이 한 사람이면 연다", () => {
      expect(m(N, T, "하루키")).toEqual({ kind: "open", id: "haruki-murakami" });
      expect(m(N, T, "카프카")).toEqual({ kind: "open", id: "franz-kafka" });
      expect(m(N, T, "Kafka")).toEqual({ kind: "open", id: "franz-kafka" });
    });
    it("한 낱말이 여럿이면 고르게 한다", () => expect(m(N, T, "제임스")).toEqual({ kind: "choose", ids: ["henry-james", "james-joyce"] }));
    it("비슷한 이름은 열지 않는다 — 「무라카미 류」는 하루키가 아니다", () => expect(m(N, T, "무라카미 류")).toEqual({ kind: "near", ids: ["haruki-murakami"] }));
    it("부분 일치도 열지 않는다 — 「노자」는 스피노자가 아니다", () => expect(m(N, T, "노자")).toEqual({ kind: "near", ids: ["baruch-spinoza"] }));
    it("아무것도 없으면 없다", () => expect(m(N, T, "헷세")).toEqual({ kind: "none", ids: [] }));
  }
});

describe("문 — 실제 코퍼스의 모든 이름", () => {
  const { dataset } = assembleDataset(loadRawCollections());
  const { n, t } = buildNameIndex(dataset!.authors, dataset!.works);
  const lands = (id: string, v: string) => {
    const r = shipped.doorMatch(n, t, v);
    return (r.kind === "open" && r.id === id) || (r.kind === "choose" && r.ids.includes(id));
  };
  it("한국어 이름을 띄어 쓰든 붙여 쓰든 그 사람에게 닿는다", () => {
    const bad = dataset!.authors.filter((a) => !lands(a.id, a.names.ko) || !lands(a.id, a.names.ko.replace(/\s+/g, ""))).map((a) => a.names.ko);
    expect(bad).toEqual([]);
  });
  it("원어 이름과 별칭도 그 사람에게 닿는다", () => {
    const bad = dataset!.authors.flatMap((a) => [a.names.original, ...a.names.aliases].filter((x): x is string => Boolean(x)).filter((x) => !lands(a.id, x)).map((x) => `${a.id}:${x}`));
    expect(bad).toEqual([]);
  });
  it("열리는 것은 친 이름의 주인뿐이다 — 이름 전체나 낱말 전체가 같지 않은 사람을 열지 않는다", () => {
    const wrong: string[] = [];
    for (const a of dataset!.authors) {
      const words = a.names.ko.split(/\s+/);
      for (const v of [a.names.ko.replace(/\s+/g, "").slice(0, -1), ...words.map((w) => w.slice(0, -1))].filter((v) => v.length >= 2)) {
        const r = shipped.doorMatch(n, t, v);
        if (r.kind !== "open") continue;
        const who = dataset!.authors.find((b) => b.id === r.id)!;
        const keys = [who.names.ko, who.names.original, ...who.names.aliases].filter(Boolean).flatMap((k) => [k!, ...k!.split(/[\s\-·.]+/)]).map(lpNorm);
        if (!keys.includes(lpNorm(v))) wrong.push(`${v}→${r.id}`);
      }
    }
    expect(wrong).toEqual([]);
  });
});
