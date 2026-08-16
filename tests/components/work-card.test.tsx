import { describe, expect, it } from "vitest";
import { act, render } from "@testing-library/react";
import { WorkCard } from "../../src/components/WorkCard.tsx";
import { AppCtx, buildServices } from "../../src/components/ctx.ts";
import { Store } from "../../src/state/store.ts";
import { assembleDataset } from "../../src/data/assemble.ts";
import { loadRawCollections } from "../../scripts/lib/load-node.ts";

function renderCard(workId: string) {
  const { dataset, errors } = assembleDataset(loadRawCollections());
  if (!dataset) throw new Error(`dataset failed to assemble: ${errors.join("; ")}`);
  const store = new Store();
  const services = buildServices(store, dataset);
  const utils = render(
    <AppCtx.Provider value={services}>
      <WorkCard />
    </AppCtx.Provider>
  );
  act(() => store.set({ selectedAuthorId: "franz-kafka", selectedWorkId: workId }));
  return { ...utils, store };
}

describe("WorkCard (real data)", () => {
  it("shows title, original, year, and the entry badge for the entry work", () => {
    const { container } = renderCard("franz-kafka--die-verwandlung");
    expect(container.textContent).toContain("변신");
    expect(container.textContent).toContain("Die Verwandlung");
    expect(container.textContent).toContain("1915");
    expect(container.textContent).toContain("입문작 — 여기서 시작");
  });

  it("shows the curated position for a later work and cites sources", () => {
    const { container } = renderCard("franz-kafka--der-process");
    expect(container.textContent).toContain("권장 읽기 순서 2/3");
    expect(container.querySelectorAll(".source-list li").length).toBeGreaterThan(0);
  });

  it("marks works outside the curated order honestly", () => {
    const { container } = renderCard("franz-kafka--das-urteil");
    expect(container.textContent).toContain("권장 순서 밖의 작품");
  });
});
