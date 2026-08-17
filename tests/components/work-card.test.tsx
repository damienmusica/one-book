import { describe, expect, it } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import { DetailPanel } from "../../src/components/DetailPanel.tsx";
import { AppCtx, buildServices } from "../../src/components/ctx.ts";
import { Store } from "../../src/state/store.ts";
import { assembleDataset } from "../../src/data/assemble.ts";
import { loadRawCollections } from "../../scripts/lib/load-node.ts";

/**
 * Unified inspector, work depth (8th review): a work opens INSIDE the same
 * panel as the author profile — one surface, breadcrumb back, reading-road
 * navigation. The old floating WorkCard is gone; these tests pin the drill-in.
 */
function renderInspector(workId: string | null) {
  const { dataset, errors } = assembleDataset(loadRawCollections());
  if (!dataset) throw new Error(`dataset failed to assemble: ${errors.join("; ")}`);
  const store = new Store();
  const services = buildServices(store, dataset);
  const utils = render(
    <AppCtx.Provider value={services}>
      <DetailPanel />
    </AppCtx.Provider>
  );
  act(() =>
    store.set({ selectedAuthorId: "franz-kafka", selectedWorkId: workId, panelOpen: true })
  );
  return { ...utils, store };
}

describe("unified inspector — work depth (real data)", () => {
  it("shows title, original, year, and the entry badge for the entry work", () => {
    const { container } = renderInspector("franz-kafka--die-verwandlung");
    expect(container.querySelector(".work-inspector")).not.toBeNull();
    expect(container.textContent).toContain("변신");
    expect(container.textContent).toContain("Die Verwandlung");
    expect(container.textContent).toContain("1915");
    expect(container.textContent).toContain("입문작 — 여기서 시작");
  });

  it("shows the curated position for a later work and cites sources", () => {
    const { container } = renderInspector("franz-kafka--der-process");
    expect(container.textContent).toContain("권장 읽기 순서 2/3");
    expect(container.querySelectorAll(".source-list li").length).toBeGreaterThan(0);
  });

  it("marks works outside the curated order honestly", () => {
    const { container } = renderInspector("franz-kafka--das-urteil");
    expect(container.textContent).toContain("권장 순서 밖의 작품");
  });

  it("breadcrumb returns to the author profile in the SAME panel", () => {
    const { container, store } = renderInspector("franz-kafka--die-verwandlung");
    const back = container.querySelector(".work-inspector__back") as HTMLButtonElement;
    expect(back.textContent).toContain("프란츠 카프카");
    act(() => {
      fireEvent.click(back);
    });
    expect(store.getState().selectedWorkId).toBeNull();
    expect(store.getState().panelOpen).toBe(true);
    // the same surface now shows the profile, not a second card
    expect(container.querySelector(".work-inspector")).toBeNull();
    expect(container.textContent).toContain("어디서부터 읽을까");
  });

  it("the reading road walks to the next work without leaving the inspector", () => {
    const { container, store } = renderInspector("franz-kafka--die-verwandlung");
    const road = container.querySelector(".work-inspector__road");
    expect(road).not.toBeNull();
    const next = [...road!.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("→")
    );
    expect(next).toBeDefined();
    act(() => {
      fireEvent.click(next!);
    });
    expect(store.getState().selectedWorkId).toBe("franz-kafka--der-process");
    expect(container.querySelector(".work-inspector")).not.toBeNull();
  });
});
