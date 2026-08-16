import { describe, expect, it } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import { FallbackExplorer } from "../../src/components/FallbackExplorer.tsx";
import { AppCtx, buildServices } from "../../src/components/ctx.ts";
import { Store } from "../../src/state/store.ts";
import { assembleDataset } from "../../src/data/assemble.ts";
import { loadRawCollections } from "../../scripts/lib/load-node.ts";
import { makeRelation } from "../fixtures.ts";
import { renderWithServices, sampleAuthors, sampleRelations } from "./helpers.tsx";

function renderEgo() {
  const utils = renderWithServices(() => <FallbackExplorer />, {
    relations: [
      ...sampleRelations(),
      makeRelation("franz-kafka", "margaret-atwood", "affinity", {
        summary: "카프카적 디스토피아 감각의 친연성. 테스트 요약이다."
      })
    ]
  });
  act(() => utils.store.selectAuthor("franz-kafka"));
  return utils;
}

describe("FallbackExplorer keyboard access", () => {
  it("selects a neighbor with Enter on its node button", () => {
    const { store, getByRole } = renderEgo();
    const node = getByRole("button", { name: "호르헤 루이스 보르헤스(으)로 이동" });
    fireEvent.keyDown(node, { key: "Enter" });
    expect(store.getState().selectedAuthorId).toBe("jorge-luis-borges");
  });

  it("opens the evidence card with Space on an edge button", () => {
    const { store, getAllByRole } = renderEgo();
    const edge = getAllByRole("button", { name: /^근거 열기:/ })[0]!;
    fireEvent.keyDown(edge, { key: " " });
    expect(store.getState().pickedRelationId).not.toBeNull();
  });

  it("labels directed edges with canonical source → target, undirected with ↔", () => {
    const { getAllByRole } = renderEgo();
    const names = getAllByRole("button", { name: /^근거 열기:/ }).map((el) =>
      el.getAttribute("aria-label")
    );
    // canonical: kafka → borges (documented), kafka ↔ atwood (affinity)
    expect(names).toContain("근거 열기: 프란츠 카프카 → 호르헤 루이스 보르헤스 · 직접 영향");
    expect(names.some((n) => n?.includes("프란츠 카프카 ↔ 마거릿 애트우드"))).toBe(true);
  });

  it("cycles node focus with arrow keys", () => {
    const { getByRole } = renderEgo();
    const first = getByRole("button", { name: "호르헤 루이스 보르헤스(으)로 이동" });
    act(() => (first as unknown as HTMLElement).focus?.());
    fireEvent.keyDown(first, { key: "ArrowRight" });
    const active = document.activeElement;
    expect(active).not.toBe(first);
    expect(active?.getAttribute("role")).toBe("button");
    expect(active?.classList.contains("fallback-node")).toBe(true);
  });

  it("announces incoming/outgoing/undirected totals to screen readers", () => {
    const { container } = renderEgo();
    const note = container.querySelector(".sr-only");
    // kafka → borges (outgoing), kafka ↔ atwood (undirected)
    expect(note?.textContent).toBe("들어오는 관계 0 · 나가는 관계 1 · 무방향 1");
  });
});

describe("FallbackExplorer label collision (real data)", () => {
  it("keeps every edge-type label unoverlapped on Kafka's dense ego graph", () => {
    // the densest writer in the corpus — the reported case: 37 texts, ≥5
    // overlapping pairs before the stagger
    const { dataset, errors } = assembleDataset(loadRawCollections());
    if (!dataset) throw new Error(`dataset failed to assemble: ${errors.join("; ")}`);
    const store = new Store();
    const services = buildServices(store, dataset);
    const { container } = render(
      <AppCtx.Provider value={services}>
        <FallbackExplorer />
      </AppCtx.Provider>
    );
    act(() => store.selectAuthor("franz-kafka"));

    const labels = Array.from(container.querySelectorAll(".fallback-edge-label")).map((el) => {
      const x = Number(el.getAttribute("x"));
      const y = Number(el.getAttribute("y"));
      const text = el.textContent ?? "";
      // 11px KO glyphs, centered anchor — a deliberately pessimistic box
      const w = text.length * 11 + 6;
      return { x0: x - w / 2, x1: x + w / 2, y0: y - 11, y1: y + 3, text };
    });
    expect(labels.length).toBeGreaterThanOrEqual(15); // kafka is actually dense

    const overlaps: string[] = [];
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        const a = labels[i]!;
        const b = labels[j]!;
        if (a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0) {
          overlaps.push(
            `${a.text}@(${Math.round((a.x0 + a.x1) / 2)},${Math.round(a.y1)}) × ${b.text}@(${Math.round((b.x0 + b.x1) / 2)},${Math.round(b.y1)})`
          );
        }
      }
    }
    expect(overlaps).toEqual([]);
  });
});
