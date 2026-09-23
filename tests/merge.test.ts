// 합침 규칙 계약 — 결정 (136) §4. 규칙 하나당 케이스 하나.
import { describe, expect, it } from "vitest";
// @ts-expect-error — 브라우저용 ESM 이지만 순수 함수는 그대로 import 된다
import { mergeMarks } from "../public/book.js";

const T = (n: number) => new Date(n).toISOString();

describe("합침 — 작품마다 늦은 쪽이 이긴다", () => {
  it("서버가 늦으면 서버", () => {
    const m = mergeMarks({ state: { a: { s: "want", at: 100 } } }, [{ work_id: "a", state: "read", at: T(200) }]);
    expect(m.state.a).toEqual({ s: "read", at: 200 });
    expect(m.toServer).toEqual([]);
  });
  it("로컬이 늦으면 로컬, 그리고 서버로 보낸다", () => {
    const m = mergeMarks({ state: { a: { s: "have", at: 300 } } }, [{ work_id: "a", state: "want", at: T(200) }]);
    expect(m.state.a).toEqual({ s: "have", at: 300 });
    expect(m.toServer).toEqual([{ work_id: "a", state: "have", at: 300 }]);
  });
  it("서버에만 있는 책은 로컬로 내려온다", () => {
    const m = mergeMarks({ state: {} }, [{ work_id: "b", state: "opened", at: T(50) }]);
    expect(m.state.b).toEqual({ s: "opened", at: 50 });
  });
  it("로컬에만 있는 책은 서버로 올라간다", () => {
    const m = mergeMarks({ state: { c: { s: "want", at: 10 } } }, []);
    expect(m.toServer).toEqual([{ work_id: "c", state: "want", at: 10 }]);
  });
});

describe("합침 — 되돌림(모르는 책)도 시각을 가진 사실이다", () => {
  it("로컬에서 나중에 되돌렸으면 서버의 표시를 지운다", () => {
    const m = mergeMarks({ state: {}, gone: { a: 500 } }, [{ work_id: "a", state: "want", at: T(400) }]);
    expect(m.state.a).toBeUndefined();
    expect(m.gone.a).toBe(500);
    expect(m.toServer).toEqual([{ work_id: "a", state: null, at: 500 }]);
  });
  it("서버가 되돌림보다 늦게 다시 표시했으면 서버가 이긴다", () => {
    const m = mergeMarks({ state: {}, gone: { a: 400 } }, [{ work_id: "a", state: "read", at: T(500) }]);
    expect(m.state.a).toEqual({ s: "read", at: 500 });
    expect(m.gone.a).toBeUndefined();
  });
  it("로컬 표시가 로컬 되돌림보다 늦으면 표시가 진실이다", () => {
    const m = mergeMarks({ state: { a: { s: "want", at: 700 } }, gone: { a: 600 } }, []);
    expect(m.state.a).toEqual({ s: "want", at: 700 });
    expect(m.toServer).toEqual([{ work_id: "a", state: "want", at: 700 }]);
  });
});

describe("합침 — 빈 입력", () => {
  it("둘 다 비면 비고 보낼 것도 없다", () => {
    const m = mergeMarks({ state: {} }, []);
    expect(m).toEqual({ state: {}, gone: {}, toServer: [] });
  });
  it("로컬이 null 이어도 죽지 않는다 (첫 방문 + 다른 기기 로그인)", () => {
    const m = mergeMarks(null, [{ work_id: "z", state: "read", at: T(1) }]);
    expect(m.state.z.s).toBe("read");
  });
});

// 서버 모형 — supabase/migrations/20260923000001_book_tombstones.sql 의 mark_set 과 같은 규칙:
// 되돌림도 행(state null)으로 남고, 늦은 시각이 이긴다. 두 기기가 번갈아 열어도 한 도감으로 모이는가.
describe("두 기기 — 되돌림은 되살아나지 않는다", () => {
  const server = new Map<string, { state: string | null; at: number }>();
  const markSet = (id: string, state: string | null, at: number) => {
    const cur = server.get(id);
    if (!cur || at >= cur.at) server.set(id, { state, at });
  };
  const rows = () => [...server].map(([work_id, v]) => ({ work_id, state: v.state, at: new Date(v.at).toISOString() }));
  const open = (local: Parameters<typeof mergeMarks>[0]) => {
    const m = mergeMarks(local, rows());
    for (const t of m.toServer) markSet(t.work_id, t.state, t.at);
    return { v: 3, state: m.state, gone: m.gone };
  };
  it("A 가 표시 → B 가 받음 → A 가 되돌림 → B 가 다시 열어도 되돌림이 이긴다", () => {
    let a = open({ v: 3, state: { "x--y": { s: "want", at: 100 } } });
    let b = open({ v: 3, state: {} });
    expect(b.state["x--y"]?.s).toBe("want");
    a = { v: 3, state: {}, gone: { "x--y": 200 } };
    a = open(a);
    b = open(b); // B 는 아직 want@100 을 들고 있다
    expect(b.state["x--y"]).toBeUndefined();
    expect(b.gone["x--y"]).toBe(200);
    a = open(a);
    expect(a.state["x--y"]).toBeUndefined();
    expect(server.get("x--y")).toEqual({ state: null, at: 200 });
  });
  it("늦게 도착한 옛 되돌림은 새 표시를 지우지 못한다", () => {
    markSet("p--q", "read", 500);
    markSet("p--q", null, 300);
    expect(server.get("p--q")).toEqual({ state: "read", at: 500 });
  });
});
