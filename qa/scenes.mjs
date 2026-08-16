// Deterministic QA scenes. Each scene drives the app the way a reader would
// (search, buttons, links — no private hooks for actions) and reads state
// back through window.__lpQA (read-only instrumentation). A scene must never
// fake a capability the app does not have: missing features are reported as
// not_implemented, not staged.

const KAFKA = "franz-kafka";
const BORGES = "jorge-luis-borges";

/** search-select an author: the real user path that also centers the camera */
async function searchSelect(ctx, query, expectId) {
  const input = ctx.page.locator(".searchbox input");
  await input.fill(query);
  await ctx.page.locator(".search-results li").first().waitFor({ timeout: 5000 });
  await input.press("Enter");
  await ctx.page.waitForFunction(
    (id) => window.__lpQA?.state().selectedAuthorId === id,
    expectId,
    { timeout: 5000 }
  );
  await ctx.waitIdle();
}

export const SCENES = {
  overview: {
    title: "행성 전체: 초기 진입, 회전, 확대·축소",
    async run(ctx) {
      await ctx.goto("#/");
      await ctx.waitIdle();
      await ctx.beat("initial");
      const m0 = await ctx.metrics();
      ctx.assert("planet-loaded", m0.renderer !== null, "renderer probe registered");
      ctx.assert(
        "default-counts",
        m0.visible.authors === 100 && m0.visible.relations === 229,
        `authors ${m0.visible.authors}/100, relations ${m0.visible.relations}/229`
      );
      ctx.assert(
        "anchor-labels",
        (m0.renderer?.labelsByKind?.author ?? 0) > 0,
        `author labels shown: ${m0.renderer?.labelsByKind?.author ?? 0}`
      );

      // drag = partial planet rotation (fixed pixels, fixed steps)
      await ctx.drag([960, 540], [560, 500]);
      await ctx.settle(900);
      await ctx.beat("rotated");

      await ctx.page.locator('button[aria-label="확대"]').click();
      await ctx.page.locator('button[aria-label="확대"]').click();
      await ctx.waitIdle();
      await ctx.beat("zoom-in");

      await ctx.page.locator('button[aria-label="축소"]').click();
      await ctx.page.locator('button[aria-label="축소"]').click();
      await ctx.page.locator('button[aria-label="축소"]').click();
      await ctx.waitIdle();
      await ctx.beat("zoom-out");
    }
  },

  kafka: {
    title: "카프카 성좌: 선택, 방향 스파크, 보르헤스 왕복",
    async run(ctx) {
      await ctx.goto("#/");
      await ctx.waitIdle();
      await searchSelect(ctx, "카프카", KAFKA);
      await ctx.beat("selected-profile");

      // Esc: profile closes, the constellation (and its sparks) stays
      await ctx.page.keyboard.press("Escape");
      await ctx.settle(400);
      await ctx.beat("constellation");

      const events = await ctx.events();
      const built = events.filter((e) => e.type === "flows-built").at(-1);
      ctx.assert("flows-animating", (built?.sparks ?? 0) > 0, `sparks: ${built?.sparks ?? 0}`);

      // §11: every animated spark must travel the canonical data direction —
      // never the traversal direction. Checked against data/relations/*.json.
      let mismatches = [];
      let incoming = 0;
      let outgoing = 0;
      for (const r of built?.relations ?? []) {
        const canon = ctx.relationsById.get(r.id);
        if (!canon || canon.sourceId !== r.from || canon.targetId !== r.to) {
          mismatches.push(r.id);
        }
        if (r.to === KAFKA) incoming++;
        if (r.from === KAFKA) outgoing++;
      }
      ctx.assert(
        "flow-directions-canonical",
        (built?.relations ?? []).length > 0 && mismatches.length === 0,
        mismatches.length ? `mismatched: ${mismatches.join(", ")}` : `${built?.relations.length} relations canonical`
      );
      ctx.assert(
        "kafka-has-both-directions",
        incoming > 0 && outgoing > 0,
        `incoming ${incoming}, outgoing ${outgoing}`
      );

      await searchSelect(ctx, "보르헤스", BORGES);
      await ctx.beat("travel-borges");
      await searchSelect(ctx, "카프카", KAFKA);
      await ctx.beat("return-kafka");
      const m = await ctx.metrics();
      ctx.assert("returned-to-kafka", m.state.selectedAuthorId === KAFKA, "");
    }
  },

  "works-cities": {
    title: "카프카 영토 근접: 작품 도시 라벨",
    async run(ctx) {
      await ctx.goto("#/");
      await ctx.waitIdle();
      await searchSelect(ctx, "카프카", KAFKA);
      await ctx.page.keyboard.press("Escape"); // keep the selection, free the map
      await ctx.settle(300);

      // zoom until the near LOD places the selected author's works as towns
      for (let i = 0; i < 8; i++) {
        const m = await ctx.metrics();
        if (m.renderer?.lod === "near") break;
        await ctx.page.locator('button[aria-label="확대"]').click();
        await ctx.waitIdle();
      }
      const m = await ctx.metrics();
      ctx.assert("near-lod-reached", m.renderer?.lod === "near", `lod: ${m.renderer?.lod}`);
      await ctx.settle(400);
      await ctx.beat("kafka-territory-near");

      const workLabels = await ctx.page
        .locator(".globe-label--work")
        .evaluateAll((els) => els.filter((el) => el.style.display !== "none").map((el) => el.textContent));
      const expected = ["변신", "소송", "성"];
      const found = expected.filter((t) => workLabels.some((w) => w && w.includes(t)));
      ctx.assert(
        "work-towns-labeled",
        found.length >= 2,
        `visible work labels: ${workLabels.join(" · ") || "none"}`
      );
      await ctx.beat("towns");

      // 작품 도시는 아직 라벨이지 선택 대상이 아니다 (ux-backlog #4) —
      // 거짓 장면을 만들지 않고 미구현으로 보고한다
      ctx.notImplemented(
        "work-selection",
        "towns are labels only; work cards are ux-backlog item 4"
      );
    }
  },

  timeline: {
    title: "연대 슬라이더: 1850→전체 시기, 시점별 계수",
    async run(ctx) {
      const years = [1850, 1900, 1922, 1950, 2000, null]; // null = 전체 시기
      const rows = [];
      for (const y of years) {
        await ctx.goto(y === null ? "#/" : `#/?y=${y}`);
        await ctx.waitIdle();
        await ctx.settle(250);
        await ctx.beat(`y-${y ?? "all"}`);
        const m = await ctx.metrics();
        rows.push({
          year: y ?? "all",
          authors: m.visible.authors,
          relations: m.visible.relations
        });
      }
      ctx.data.timeline = rows;
      const counts = rows.map((r) => r.authors);
      const nondecreasing = counts.every((v, i) => i === 0 || v >= counts[i - 1]);
      ctx.assert(
        "cumulative-nondecreasing",
        nondecreasing && counts.at(-1) === 100,
        counts.join(" → ")
      );
    }
  },

  "coordinate-transition": {
    title: "문학적 친연성 ↔ 실제 지리: 전환과 중간 프레임",
    async run(ctx) {
      await ctx.goto("#/");
      await ctx.waitIdle();
      await searchSelect(ctx, "카프카", KAFKA);
      await ctx.page.keyboard.press("Escape");
      await ctx.settle(300);
      await ctx.beat("semantic");

      await ctx.page.getByRole("button", { name: "실제 지리" }).click();
      await ctx.settle(430); // mid-flight of the 950ms slerp
      await ctx.beat("transition-mid");
      await ctx.waitIdle();
      await ctx.beat("geo");

      await ctx.page.getByRole("button", { name: "문학적 친연성" }).click();
      await ctx.settle(430);
      await ctx.beat("return-mid");
      await ctx.waitIdle();
      await ctx.beat("semantic-return");

      const events = await ctx.events();
      const starts = events.filter((e) => e.type === "mode-transition-start").length;
      const ends = events.filter((e) => e.type === "mode-transition-end").length;
      ctx.assert("two-transitions", starts >= 2 && ends >= 2, `starts ${starts}, ends ${ends}`);
    }
  },

  "tour-modernism": {
    title: "'모더니즘의 세 축' 여정: 첫 세 단계",
    async run(ctx) {
      await ctx.goto("#/?t=modernism-three-axes");
      await ctx.waitIdle();
      const stops = ctx.tours.find((t) => t.id === "modernism-three-axes")?.stops ?? [];
      ctx.assert("tour-exists", stops.length >= 3, `stops in data: ${stops.length}`);

      for (let i = 0; i < 3; i++) {
        if (i > 0) {
          await ctx.page.getByRole("button", { name: "다음", exact: true }).click();
          await ctx.waitIdle();
        }
        await ctx.settle(350);
        await ctx.beat(`stop-${i + 1}`);
        const m = await ctx.metrics();
        const expected = stops[i]?.authorId;
        ctx.assert(
          `stop-${i + 1}-follows-data`,
          m.state.tourStop === i && (!expected || m.state.selectedAuthorId === expected),
          `stop ${m.state.tourStop}, selected ${m.state.selectedAuthorId}, expected ${expected}`
        );
        const note = await ctx.page.locator(".tour-note").textContent();
        ctx.assert(`stop-${i + 1}-has-note`, Boolean(note && note.trim().length > 0), "");
      }
    }
  },

  "fallback-2d": {
    title: "WebGL 부재: 2D 에고 그래프, 근거 카드, 3D 컨트롤 비노출",
    query: "?nowebgl=1",
    async run(ctx) {
      await ctx.goto("#/");
      await ctx.page.locator(".fallback-roster").waitFor({ timeout: 5000 });
      await ctx.beat("roster");

      ctx.assert(
        "no-3d-zoom-controls",
        (await ctx.page.locator('button[aria-label="확대"]').count()) === 0,
        "globe zoom hidden in 2D"
      );
      ctx.assert(
        "no-mode-toggle",
        (await ctx.page.getByRole("button", { name: "실제 지리" }).count()) === 0,
        "coordinate toggle hidden in 2D"
      );

      await ctx.page.locator(".fallback-roster-chip", { hasText: "프란츠 카프카" }).click();
      await ctx.page.locator(".fallback-ego").waitFor({ timeout: 5000 });
      await ctx.settle(250);
      await ctx.beat("ego-kafka");

      const spokes = await ctx.page.locator(".fallback-edge-hit").count();
      ctx.assert("ego-has-spokes", spokes > 0, `spokes: ${spokes}`);

      // the hit line is transparent by design (generous click target), so
      // Playwright's visibility actionability check must be bypassed
      await ctx.page.locator(".fallback-edge-hit").first().click({ force: true });
      await ctx.page.locator(".relation-dialog").waitFor({ timeout: 5000 });
      await ctx.beat("evidence-card");
      const summary = await ctx.page.locator(".relation-summary").textContent();
      ctx.assert(
        "evidence-card-substantive",
        Boolean(summary && summary.trim().length > 20),
        `summary length: ${summary?.trim().length ?? 0}`
      );
      await ctx.page.keyboard.press("Escape");
      await ctx.page.locator(".relation-dialog").waitFor({ state: "detached", timeout: 5000 });
      ctx.assert("escape-closes-card", true, "dialog closed by Escape");

      // keyboard path: focus an evidence line, open with Enter, close, then
      // travel to a neighbor with Enter on its node
      await ctx.page.locator(".fallback-edge-hit").nth(1).focus();
      await ctx.page.keyboard.press("Enter");
      await ctx.page.locator(".relation-dialog").waitFor({ timeout: 5000 });
      await ctx.beat("keyboard-evidence");
      await ctx.page.keyboard.press("Escape");
      await ctx.page.locator(".relation-dialog").waitFor({ state: "detached", timeout: 5000 });

      const before = await ctx.page.evaluate(() => window.__lpQA.state().selectedAuthorId);
      await ctx.page.locator(".fallback-node").first().focus();
      await ctx.page.keyboard.press("Enter");
      await ctx.page.waitForFunction(
        (prev) => window.__lpQA.state().selectedAuthorId !== prev,
        before,
        { timeout: 5000 }
      );
      const after = await ctx.page.evaluate(() => window.__lpQA.state().selectedAuthorId);
      ctx.assert("keyboard-travel", after !== before, `${before} → ${after}`);
      await ctx.beat("keyboard-travel");
    }
  }
};
