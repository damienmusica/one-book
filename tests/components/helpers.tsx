import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { AppCtx, buildServices, type AppServices } from "../../src/components/ctx.ts";
import { Store } from "../../src/state/store.ts";
import type { Author, Relation } from "../../src/types.ts";
import { makeAuthor, makeDataset, makeRelation } from "../fixtures.ts";

export function sampleAuthors(): Author[] {
  return [
    makeAuthor({
      id: "franz-kafka",
      names: { ko: "프란츠 카프카", original: "Franz Kafka", aliases: ["카프카"] },
      periods: ["early-modernism"],
      activeRange: [1908, 1924],
      anchorYear: 1915,
      tier: "anchor",
      importanceReason:
        "불가해한 죄의식과 관료제의 미로를 꿈의 논리로 서술한 산문을 만들었다. 테스트 픽스처용 문장이다.",
      readingWarning: "장편으로 시작하면 중도 포기하기 쉽다."
    }),
    makeAuthor({
      id: "jorge-luis-borges",
      names: { ko: "호르헤 루이스 보르헤스", original: "Jorge Luis Borges", aliases: ["보르헤스"] },
      periods: ["mid-century"],
      activeRange: [1923, 1985],
      anchorYear: 1944,
      tier: "anchor"
    }),
    makeAuthor({
      id: "margaret-atwood",
      names: { ko: "마거릿 애트우드", original: "Margaret Atwood", aliases: [] },
      periods: ["late-postmodern", "contemporary"],
      activeRange: [1961, 2023],
      anchorYear: 1985,
      speculative: true
    })
  ];
}

export function sampleRelations(): Relation[] {
  return [
    makeRelation("franz-kafka", "jorge-luis-borges", "documented_influence", {
      summary: "보르헤스는 「카프카와 그의 선구자들」에서 카프카 독해를 명시했다. 테스트 요약이다."
    })
  ];
}

export function renderWithServices(
  ui: (services: AppServices) => ReactElement,
  opts: { authors?: Author[]; relations?: Relation[] } = {}
) {
  const dataset = makeDataset(opts.authors ?? sampleAuthors(), opts.relations ?? sampleRelations());
  const store = new Store();
  const services = buildServices(store, dataset);
  const utils = render(<AppCtx.Provider value={services}>{ui(services)}</AppCtx.Provider>);
  return { ...utils, store, services, dataset };
}
