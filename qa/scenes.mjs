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

/**
 * Click a control the way a user can: it must ALREADY be fully inside the
 * viewport — no Playwright auto-scroll, no elementHandle magic (9th round:
 * auto-scroll to a buried button manufactured a discoverability pass).
 * Returns the box so scenes can also assert placement.
 */
async function clickVisible(ctx, locator, name) {
  const box = await locator.boundingBox();
  const inView =
    box && box.y >= 0 && box.x >= 0 && box.y + box.height <= 1080 && box.x + box.width <= 1920;
  ctx.assert(
    `${name}-visible-without-scroll`,
    Boolean(inView),
    box
      ? `${name} at ${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}×${Math.round(box.height)} — fully in viewport`
      : `${name} has no box`
  );
  if (!inView) throw new Error(`${name} is not visible without scrolling`);
  await ctx.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  return box;
}

/** the profile door: mini card in focus mode, no-op when a deep link already
 *  opened the profile — both are real user states */
async function openProfile(ctx) {
  if ((await ctx.page.locator(".detail-panel").count()) > 0) return;
  await clickVisible(ctx, ctx.page.locator(".mini-card__open"), "profile-door");
  await ctx.page.locator(".detail-panel").waitFor({ timeout: 4000 });
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
        m0.visible.authors === 100 &&
          m0.visible.relations === 229 &&
          m0.visible.relationsTotal === 263,
        `visible authors ${m0.visible.authors} (expected 100 of corpus ${m0.visible.authorsTotal}); ` +
          `visible relations ${m0.visible.relations} (expected 229 — contrast is default-off — of corpus ${m0.visible.relationsTotal})`
      );
      ctx.assert(
        "anchor-labels",
        (m0.renderer?.labelsByKind?.author ?? 0) > 0,
        `author labels shown: ${m0.renderer?.labelsByKind?.author ?? 0}`
      );

      // PR2 true-lazy gate: before any timeline intent, the eras chunk must
      // not have been requested and the first beat must be stall-free —
      // the 6th review measured p99 133ms here when eras loaded at mount
      const erasRequested = ctx
        .requests()
        .filter((r) => r.path.includes("territory.v1.eras"));
      ctx.assert(
        "no-eras-before-intent",
        erasRequested.length === 0,
        erasRequested.length ? `requested: ${erasRequested[0].path}` : "0 era requests at overview"
      );
      // app bootstrap long tasks (script eval + globe construction, before
      // first paint) are LOAD time — recorded honestly, gated separately
      // from interaction: sub-100ms boot is healthy, a stall mid-rotate is not
      ctx.data.bootLongTasks = (m0.longTaskLog ?? []).filter((t) => t.start < 1500);

      // drag = partial planet rotation (fixed pixels, fixed steps).
      // This segment (post-beat ring reset → settle) is the FIRST INTERACTION
      // window — the 6th-review gate: p99 < 50ms, zero long tasks. On
      // a601479 the era paints landed here (p99 133ms); they now live in the
      // worker, on demand.
      await ctx.drag([960, 540], [560, 500]);
      await ctx.settle(900);
      const inter = await ctx.metrics();
      const hw = !String(inter.renderer?.gl?.renderer ?? "").includes("SwiftShader");
      if (hw && inter.frame) {
        const lateTasks = (inter.longTaskLog ?? []).filter((t) => t.start >= 1500);
        ctx.assert(
          "first-interaction-responsive",
          inter.frame.p99Ms < 50 && (inter.frame.longTasks ?? 99) === 0 && lateTasks.length === 0,
          `rotate window p99 ${inter.frame.p99Ms}ms, ring long tasks ${inter.frame.longTasks}, ` +
            `page long tasks after boot ${lateTasks.length} ` +
            `(boot: ${ctx.data.bootLongTasks.map((t) => `${t.duration}ms@${t.start}ms`).join(",") || "none"})`
        );
      }
      await ctx.beat("rotated");

      // five-value ladder regression (7th review PR3 / backlog 31): the
      // initial frame must not collapse into one near-black band. Before the
      // regrade: mean 0.0735 with 91.6% of pixels under L 0.10.
      const shot = await ctx.page.screenshot();
      const lum = await ctx.page.evaluate(async (b64) => {
        const img = new Image();
        img.src = "data:image/png;base64," + b64;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = Math.round(img.width / 4);
        c.height = Math.round(img.height / 4);
        const g = c.getContext("2d");
        g.drawImage(img, 0, 0, c.width, c.height);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        let sum = 0;
        let below = 0;
        const n = d.length / 4;
        for (let i = 0; i < d.length; i += 4) {
          const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
          sum += l;
          if (l < 0.1) below++;
        }
        return { mean: sum / n, below10: below / n };
      }, shot.toString("base64"));
      // R10 re-pin: the paper flip lifts land to paper values and darkens the
      // sea to cloth, so the dark-pixel share sits at ~80.6% while the frame
      // is demonstrably legible (mean 0.1017, dead-center of the band). The
      // cap moves 0.80 → 0.84 — still ~7pt from the 91.6% collapse state the
      // guard exists for; the mean band stays the primary ladder check.
      ctx.assert(
        "value-ladder-legible",
        lum.mean >= 0.078 && lum.mean <= 0.14 && lum.below10 <= 0.84,
        `mean L ${lum.mean.toFixed(4)} (band 0.078–0.14), below-10% share ${(lum.below10 * 100).toFixed(1)}% (≤84; collapse ref 91.6)`
      );

      await ctx.page.locator('button[aria-label="확대"]').click();
      await ctx.page.locator('button[aria-label="확대"]').click();
      await ctx.waitIdle();
      // semantic mid+ unselected: the raw milky way is a FAR reading —
      // closer in, constellation-pair routes carry the story (7th review)
      const zi = await ctx.metrics();
      ctx.assert(
        "semantic-mid-aggregated",
        zi.renderer.relationView?.reason === "semantic-aggregate" &&
          zi.renderer.relationView?.rawDrawn === 0 &&
          zi.renderer.relationView?.aggregateRoutes > 0 &&
          zi.renderer.relationView?.aggregateRoutes <= 24,
        `reason ${zi.renderer.relationView?.reason}, raw ${zi.renderer.relationView?.rawDrawn}, ` +
          `routes ${zi.renderer.relationView?.aggregateRoutes} (≤24)`
      );
      await ctx.beat("zoom-in");

      await ctx.page.locator('button[aria-label="축소"]').click();
      await ctx.page.locator('button[aria-label="축소"]').click();
      await ctx.page.locator('button[aria-label="축소"]').click();
      await ctx.waitIdle();
      const zo = await ctx.metrics();
      ctx.assert(
        "semantic-far-milky-way",
        zo.renderer.relationView?.reason === "semantic-overview" &&
          zo.renderer.relationView?.rawDrawn > 0,
        `back out: reason ${zo.renderer.relationView?.reason}, raw ${zo.renderer.relationView?.rawDrawn}`
      );
      await ctx.beat("zoom-out");
    }
  },

  kafka: {
    title: "카프카 성좌: 선택, 방향 스파크, 보르헤스 왕복",
    async run(ctx) {
      await ctx.goto("#/");
      await ctx.waitIdle();
      await searchSelect(ctx, "카프카", KAFKA);

      // event-synced pulse capture (PR4): the frame is taken WHILE a pulse is
      // alive — the a601479 "arrival-pulses" frame was shot after the last
      // pulse had already ended
      await ctx.page.waitForFunction(
        () => (window.__lpQA.metrics().renderer?.activePulses ?? 0) > 0,
        undefined,
        { timeout: 4000 }
      );
      const live = (await ctx.metrics()).renderer?.activePulses ?? 0;
      await ctx.beat("impact-ripple");
      ctx.assert("pulse-captured-live", live > 0, `active pulses in frame: ${live}`);
      // focus-mode search: the profile opens through the mini door (9th)
      await openProfile(ctx);
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

      // 도착 반응 v2 (6th review PR4): the staged story — impact ripple at the
      // center, then outgoing waves whose arrivals spread ≥800ms, one pulse
      // per node with start/end both logged (no sprite truncation)
      await ctx.settle(4600);
      await ctx.beat("arrival-pulses");
      const evAll = await ctx.events();
      const arrivals = evAll.filter((e) => e.type === "flow-arrival");
      const starts = evAll.filter((e) => e.type === "pulse-start");
      const ends = evAll.filter((e) => e.type === "pulse-end");
      ctx.assert(
        "impact-ripple-at-center",
        starts.filter((e) => e.kind === "impact" && e.node === KAFKA).length === 1,
        `impact pulses at selected star: ${starts.filter((e) => e.kind === "impact").length}`
      );
      ctx.assert(
        "receivers-answer-outgoing",
        arrivals.some((e) => e.kind === "outgoing" && e.node !== KAFKA),
        `outgoing arrivals: ${arrivals.filter((e) => e.kind === "outgoing").length}`
      );
      const outT = arrivals.filter((e) => e.kind === "outgoing").map((e) => e.t);
      const spread = outT.length > 1 ? Math.max(...outT) - Math.min(...outT) : 0;
      ctx.assert(
        "outgoing-waves-spread",
        spread >= 800,
        `outgoing arrivals spread ${spread}ms across ${outT.length} receivers ` +
          `(≥800ms; was 166ms on a601479)`
      );
      const perNode = new Map();
      for (const a of starts) perNode.set(a.node, (perNode.get(a.node) ?? 0) + 1);
      ctx.assert(
        "one-pulse-per-node-completed",
        [...perNode.values()].every((n) => n === 1) && ends.length === starts.length,
        `${perNode.size} nodes pulsed once; ${starts.length} starts / ${ends.length} ends ` +
          `(completion before reuse — pool sized to receivers)`
      );

      await searchSelect(ctx, "보르헤스", BORGES);
      await ctx.beat("travel-borges");
      await searchSelect(ctx, "카프카", KAFKA);
      await ctx.beat("return-kafka");
      const m = await ctx.metrics();
      ctx.assert("returned-to-kafka", m.state.selectedAuthorId === KAFKA, "");

      // an unhurried interaction take for the review video: rotate, hover the
      // constellation, ride the zoom — cursor overlay makes the input visible
      await ctx.drag([1100, 500], [860, 470]);
      await ctx.settle(1200);
      await ctx.page.mouse.move(960, 540, { steps: 20 });
      await ctx.settle(900);
      await ctx.page.mouse.move(1150, 420, { steps: 25 });
      await ctx.settle(900);
      await ctx.page.locator('button[aria-label="확대"]').click();
      await ctx.waitIdle();
      await ctx.settle(1200);
      await ctx.page.locator('button[aria-label="축소"]').click();
      await ctx.waitIdle();
      await ctx.settle(1000);
      await ctx.beat("interaction-take");
    }
  },

  "works-cities": {
    title: "카프카 영토 근접: 작품 도시 라벨",
    async run(ctx) {
      await ctx.goto("#/");
      await ctx.waitIdle();
      await searchSelect(ctx, "카프카", KAFKA);
      // focus mode: the map is already free — no panel to dismiss (9th)

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

      // towns are destinations now: open 소송 with a real click, read the
      // card, confirm the camera never moved, close with Escape
      const before = await ctx.metrics();
      await ctx.page.getByRole("button", { name: "작품 카드 열기: 소송" }).click();
      await ctx.page.locator(".work-inspector").waitFor({ timeout: 5000 });
      await ctx.beat("work-card");
      const cardText = await ctx.page.locator(".work-inspector").textContent();
      ctx.assert(
        "work-card-substantive",
        Boolean(
          cardText &&
            cardText.includes("소송") &&
            cardText.includes("권장 읽기 순서") &&
            cardText.length > 120
        ),
        `card length ${cardText?.length ?? 0}`
      );
      const after = await ctx.metrics();
      // 9th round: opening a work performs a GENTLE itinerary reframe (the
      // network stays framed) — bounded and cancellable, never a dive
      ctx.assert(
        "card-reframe-gentle",
        Math.abs((after.renderer?.cameraDistance ?? 0) - (before.renderer?.cameraDistance ?? 0)) <= 40,
        `${before.renderer?.cameraDistance} → ${after.renderer?.cameraDistance} (bounded itinerary fit, not a surface dive)`
      );
      ctx.assert(
        "work-url-shareable",
        (await ctx.page.evaluate(() => window.location.hash)).includes("w=franz-kafka--der-process"),
        "w= in hash"
      );
      await ctx.page.keyboard.press("Escape");
      await ctx.page.locator(".work-inspector").waitFor({ state: "detached", timeout: 5000 });
      // the inspector's author depth stays open after ← — close it so the
      // marker probes below measure the naked map (8th review ladder)
      await ctx.page.keyboard.press("Escape");
      await ctx.page.locator(".detail-panel").waitFor({ state: "detached", timeout: 5000 });

      // keyboard path: focus a town label, Enter opens its card
      await ctx.page.getByRole("button", { name: "작품 카드 열기: 변신" }).focus();
      await ctx.page.keyboard.press("Enter");
      await ctx.page.locator(".work-inspector").waitFor({ timeout: 5000 });
      await ctx.beat("work-card-keyboard");
      ctx.assert("work-keyboard-open", true, "Enter on focused town label");
      await ctx.page.keyboard.press("Escape");
      await ctx.page.locator(".work-inspector").waitFor({ state: "detached", timeout: 5000 });
      await ctx.page.keyboard.press("Escape");
      await ctx.page.locator(".detail-panel").waitFor({ state: "detached", timeout: 5000 });
      // PR4 gave work open/close its own camera flights (city focus +
      // bookmark restore) — marker screen positions are only measurable
      // once the restore flight and the safe-area ease have landed
      await ctx.waitIdle();

      // v2.0 first-class entities: hover then click a 3D marker's own screen
      // position — a true raycast pick, not the DOM label. The probe point
      // must reach the CANVAS: any interactive DOM label (padded work labels)
      // swallows pointer events, so pick a marker+offset whose point clears
      // every visible label rect (typography grew in R5-C — measured, not
      // assumed).
      const mk = (await ctx.metrics()).renderer?.cityMarkers;
      ctx.assert("city-markers-live", (mk?.count ?? 0) >= 4, `markers: ${mk?.count ?? 0}`);
      const labelRects = await ctx.page
        .locator(".globe-label.is-interactive:visible")
        .evaluateAll((els) =>
          els.map((el) => {
            const r = el.getBoundingClientRect();
            return { x0: r.left, x1: r.right, y0: r.top, y1: r.bottom };
          })
        );
      const clearOf = (x, y) =>
        !labelRects.some((r) => x >= r.x0 - 2 && x <= r.x1 + 2 && y >= r.y0 - 2 && y <= r.y1 + 2);
      let probePoint = null;
      for (const cand of mk?.screen ?? []) {
        for (const [dx, dy] of [[0, -22], [0, -30], [24, -12], [-24, -12]]) {
          if (clearOf(cand.x + dx, cand.y + dy)) {
            probePoint = { id: cand.id, x: cand.x + dx, y: cand.y + dy };
            break;
          }
        }
        if (probePoint) break;
      }
      if (probePoint) {
        // two-step move defeats the hover rAF coalescing
        await ctx.page.mouse.move(probePoint.x, probePoint.y, { steps: 8 });
        await ctx.settle(200);
        await ctx.page.mouse.move(probePoint.x + 1, probePoint.y);
        await ctx.settle(250);
        const hovered = await ctx.page.evaluate(() => window.__lpQA.state().hoveredWorkId);
        ctx.assert(
          "marker-hover-shared",
          hovered === probePoint.id,
          `hoveredWorkId (via raycast): ${hovered} (probe ${probePoint.id})`
        );
        await ctx.page.mouse.click(probePoint.x, probePoint.y);
        await ctx.page.locator(".work-inspector").waitFor({ timeout: 5000 });
        const pickedWork = await ctx.page.evaluate(() => window.__lpQA.state().selectedWorkId);
        ctx.assert(
          "marker-raycast-pick",
          pickedWork === probePoint.id,
          `3D marker click opened the card for ${pickedWork}`
        );
        await ctx.beat("marker-pick");
        await ctx.page.keyboard.press("Escape");
      } else {
        ctx.assert("marker-raycast-pick", false, "no marker had a label-clear probe point");
      }

      // ring size = curated reading rank + ◆ harbor = entry are live. The
      // full city system (thematic districts, translation ports, adaptation
      // bridges) is P2 roadmap in ux-backlog §13 — a roadmap item, not a gap
      // in this scene's own claims (8th review: the slice ships whole).
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

  "era-morph": {
    title: "시대 페이더: 판구조 성장 + 주권 크로스페이드 + 연합 조약",
    async run(ctx) {
      // PR2 demand loading: at the atlas view NOTHING era-shaped may have
      // loaded — no eras chunk request, temporal layer idle
      await ctx.goto("#/");
      await ctx.waitIdle();
      const preIntent = ctx.requests().filter((r) => r.path.includes("territory.v1.eras"));
      const idleEra = (await ctx.metrics()).renderer?.era;
      ctx.assert(
        "eras-idle-before-intent",
        preIntent.length === 0 && idleEra?.status === "idle",
        `requests ${preIntent.length}, status ${idleEra?.status}`
      );

      // a year deep link IS timeline intent — the worker loads + paints the
      // bracket and the world commits atomically when it lands
      const waitCommit = (yy) =>
        ctx.page.waitForFunction(
          (target) => {
            const e = window.__lpQA.metrics().renderer?.era;
            return e?.active === true && e?.displayYear === target;
          },
          yy,
          { timeout: 20000 }
        );

      // semantic contract (5th review P0-1): what the legend tells the reader
      // must be bound to the shipped eras file — years, keyframe count, the
      // computed-not-measured marking — checked against data, not vibes
      const erasFile = ctx.erasData;
      const legendEra = (await ctx.page.locator(".legend-era").textContent()) ?? "";
      const eraSpan = `${erasFile.keyframes[0].year}–${erasFile.keyframes.at(-1).year}`;
      ctx.assert(
        "legend-era-matches-data",
        legendEra.includes(eraSpan) &&
          legendEra.includes(`${erasFile.keyframes.length}개 키프레임`) &&
          legendEra.includes("계산치"),
        `legend says: ${legendEra.slice(0, 90)}…`
      );
      ctx.assert(
        "eras-growth-formula-pinned",
        String(erasFile.params.growth).includes("0.5*foundingRamp") &&
          String(erasFile.params.growth).includes("0.5*publishedWorksShare"),
        String(erasFile.params.growth)
      );

      // 카프카 국가의 생애 4막 — 미형성 유령 섬 → 건국 램프 → 활동 → 유산
      // 파티나 — 이제 지형 자체가 브래킷을 따라 자란다
      const stages = [
        [1880, "unformed", (l) => Math.abs(l.presence - 0.15) < 0.02 && l.patina === 0, [1880, 1900], 0],
        [1908, "founding", (l) => l.presence > 0.4 && l.presence < 0.75, [1900, 1920], 0.4],
        [1915, "active", (l) => l.presence === 1 && l.patina === 0, [1900, 1920], 0.75],
        [1960, "heritage", (l) => l.presence === 1 && l.patina > 0.8, [1960, 1980], 0]
      ];
      for (const [y, name, ok, bracket, mix] of stages) {
        await ctx.goto(`#/?a=franz-kafka&pv=0&y=${y}`);
        await ctx.waitIdle();
        await waitCommit(y);
        await ctx.settle(350);
        await ctx.beat(`y${y}-${name}`);
        const m = await ctx.metrics();
        const life = m.renderer?.lifecycle;
        ctx.assert(
          `kafka-${name}-${y}`,
          Boolean(life?.on && life.selected && ok(life.selected)),
          `presence ${life?.selected?.presence}, patina ${life?.selected?.patina}`
        );
        const era = m.renderer?.era;
        ctx.assert(
          `tectonic-bracket-${y}`,
          Boolean(
            era?.active &&
              era.bracket?.[0] === bracket[0] &&
              era.bracket?.[1] === bracket[1] &&
              Math.abs(era.mix - mix) < 0.02
          ),
          `bracket ${JSON.stringify(era?.bracket)}, mix ${era?.mix} (expected ${JSON.stringify(bracket)} @ ${mix})`
        );
      }

      // LRU: after touring four years the layer may hold at most 3 plates
      const resident = (await ctx.metrics()).renderer?.era?.residentPlates ?? [];
      ctx.assert(
        "era-plate-lru-bounded",
        resident.length <= 3,
        `resident era plates: [${resident.join(", ")}] (cap 3)`
      );

      // the open profile must name the sovereignty state while the fader
      // filters (P1-2: selection vs era-filter conflict) — the selection is
      // kept, the badge explains the ghosted territory behind the card
      await ctx.goto("#/?a=franz-kafka&y=1880");
      await ctx.waitIdle();
      await waitCommit(1880);
      await ctx.settle(300);
      const badge = await ctx.page.locator('[data-qa="era-badge"]').textContent();
      ctx.assert(
        "era-badge-on-profile",
        Boolean(badge && badge.includes("미형성") && badge.includes("1880")),
        `badge: ${badge ?? "(none)"}`
      );
      await ctx.beat("era-badge-profile");

      // 전체 시기(누적)에서는 셰이더가 완전 우회 — v1 도판 보존 계약
      await ctx.goto("#/?a=franz-kafka&pv=0");
      await ctx.waitIdle();
      await ctx.beat("full-view-bypass");
      const full = await ctx.metrics();
      ctx.assert(
        "default-look-preserved",
        full.renderer?.lifecycle?.on === false && full.renderer?.era?.active === false,
        "lifecycle + tectonic bracket both bypassed at 전체 시기 cumulative"
      );

      // clause 4 실증: 카프카 도시들은 출간년에 창건된다 — 1913 선고 하나,
      // 1919 셋(선고·변신·유형지), 전체 시기 다섯. 해시 인페이지 변경으로
      // 카메라를 유지한 채 시간을 이동한다.
      await ctx.goto("#/?a=franz-kafka&pv=0&y=1913");
      await ctx.waitIdle();
      await waitCommit(1913);
      for (let i = 0; i < 8; i++) {
        if ((await ctx.metrics()).renderer?.lod === "near") break;
        await ctx.page.locator('button[aria-label="확대"]').click();
        await ctx.waitIdle();
      }
      await ctx.settle(400);
      const founded = async () => (await ctx.metrics()).renderer?.cityMarkers?.count ?? -1;
      ctx.assert("founding-1913", (await founded()) === 1, `towns at 1913: ${await founded()}`);
      await ctx.beat("founding-1913");
      await ctx.page.evaluate(() => {
        window.location.hash = "#/?a=franz-kafka&pv=0&y=1919";
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      });
      await waitCommit(1919);
      await ctx.settle(400);
      ctx.assert("founding-1919", (await founded()) === 3, `towns at 1919: ${await founded()}`);
      await ctx.beat("founding-1919");
      await ctx.page.evaluate(() => {
        window.location.hash = "#/?a=franz-kafka&pv=0";
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      });
      await ctx.settle(600);
      ctx.assert("founding-atlas", (await founded()) === 5, `towns at atlas: ${await founded()}`);
      await ctx.beat("founding-atlas");

      // 1925 중경: 연합 조약 오버레이가 뜨고, 라벨이 조약기를 새긴다.
      // goto는 해시-온리 내비라 카메라가 이월된다 — 어느 쪽에서 오든 mid로
      // 수렴하도록 양방향으로 조준한다.
      await ctx.goto("#/?y=1925");
      await ctx.waitIdle();
      await waitCommit(1925);
      for (let i = 0; i < 8; i++) {
        const lod = (await ctx.metrics()).renderer?.lod;
        if (lod === "mid") break;
        await ctx.page
          .locator(`button[aria-label="${lod === "near" ? "축소" : "확대"}"]`)
          .click();
        await ctx.waitIdle();
      }
      await ctx.settle(1400); // union uniform eases in over ~40 frames
      await ctx.beat("y1925-unions-mid");
      const mid = await ctx.metrics();
      ctx.assert(
        "union-overlay-at-mid",
        (mid.renderer?.unionOverlay ?? 0) > 0.5,
        `uUnion ${mid.renderer?.unionOverlay}`
      );
      ctx.assert(
        "treaties-active-1925",
        (mid.renderer?.lifecycle?.activeTreaties ?? 0) >= 3,
        `active treaties: ${mid.renderer?.lifecycle?.activeTreaties}`
      );
      // the treaty cartouche lives at its members' centroid — sweep the
      // globe until one faces the camera (movement gates: ≥3 visible
      // members, coherent centroid, front-facing)
      let cartouche = null;
      for (let i = 0; i < 7 && !cartouche; i++) {
        const mvLabels = await ctx.page
          .locator(".globe-label--movement")
          .evaluateAll((els) =>
            els.filter((el) => el.style.display !== "none").map((el) => el.textContent ?? "")
          );
        cartouche = mvLabels.find((t) => /≈\s*1\d{3}–\d{4}/.test(t)) ?? null;
        if (!cartouche) {
          await ctx.drag([960, 500], [700, 500]);
          await ctx.settle(800);
        }
      }
      if (cartouche) await ctx.beat("treaty-cartouche");
      // the ≈ prefix is load-bearing: it marks the span as computed from
      // corpus activity overlap, not a curated historical period
      ctx.assert(
        "treaty-period-marked-computed",
        cartouche !== null && cartouche.includes("≈"),
        cartouche ?? "no ≈-marked treaty cartouche found in a full sweep"
      );
    }
  },

  compare: {
    title: "두 작가 비교: cmp 딥링크, 정본 방향 경로",
    async run(ctx) {
      await ctx.goto("#/?a=marcel-proust&cmp=franz-kafka");
      await ctx.waitIdle();
      await ctx.page.locator(".compare-view").waitFor({ timeout: 5000 });
      await ctx.beat("compare-open");
      const text = (await ctx.page.locator(".compare-view").textContent()) ?? "";
      ctx.assert(
        "compare-deep-link",
        text.includes("마르셀 프루스트") && text.includes("프란츠 카프카"),
        "both authors named"
      );
      // the Proust ← Flaubert → Kafka canonical-direction pin, live
      ctx.assert(
        "path-canonical-directions",
        text.includes("←") && text.includes("→"),
        "path renders both canonical directions"
      );
      const m = await ctx.metrics();
      ctx.assert(
        "compare-state",
        m.state.selectedAuthorId === "marcel-proust" && m.state.compareAuthorId === KAFKA,
        `${m.state.selectedAuthorId} vs ${m.state.compareAuthorId}`
      );
      await ctx.page.keyboard.press("Escape");
      await ctx.settle(300);
      const m2 = await ctx.metrics();
      ctx.assert("escape-closes-compare", m2.state.compareAuthorId === null, "");
      await ctx.beat("compare-closed");
    }
  },

  "reduced-motion": {
    title: "reduced-motion: 스파크 제거, 방향 인코딩 유지",
    contextOptions: { reducedMotion: "reduce" },
    async run(ctx) {
      await ctx.goto("#/");
      await ctx.waitIdle();
      await searchSelect(ctx, "카프카", KAFKA);
      await ctx.settle(500);
      await ctx.beat("selected-static");
      const m = await ctx.metrics();
      ctx.assert("no-sparks", (m.renderer?.flowSparks ?? -1) === 0, `sparks: ${m.renderer?.flowSparks}`);
      ctx.assert(
        "arrows-preserved",
        (m.renderer?.arrowInstances ?? 0) > 0,
        `static arrowheads: ${m.renderer?.arrowInstances}`
      );
      const flows = (await ctx.events()).filter((e) => e.type === "flows-built");
      ctx.assert("no-flow-events", flows.length === 0, `flows-built events: ${flows.length}`);
      // no sparks → no arrivals → no pulses (the static encodings carry it all)
      const quietEvents = await ctx.events();
      const arrivals = quietEvents.filter((e) => e.type === "flow-arrival");
      const pulses = quietEvents.filter((e) => e.type === "pulse-start");
      ctx.assert(
        "no-arrival-pulses",
        arrivals.length === 0 && pulses.length === 0 && (m.renderer?.flowArrivals ?? -1) === 0,
        `arrival events ${arrivals.length}, pulse events ${pulses.length}, pulsed nodes ${m.renderer?.flowArrivals}`
      );
    }
  },

  "geo-density": {
    title: "실제 지리 밀도: 원경 지역 클러스터 + 중경 인장 군집(겹침 예산)",
    async run(ctx) {
      await ctx.goto("#/?m=geo");
      await ctx.waitIdle();
      await ctx.settle(400);
      await ctx.beat("geo-far");
      const far = await ctx.metrics();
      const r = far.renderer ?? {};
      ctx.assert(
        "region-clusters-at-far",
        (r.labelsByKind?.region ?? 0) >= 6,
        `region labels: ${r.labelsByKind?.region ?? 0} (front hemisphere)`
      );
      // PR3: the unselected geo view draws ZERO raw relations — aggregate
      // corridors only (229 raw edges was the 6th review's biggest visual finding)
      ctx.assert(
        "geo-far-no-raw-edges",
        r.relationView?.rawDrawn === 0 &&
          (r.relationView?.aggregateRoutes ?? 99) <= 16 &&
          (r.relationView?.aggregateRoutes ?? 0) > 0,
        `raw ${r.relationView?.rawDrawn}, routes ${r.relationView?.aggregateRoutes} (≤16)`
      );
      const farRate =
        (r.labelsSuppressed ?? 0) / Math.max(1, (r.labelsShown ?? 0) + (r.labelsSuppressed ?? 0));
      ctx.assert(
        "far-suppression-budget",
        farRate <= 0.25,
        `suppressed ${r.labelsSuppressed}/${(r.labelsShown ?? 0) + (r.labelsSuppressed ?? 0)} = ${(farRate * 100).toFixed(1)}% (budget 25%)`
      );

      // upper mid (seals not yet developed): corridors still speak in regions
      await ctx.page.locator('button[aria-label="확대"]').click();
      await ctx.waitIdle();
      await ctx.settle(500);
      await ctx.beat("geo-upper-mid");
      const um = (await ctx.metrics()).renderer ?? {};
      ctx.assert(
        "geo-upper-mid-corridors",
        um.relationView?.rawDrawn === 0 &&
          (um.relationView?.aggregateRoutes ?? 0) > 0 &&
          (um.relationView?.aggregateRoutes ?? 99) <= 24,
        `raw ${um.relationView?.rawDrawn}, corridors ${um.relationView?.aggregateRoutes} (region-grouped, ≤24)`
      );

      // seal zoom: colliding seals collapse into representative + "+N" chip
      // (R5-B); the true-overlap metric that measured 144 pairs on 2d5a3e3
      // is a hard gate, and the relation policy goes quiet here (hover/
      // selection carry the lines)
      await ctx.page.locator('button[aria-label="확대"]').click();
      await ctx.waitIdle();
      await ctx.settle(600);
      await ctx.beat("geo-mid");
      const mid = (await ctx.metrics()).renderer ?? {};
      ctx.data.geoMidSuppression = {
        shown: mid.labelsShown,
        suppressed: mid.labelsSuppressed,
        overlapping: mid.labelsOverlapping,
        seals: mid.seals
      };
      ctx.assert(
        "geo-mid-seals-clustered",
        (mid.seals?.clusters ?? 0) >= 1 && (mid.seals?.clusteredMembers ?? 0) >= 1,
        `${mid.seals?.clusters} clusters absorb ${mid.seals?.clusteredMembers} members ` +
          `(${mid.seals?.visible} seals visible)`
      );
      ctx.assert(
        "geo-mid-overlap-budget",
        (mid.seals?.overlapPairs ?? 99) <= 2,
        `overlapping seal pairs: ${mid.seals?.overlapPairs} (budget ≤2; was 144 on 2d5a3e3)`
      );
      ctx.assert(
        "geo-seal-zoom-no-raw-edges",
        mid.relationView?.rawDrawn === 0 && (mid.relationView?.aggregateRoutes ?? 99) <= 24,
        `raw ${mid.relationView?.rawDrawn} (was 229 on a601479), ` +
          `routes ${mid.relationView?.aggregateRoutes} (policy: quiet at near, ≤24 at mid)`
      );

      // the chip is a real door: click → member list → select a writer
      const chip = ctx.page.locator(".globe-label--cluster:visible").first();
      await chip.waitFor({ timeout: 5000 });
      await chip.click();
      await ctx.page.locator('[data-qa="cluster-popover"]').waitFor({ timeout: 5000 });
      await ctx.beat("cluster-popover");
      const memberButtons = ctx.page.locator('[data-qa="cluster-popover"] button[data-author-id]');
      const memberCount = await memberButtons.count();
      ctx.assert("cluster-popover-lists-members", memberCount >= 2, `${memberCount} members listed`);
      const targetId = await memberButtons.nth(1).getAttribute("data-author-id");
      await memberButtons.nth(1).click();
      await ctx.settle(600);
      const sel = await ctx.page.evaluate(() => window.__lpQA.state().selectedAuthorId);
      ctx.assert(
        "cluster-member-selectable",
        sel === targetId,
        `selected ${sel} (wanted ${targetId})`
      );
      await ctx.beat("cluster-selected");
    }
  },

  "kafka-journey": {
    title: "카프카 여정: 신규 사용자 완주 — 선택→위계→LOD 정체성→영토 입장→도시·가도→작품 인스펙터→복귀→반복 soak",
    async run(ctx) {
      await ctx.goto("#/");
      await ctx.waitIdle();
      const bytes = async () =>
        (await ctx.metrics()).renderer?.memory?.textureBytesEstimate ?? 0;
      const mib = (b) => Math.round((b / 1048576) * 10) / 10;
      const bytes0 = await bytes();
      await ctx.beat("overview");

      // 1) a new user finds Kafka the disclosed way: the search box —
      // selection centers him with a cancellable flight. (No scripted spin:
      // the recording is the user journey, and the Escape return must land
      // on the very view the reader left.)
      const dir0 = (await ctx.metrics()).renderer.cameraDir;
      await searchSelect(ctx, "카프카", KAFKA);
      await ctx.settle(400);

      // 2) the selected scene has an unmistakable hierarchy: only the story
      // cast is named, aggregate corridors yield, towns already exist at mid
      const mSel = await ctx.metrics();
      const cast = mSel.renderer.interaction.storyCast;
      const authorLabels = mSel.renderer.labelsByKind?.author ?? 0;
      ctx.assert(
        "hierarchy-only-cast-named",
        cast > 0 && authorLabels <= cast,
        `author labels ${authorLabels} ≤ story cast ${cast} (bystanders silent at mid)`
      );
      ctx.assert(
        "no-aggregate-noise-during-story",
        (mSel.renderer.relationView?.aggregateRoutes ?? 0) === 0,
        `aggregate routes ${mSel.renderer.relationView?.aggregateRoutes} (story owns the stage)`
      );
      ctx.assert(
        "treaty-ink-retires-during-story",
        (mSel.renderer.unionOverlay ?? 1) <= 0.05,
        `union overlay ${mSel.renderer.unionOverlay} (was 0.94 — a second information system over the story)`
      );
      ctx.assert(
        "bystander-seals-leave-the-stage",
        (mSel.renderer.seals?.visible ?? 99) <= cast + 1,
        `seals visible ${mSel.renderer.seals?.visible} ≤ cast ${cast}+hover (was 71)`
      );
      ctx.assert(
        "towns-visible-from-approach",
        (mSel.renderer.cityMarkers?.count ?? 0) > 0 && mSel.renderer.lod === "mid",
        `towns at mid: ${mSel.renderer.cityMarkers?.count} (no undisclosed zoom needed to learn they exist)`
      );
      const ids0 = mSel.renderer.interaction.storyRelationIds;
      const builds0 = mSel.renderer.interaction.flowStoryBuilds;
      ctx.assert(
        "story-live",
        ids0.length > 0 && builds0 === 1,
        `${ids0.length} relations in the running story, builds ${builds0}`
      );
      await ctx.beat("selected-mid");

      // (the far/near/orbit identity sweep runs in kafka-soak — verification
      // choreography must not masquerade as the user journey on film)

      // 4) the disclosed door: search leaves the reader in focus mode, so
      // the mini card's 영토 입장 must be fully in view — clicked at its box,
      // never via auto-scroll (9th round). Frame time across the entry gated.
      await clickVisible(ctx, ctx.page.locator(".mini-card__enter"), "territory-door");
      await ctx.waitIdle();
      const mEntry = await ctx.metrics();
      ctx.assert(
        "entry-lands-at-reading-depth",
        mEntry.renderer.lod === "near" && mEntry.renderer.cameraDistance < 195,
        `lod ${mEntry.renderer.lod}, dist ${Math.round(mEntry.renderer.cameraDistance)}`
      );
      const hw = mEntry.renderer.gl && !/swiftshader|llvmpipe/i.test(mEntry.renderer.gl.renderer);
      const seg = mEntry.frame;
      if (hw) {
        ctx.assert(
          "entry-frame-time",
          (seg?.maxMs ?? 999) <= 60,
          `entry segment max frame ${seg?.maxMs}ms (≤60 — was 2×50ms+ with the 134MiB plate upload)`
        );
      } else {
        ctx.assert("entry-frame-time", true, `swiftshader run — frame gate applies on hardware only (max ${seg?.maxMs}ms recorded)`);
      }
      const bytesNear = await bytes();
      ctx.assert(
        "entry-memory-patch-not-planet",
        bytesNear - bytes0 < 16 * 1048576,
        `near entry +${mib(bytesNear - bytes0)}MiB (nation window; was +170.7MiB full plate)`
      );

      // 5) cities are ACTUALLY visible in the unobscured viewport: projected
      // footprint radii of the top-3 curated towns, checked against every
      // open panel rect — a visual claim measured in pixels
      const towns = mEntry.renderer.cityMarkers.screen ?? [];
      const ranked = towns
        .filter((t) => t.rank !== null && t.rank <= 2)
        .sort((a, b) => a.rank - b.rank);
      const panels = await ctx.page.evaluate(() =>
        [...document.querySelectorAll(".detail-panel, .relation-dialog, .mini-card")].map((el) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        })
      );
      const uncovered = (p) =>
        !panels.some((r) => p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom);
      const inView = (p) => p.x > 8 && p.x < 1912 && p.y > 66 && p.y < 1000;
      const visible = ranked.filter((p) => p.r >= 8 && inView(p) && uncovered(p));
      ctx.assert(
        "top-towns-meaningfully-visible",
        ranked.length >= 3 && visible.length >= 3,
        `top-3 towns ${ranked.map((p) => `${p.id.split("--")[1]}@${p.x},${p.y} r${p.r}px`).join(" · ")} — all ≥8px, in view, unobscured (panels: ${panels.length})`
      );
      await ctx.beat("territory-entered");

      // 5½) the elevation lens must CHANGE PIXELS on the selected nation —
      // a state flag once said "active" while the relief painted someone
      // else's land (owner-index bug); never again state-only (8th review)
      const region = (() => {
        const xs = towns.map((t) => t.x);
        const ys = towns.map((t) => t.y);
        const x0 = Math.max(0, Math.min(...xs) - 60);
        const y0 = Math.max(70, Math.min(...ys) - 60);
        return {
          x: x0,
          y: y0,
          width: Math.min(1920 - x0, Math.max(...xs) + 60 - x0),
          height: Math.min(1080 - y0, Math.max(...ys) + 60 - y0)
        };
      })();
      const regionLum = async () => {
        const shot = await ctx.page.screenshot({ clip: region });
        return ctx.page.evaluate(async (b64) => {
          const img = new Image();
          img.src = "data:image/png;base64," + b64;
          await img.decode();
          const c = document.createElement("canvas");
          c.width = Math.round(img.width / 2);
          c.height = Math.round(img.height / 2);
          const g = c.getContext("2d");
          g.drawImage(img, 0, 0, c.width, c.height);
          const d = g.getImageData(0, 0, c.width, c.height).data;
          const out = [];
          for (let i = 0; i < d.length; i += 4) {
            out.push((0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255);
          }
          return out;
        }, shot.toString("base64"));
      };
      const lumBefore = await regionLum();
      await ctx.page.locator(".legend-fold summary", { hasText: /영토|Territory/ }).click();
      await ctx.page.locator(".legend-lens select").selectOption("corpus-density");
      await ctx.page.waitForFunction(
        () => window.__lpQA.metrics().renderer?.lens?.active === true,
        undefined,
        { timeout: 2000 }
      );
      await ctx.settle(500);
      const lumAfter = await regionLum();
      const n = Math.min(lumBefore.length, lumAfter.length);
      let meanAbs = 0;
      for (let i = 0; i < n; i++) meanAbs += Math.abs(lumAfter[i] - lumBefore[i]);
      meanAbs /= Math.max(1, n);
      const lensM = (await ctx.metrics()).renderer.lens;
      ctx.assert(
        "lens-changes-real-pixels",
        lensM.active && meanAbs >= 0.008,
        `lens ${lensM.id} amp ${lensM.amp}; mean |ΔL| over the realm ${meanAbs.toFixed(4)} (≥0.008 — pixels, not a flag)`
      );
      await ctx.beat("lens-relief");

      // 6) town → the unified inspector's work depth: ONE surface, no
      // competing floating card; the town stays beside the panel
      const entryTown = towns.find((t) => t.rank === 0) ?? towns[0];
      await ctx.page.mouse.click(entryTown.x, entryTown.y);
      await ctx.page.waitForFunction(
        () => window.__lpQA.state().selectedWorkId !== null,
        undefined,
        { timeout: 3000 }
      );
      await ctx.waitIdle();
      const inspector = await ctx.page.evaluate(() => ({
        workDepth: Boolean(document.querySelector(".detail-panel .work-inspector")),
        floatingCards: document.querySelectorAll(".work-card").length,
        panels: document.querySelectorAll(".detail-panel").length
      }));
      ctx.assert(
        "one-inspector-no-competing-card",
        inspector.workDepth && inspector.floatingCards === 0 && inspector.panels === 1,
        `work opened INSIDE the panel (floating cards: ${inspector.floatingCards})`
      );
      {
        // opening a city must not amputate its network (9th round): several
        // towns and the reading road stay in the unobscured viewport
        const mW = await ctx.metrics();
        const panelRects = await ctx.page.evaluate(() =>
          [...document.querySelectorAll(".detail-panel, .relation-dialog")].map((el) => {
            const r = el.getBoundingClientRect();
            return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
          })
        );
        const open = (mW.renderer.cityMarkers.screen ?? []).filter(
          (t) =>
            t.x > 8 && t.x < 1912 && t.y > 66 && t.y < 1010 &&
            !panelRects.some((r) => t.x >= r.left && t.x <= r.right && t.y >= r.top && t.y <= r.bottom)
        );
        ctx.assert(
          "network-survives-work-focus",
          open.length >= 3 && (mW.renderer.cityMarkers.roadSegments ?? 0) >= 1,
          `${open.length} towns + ${mW.renderer.cityMarkers.roadSegments} road segments still in the open viewport beside the inspector (was: focus dove to the surface and left the network)`
        );
      }
      {
        const m = await ctx.metrics();
        const selWork = m.state.selectedWorkId;
        const pt = (m.renderer.cityMarkers.screen ?? []).find((p) => p.id === selWork);
        const rects = await ctx.page.evaluate(() =>
          [...document.querySelectorAll(".detail-panel")].map((el) => {
            const r = el.getBoundingClientRect();
            return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
          })
        );
        const buried =
          pt &&
          rects.some((r) => pt.x >= r.left && pt.x <= r.right && pt.y >= r.top && pt.y <= r.bottom);
        ctx.assert(
          "town-beside-inspector",
          Boolean(pt) && !buried,
          `selected town at ${pt ? `${pt.x},${pt.y}` : "?"} beside the inspector (safe-area)`
        );
      }
      await ctx.beat("work-inspector");

      // 7) the reading road is walkable from the inspector; ← returns to the
      // profile on the SAME surface
      const road = ctx.page.locator(".work-inspector__road button");
      if ((await road.count()) > 0) {
        const before = await ctx.page.evaluate(() => window.__lpQA.state().selectedWorkId);
        await road.last().click();
        await ctx.page.waitForFunction(
          (prev) => window.__lpQA.state().selectedWorkId !== prev,
          before,
          { timeout: 3000 }
        );
        await ctx.waitIdle();
        ctx.assert("road-walks-to-next-town", true, "이전/다음 moved the selection along the curated order");
      } else {
        ctx.assert("road-walks-to-next-town", false, "no road navigation buttons in the inspector");
      }
      await ctx.page.locator(".work-inspector__back").click();
      await ctx.page.waitForFunction(
        () => window.__lpQA.state().selectedWorkId === null,
        undefined,
        { timeout: 3000 }
      );
      await ctx.waitIdle(); // the author-bookmark restore flight lands first
      // the profile must come back ALREADY PAINTED — camera restored and the
      // portrait decoded (9th round: the return used to flash a blank plate)
      await ctx.page.waitForFunction(
        () => {
          // two plate genres since R10: duotone canvas (imagined) marks
          // readiness via dataset; the archival branch is an <img> whose
          // readiness is decode-completion. Either way: PAINTED, not blank.
          const plate = document.querySelector(
            ".detail-profile:not(.is-behind) .portrait-plate"
          );
          if (!plate) return false;
          const c = plate.querySelector("canvas");
          if (c) return c.dataset.ready === "1";
          const img = plate.querySelector("img");
          return Boolean(img && img.complete && img.naturalWidth > 0);
        },
        undefined,
        { timeout: 4000 }
      );
      const backState = await ctx.page.evaluate(() => ({
        panelOpen: window.__lpQA.state().panelOpen,
        profile: Boolean(document.querySelector(".detail-panel .work-list")),
        inspector: Boolean(document.querySelector(".work-inspector"))
      }));
      ctx.assert(
        "back-restores-profile",
        backState.panelOpen && backState.profile && !backState.inspector,
        "← returned to the author profile in the same panel"
      );
      await ctx.beat("back-to-profile");

      // 8) full return: Escape ladder to the open planet; the nation window
      // frees the moment the selection ends
      for (let i = 0; i < 5; i++) {
        if ((await ctx.page.evaluate(() => window.__lpQA.state().selectedAuthorId)) === null) break;
        await ctx.page.keyboard.press("Escape");
        await ctx.settle(160);
      }
      await ctx.page.waitForFunction(
        () => window.__lpQA.state().selectedAuthorId === null,
        undefined,
        { timeout: 4000 }
      );
      await ctx.waitIdle();
      const bytesOut = await bytes();
      ctx.assert(
        "exit-releases-window",
        Math.abs(bytesOut - bytes0) < 4 * 1048576,
        `after full exit ${mib(bytesOut)}MiB vs start ${mib(bytes0)}MiB (nation window freed on deselect)`
      );
      {
        // "깔끔하게 돌아온다" is a pose claim: the Escape ladder must land on
        // the very view the reader left (9th round visual review)
        const d1 = (await ctx.metrics()).renderer.cameraDir;
        const dot = d1[0] * dir0[0] + d1[1] * dir0[1] + d1[2] * dir0[2];
        ctx.assert(
          "return-lands-on-departure-view",
          dot > 0.999,
          `camera dir dot(start, return) = ${dot.toFixed(5)} (same view, same stars)`
        );
      }
      // park the visible-cursor overlay in dead space — the film must end
      // on the planet, not on a stray input ring (9th round visual review
      // read the resting cursor as a UI artifact)
      await ctx.page.mouse.move(1908, 1072, { steps: 6 });
      await ctx.settle(150);
      await ctx.beat("returned");

    }
  },

  "kafka-soak": {
    title: "카프카 soak: 진입-이탈 ×3 — 자원 평탄·무스크롤 문·폭주 빌드 0 (여정 녹화와 분리)",
    async run(ctx) {
      await ctx.goto("#/");
      await ctx.waitIdle();
      const bytes = async () =>
        (await ctx.metrics()).renderer?.memory?.textureBytesEstimate ?? 0;
      const mib = (b) => Math.round((b / 1048576) * 10) / 10;
      const bytes0 = await bytes();
      // 9) repeated entry/exit soak ×3 through BOTH doors (second click on
      // the selected star, profile button): bytes flat, no runaway builds
      const doors = ["star", "button", "star"];
      const idsAt = async () =>
        (await ctx.metrics()).renderer.interaction.storyRelationIds.join(",");
      for (let round = 0; round < 3; round++) {
        await searchSelect(ctx, "카프카", KAFKA);
        if (round === 0) {
          // relation identity across LOD + orbit (moved from the journey
          // film): the story set is pinned by ID equality, not counts
          const m0 = await ctx.metrics();
          const ids0 = m0.renderer.interaction.storyRelationIds;
          const key0 = m0.renderer.interaction.storyKey;
          const builds0 = m0.renderer.interaction.flowStoryBuilds;
          await ctx.wheel(960, 540, 1200);
          await ctx.settle(500);
          await ctx.wheel(960, 540, 1200);
          await ctx.settle(700);
          const idsFar = await idsAt();
          const lodFar = (await ctx.metrics()).renderer.lod;
          await ctx.wheel(960, 540, -1200);
          await ctx.settle(500);
          await ctx.wheel(960, 540, -1200);
          await ctx.settle(500);
          await ctx.wheel(960, 540, -900);
          await ctx.settle(700);
          const idsNear = await idsAt();
          const lodNear = (await ctx.metrics()).renderer.lod;
          await ctx.drag([960, 520], [1050, 560]);
          await ctx.settle(500);
          const idsDrag = await idsAt();
          const mA = await ctx.metrics();
          ctx.assert(
            "story-identity-across-lod",
            lodFar === "far" &&
              lodNear === "near" &&
              idsFar === ids0.join(",") &&
              idsNear === idsFar &&
              idsDrag === idsFar,
            `relation IDs identical across ${lodFar}/${lodNear}/orbit (${ids0.length} ids; tiers genuinely reached)`
          );
          ctx.assert(
            "story-clock-untouched",
            mA.renderer.interaction.flowStoryBuilds === builds0 &&
              mA.renderer.interaction.flowStoryDiffs === 0 &&
              mA.renderer.interaction.storyKey === key0,
            `builds ${mA.renderer.interaction.flowStoryBuilds}, diffs ${mA.renderer.interaction.flowStoryDiffs}, key stable`
          );
          for (let i = 0; i < 5; i++) {
            if ((await ctx.page.evaluate(() => window.__lpQA.state().selectedAuthorId)) === null) break;
            await ctx.page.keyboard.press("Escape");
            await ctx.settle(150);
          }
          await ctx.waitIdle();
          await searchSelect(ctx, "카프카", KAFKA);
        }
        if (doors[round] === "star") {
          const pt = ((await ctx.metrics()).renderer.authorScreens ?? []).find(
            (a) => a.id === KAFKA && a.x > 100 && a.x < 1500 && a.y > 100 && a.y < 980
          );
          if (pt) {
            await ctx.page.mouse.click(pt.x, pt.y); // second click = enter
          } else {
            await clickVisible(ctx, ctx.page.locator(".mini-card__enter"), `soak-${round + 1}-door`);
          }
        } else {
          // the profile door: open it through the mini card, then the top
          // action row — visible WITHOUT scrolling (it sat below the fold)
          await openProfile(ctx);
          await clickVisible(
            ctx,
            ctx.page.locator(".detail-actions--top button").first(),
            `soak-${round + 1}-profile-door`
          );
        }
        await ctx.waitIdle();
        const mR = await ctx.metrics();
        if (mR.renderer.lod !== "near") {
          ctx.assert(`soak-${round + 1}-entered`, false, `lod ${mR.renderer.lod} after entry`);
          continue;
        }
        for (let i = 0; i < 5; i++) {
          if ((await ctx.page.evaluate(() => window.__lpQA.state().selectedAuthorId)) === null) break;
          await ctx.page.keyboard.press("Escape");
          await ctx.settle(150);
        }
        await ctx.waitIdle();
      }
      const bytesFinal = await bytes();
      const mFinal = await ctx.metrics();
      ctx.assert(
        "soak-bytes-flat",
        Math.abs(bytesFinal - bytes0) < 4 * 1048576,
        `after 3 enter/exit rounds: ${mib(bytesFinal)}MiB vs start ${mib(bytes0)}MiB`
      );
      ctx.assert(
        "soak-no-runaway",
        (mFinal.renderer.interaction.flowStoryDiffs ?? 99) === 0,
        `diffs still 0 after soak (builds ${mFinal.renderer.interaction.flowStoryBuilds} = one per selection, none from LOD/camera)`
      );
      await ctx.beat("soak-complete");
    }
  },

  "flow-lifecycle": {
    title: "흐름 수명주기: LOD·카메라·스크럽에 phase 보존, commit은 diff, 재생 버튼만 리셋",
    async run(ctx) {
      await ctx.goto("#/");
      await ctx.waitIdle();
      await searchSelect(ctx, "카프카", KAFKA);
      await ctx.settle(400);
      const m0 = await ctx.metrics();
      const builds0 = m0.renderer.interaction.flowStoryBuilds;
      const key0 = m0.renderer.interaction.storyKey;
      ctx.assert(
        "story-built-once-on-select",
        builds0 === 1 && key0 !== null,
        `builds ${builds0}, key ${key0}`
      );
      // contact feedback fired for the selection (search path — no pointer)
      const contactEvents = (await ctx.events()).filter((e) => e.type === "contact-feedback");
      ctx.assert(
        "contact-feedback-fired",
        contactEvents.length >= 1,
        `contact events: ${contactEvents.length}`
      );

      // 1) LOD crossings: zoom to reading distance and back — the 7th review
      // caught rebuildEdges() restarting the story at every tier change
      await ctx.page.locator('button[aria-label="확대"]').click();
      await ctx.waitIdle();
      await ctx.page.locator('button[aria-label="확대"]').click();
      await ctx.waitIdle();
      await ctx.page.locator('button[aria-label="축소"]').click();
      await ctx.waitIdle();
      const m1 = await ctx.metrics();
      ctx.assert(
        "flow-story-persists-across-lod",
        m1.renderer.interaction.flowStoryBuilds === builds0 &&
          m1.renderer.interaction.storyKey === key0 &&
          m1.renderer.interaction.lodTransitions >= 1,
        `builds ${m1.renderer.interaction.flowStoryBuilds} (was ${builds0}), ` +
          `lod transitions ${m1.renderer.interaction.lodTransitions}, key unchanged ${
            m1.renderer.interaction.storyKey === key0
          }`
      );
      // 2) camera drag: same contract
      await ctx.drag([960, 500], [760, 480]);
      await ctx.settle(500);
      const m2 = await ctx.metrics();
      ctx.assert(
        "flow-story-persists-across-camera",
        m2.renderer.interaction.flowStoryBuilds === builds0,
        `builds ${m2.renderer.interaction.flowStoryBuilds}`
      );
      await ctx.beat("story-alive-after-lod");

      // 3) held scrub: the world previews, the story neither restarts nor diffs
      const slider = ctx.page.locator(".timeline-slider");
      const box = await slider.boundingBox();
      const range = await slider.evaluate((el) => ({
        min: Number(el.min),
        max: Number(el.max)
      }));
      const xFor = (year) =>
        // clamp inside the box: the exact right edge lands on the canvas
        Math.min(
          box.x + box.width - 3,
          box.x + box.width * ((year - range.min) / (range.max - range.min))
        );
      const diffs2 = m2.renderer.interaction.flowStoryDiffs;
      await ctx.page.mouse.move(xFor(range.max), box.y + box.height / 2);
      await ctx.page.mouse.down();
      const steps = 20;
      for (let i = 1; i <= steps; i++) {
        const year = range.max - ((range.max - 1930) * i) / steps;
        await ctx.page.mouse.move(xFor(year), box.y + box.height / 2);
        await ctx.page.waitForTimeout(30);
      }
      const during = await ctx.metrics();
      ctx.assert(
        "scrub-previews-world",
        during.renderer.era.previewYear !== null &&
          during.state.year === range.max,
        `previewYear ${during.renderer.era.previewYear}, committed year ${during.state.year}` +
          ` (display ${during.renderer.era.displayYear}${during.renderer.era.loading ? ", painting" : ""})`
      );
      ctx.assert(
        "scrub-no-flow-restart-during",
        during.renderer.interaction.flowStoryBuilds === builds0 &&
          during.renderer.interaction.flowStoryDiffs === diffs2,
        `during drag: builds ${during.renderer.interaction.flowStoryBuilds}, diffs ${during.renderer.interaction.flowStoryDiffs}`
      );
      await ctx.beat("scrub-held-preview");
      await ctx.page.mouse.up();
      await ctx.settle(700);
      const after = await ctx.metrics();
      ctx.assert(
        "scrub-commit-diffs-not-restarts",
        after.renderer.interaction.flowStoryBuilds === builds0 &&
          after.renderer.interaction.flowStoryDiffs - diffs2 <= 1 &&
          after.state.year === 1930 &&
          after.renderer.era.previewYear === null,
        `after release: builds ${after.renderer.interaction.flowStoryBuilds}, ` +
          `diffs +${after.renderer.interaction.flowStoryDiffs - diffs2}, year ${after.state.year}`
      );
      await ctx.beat("scrub-committed");

      // 4) the replay chip is the ONLY sanctioned story reset — it lives in
      // the profile, entered through the mini card door (focus-mode search)
      await openProfile(ctx);
      await ctx.page.locator(".chip--replay").click();
      await ctx.settle(300);
      const replayed = await ctx.metrics();
      ctx.assert(
        "replay-restarts-story",
        replayed.renderer.interaction.flowStoryBuilds === builds0 + 1,
        `builds ${replayed.renderer.interaction.flowStoryBuilds} after replay`
      );
      await ctx.beat("replayed");
    }
  },

  "camera-interrupt": {
    title: "카메라 주권: 자동 focus를 드래그·휠이 즉시 끊고, Escape가 북마크로 복귀",
    async run(ctx) {
      await ctx.goto("#/");
      await ctx.waitIdle();
      const home = (await ctx.metrics()).renderer;

      // selection starts a 450–650ms focus flight — the real user path
      const input = ctx.page.locator(".searchbox input");
      await input.fill("카프카");
      await ctx.page.locator(".search-results li").first().waitFor({ timeout: 5000 });
      await input.press("Enter");
      await ctx.page.waitForFunction(
        () => window.__lpQA.metrics().renderer?.cameraAnimating === true,
        undefined,
        { timeout: 2000 }
      );
      await ctx.settle(220);
      // interrupt mid-flight with a drag; the capture-phase cancel runs inside
      // the same pointerdown dispatch — measure wall time to the probe flip
      const dirBefore = (await ctx.metrics()).renderer.cameraDir;
      const t0 = Date.now();
      await ctx.page.mouse.move(960, 540);
      await ctx.page.mouse.down();
      await ctx.page.waitForFunction(
        () => window.__lpQA.metrics().renderer?.cameraAnimating === false,
        undefined,
        { timeout: 1000 }
      );
      const cancelWallMs = Date.now() - t0;
      for (let i = 1; i <= 14; i++) {
        await ctx.page.mouse.move(960 - i * 14, 540 - i * 4);
      }
      await ctx.page.mouse.up();
      const events = await ctx.events();
      const cancelled = events.filter((e) => e.type === "camera-cancelled");
      ctx.assert(
        "camera-cancel-on-pointer",
        cancelled.some((e) => e.trigger === "pointer"),
        `camera-cancelled events: ${cancelled.map((e) => e.trigger).join(",") || "none"} ` +
          `(probe flipped ${cancelWallMs}ms after mouse.down incl. driver IPC; ` +
          `the cancel itself runs inside the pointerdown dispatch)`
      );
      ctx.assert("camera-cancel-fast", cancelWallMs < 150, `${cancelWallMs}ms wall`);
      // the gesture must have taken effect from the adopted pose
      const dirAfter = (await ctx.metrics()).renderer.cameraDir;
      const dot = dirBefore[0] * dirAfter[0] + dirBefore[1] * dirAfter[1] + dirBefore[2] * dirAfter[2];
      ctx.assert("drag-took-over", dot < 0.9995, `camera moved by drag (dot ${dot.toFixed(5)})`);
      // no post-gesture snap: the damping tail must decay smoothly
      const maxStep = await ctx.page.evaluate(
        () =>
          new Promise((resolve) => {
            let prev = null;
            let worst = 0;
            let n = 0;
            const tick = () => {
              const r = window.__lpQA.metrics().renderer;
              const cur = r.cameraDir;
              if (prev) {
                const dot2 = Math.min(1, prev[0] * cur[0] + prev[1] * cur[1] + prev[2] * cur[2]);
                worst = Math.max(worst, Math.acos(dot2));
              }
              prev = cur;
              if (++n < 24) requestAnimationFrame(tick);
              else resolve(worst);
            };
            requestAnimationFrame(tick);
          })
      );
      ctx.assert(
        "no-post-cancel-snap",
        maxStep < 0.1,
        `worst per-frame angular step after gesture: ${maxStep.toFixed(4)} rad`
      );
      await ctx.beat("cancelled-mid-focus");

      // wheel also cancels — hop to Borges (author→author keeps the original
      // planet bookmark), then start another flight back to Kafka
      await searchSelect(ctx, "보르헤스", BORGES);
      await ctx.page.locator(".searchbox input").fill("카프카");
      await ctx.page.locator(".search-results li").first().waitFor({ timeout: 5000 });
      await ctx.page.locator(".searchbox input").press("Enter");
      await ctx.page.waitForFunction(
        () => window.__lpQA.metrics().renderer?.cameraAnimating === true,
        undefined,
        { timeout: 2000 }
      );
      await ctx.settle(180);
      await ctx.wheel(960, 540, -80);
      await ctx.page.waitForFunction(
        () => window.__lpQA.metrics().renderer?.cameraAnimating === false,
        undefined,
        { timeout: 1000 }
      );
      const cancelled2 = (await ctx.events()).filter((e) => e.type === "camera-cancelled");
      ctx.assert(
        "camera-cancel-on-wheel",
        cancelled2.some((e) => e.trigger === "wheel"),
        `triggers so far: ${cancelled2.map((e) => e.trigger).join(",")}`
      );
      await ctx.waitIdle();

      // Escape walks the ladder back out (panel → selection) and the final
      // deselect restores the pre-selection bookmark
      for (let i = 0; i < 4; i++) {
        if ((await ctx.page.evaluate(() => window.__lpQA.state().selectedAuthorId)) === null) break;
        await ctx.page.keyboard.press("Escape");
        await ctx.settle(150);
      }
      await ctx.page.waitForFunction(
        () => window.__lpQA.state().selectedAuthorId === null,
        undefined,
        { timeout: 3000 }
      );
      await ctx.waitIdle();
      const back = (await ctx.metrics()).renderer;
      const dotHome =
        home.cameraDir[0] * back.cameraDir[0] +
        home.cameraDir[1] * back.cameraDir[1] +
        home.cameraDir[2] * back.cameraDir[2];
      ctx.assert(
        "escape-restores-bookmark",
        dotHome > 0.995 && Math.abs(back.cameraDistance - home.cameraDistance) < 8,
        `deselect flew home: dot ${dotHome.toFixed(4)}, dist ${back.cameraDistance} (home ${home.cameraDistance})`
      );
      await ctx.beat("escape-restored");
    }
  },

  "lod-hysteresis": {
    title: "LOD 히스테리시스: 경계 진동이 세계를 재구축하지 않는다",
    async run(ctx) {
      await ctx.goto("#/");
      await ctx.waitIdle();

      // park just inside the far/mid deadband with real wheel input
      for (let i = 0; i < 60; i++) {
        const d = (await ctx.metrics()).renderer.cameraDistance;
        if (d <= 314) break;
        await ctx.wheel(960, 540, -55);
        await ctx.settle(40);
      }
      await ctx.settle(700);
      const before = await ctx.metrics();
      const t0 = before.renderer.interaction.lodTransitions;
      for (let i = 0; i < 30; i++) {
        await ctx.wheel(960, 540, i % 2 === 0 ? -42 : 42);
        await ctx.settle(40);
      }
      await ctx.settle(700);
      const mid = await ctx.metrics();
      const delta310 = mid.renderer.interaction.lodTransitions - t0;
      ctx.assert(
        "lod-no-thrash-310",
        delta310 <= 1,
        `30× wheel oscillation at ~${mid.renderer.cameraDistance} (deadband 300–320): ${delta310} transitions`
      );
      await ctx.beat("oscillated-310");

      // descend into the mid/near deadband and oscillate again
      for (let i = 0; i < 80; i++) {
        const d = (await ctx.metrics()).renderer.cameraDistance;
        if (d <= 211) break;
        await ctx.wheel(960, 540, -55);
        await ctx.settle(40);
      }
      await ctx.settle(700);
      const b2 = (await ctx.metrics()).renderer.interaction.lodTransitions;
      for (let i = 0; i < 30; i++) {
        await ctx.wheel(960, 540, i % 2 === 0 ? -42 : 42);
        await ctx.settle(40);
      }
      await ctx.settle(700);
      const end = await ctx.metrics();
      const delta205 = end.renderer.interaction.lodTransitions - b2;
      ctx.assert(
        "lod-no-thrash-205",
        delta205 <= 1,
        `30× wheel oscillation at ~${end.renderer.cameraDistance} (deadband 195–215): ${delta205} transitions`
      );
      // deliberate travel still changes tiers: the whole descent from far
      // must have produced real transitions (far→mid→…)
      ctx.assert(
        "lod-deliberate-still-works",
        end.renderer.interaction.lodTransitions >= 1 && end.renderer.lod !== "far",
        `total transitions ${end.renderer.interaction.lodTransitions}, tier now ${end.renderer.lod}`
      );
      await ctx.beat("oscillated-205");
    }
  },

  "memory-soak": {
    title: "메모리 soak: 연도 스크럽 20회 + 선택 20회 후 기준선 복귀",
    async run(ctx) {
      // baseline AFTER deferred boot work settles (idle seal batches, worker
      // union plate) — resources are counted, then hammered, then compared
      await ctx.goto("#/");
      await ctx.waitIdle();
      await ctx.settle(2600);
      const read = async () => {
        const r = (await ctx.metrics()).renderer ?? {};
        return {
          textures: r.textures ?? 0,
          geometries: r.geometries ?? 0,
          bytes: r.memory?.textureBytesEstimate ?? 0
        };
      };
      const base = await read();
      await ctx.beat("baseline");

      // 20 year scrubs across every bracket (in-page hash: camera keeps)
      const years = [1880, 1908, 1925, 1944, 1961, 1979, 1993, 1852, 1900, 1968];
      for (let i = 0; i < 20; i++) {
        const y = years[i % years.length];
        await ctx.page.evaluate((yy) => {
          window.location.hash = `#/?y=${yy}`;
          window.dispatchEvent(new HashChangeEvent("hashchange"));
        }, y);
        await ctx.settle(220);
      }
      const during = await read();
      ctx.assert(
        "era-plates-bounded-during-scrub",
        during.textures <= base.textures + 4,
        `textures during scrub ${during.textures} (baseline ${base.textures}; LRU ≤3 + near)`
      );

      // 20 selection cycles (kafka/borges alternating, then clear)
      for (let i = 0; i < 20; i++) {
        const a = i % 2 === 0 ? "franz-kafka" : "jorge-luis-borges";
        await ctx.page.evaluate((id) => {
          window.location.hash = `#/?a=${id}`;
          window.dispatchEvent(new HashChangeEvent("hashchange"));
        }, a);
        await ctx.settle(200);
      }
      await ctx.page.evaluate(() => {
        window.location.hash = "#/";
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      });
      // the era plates release 10s after returning to the atlas view
      await ctx.settle(11500);
      const final = await read();
      await ctx.beat("after-soak");
      ctx.data.memorySoak = { base, during, final };
      ctx.assert(
        "textures-return-to-baseline",
        final.textures <= base.textures + 2,
        `textures ${base.textures} → ${during.textures} → ${final.textures} (tolerance +2)`
      );
      ctx.assert(
        "geometries-return-to-baseline",
        final.geometries <= base.geometries + 4,
        `geometries ${base.geometries} → ${final.geometries} (tolerance +4)`
      );
      ctx.assert(
        "texture-bytes-return-to-baseline",
        final.bytes <= base.bytes * 1.05,
        `estimated texture bytes ${(base.bytes / 1048576).toFixed(1)}MiB → ` +
          `${(final.bytes / 1048576).toFixed(1)}MiB (tolerance +5%)`
      );
    }
  },

  "memory-soak-long": {
    title: "메모리 soak 20/100/500: 자원 기울기가 0으로 수렴한다",
    async run(ctx) {
      // 7th review: "20회 복귀"는 누수 없음의 증명이 아니다 — 체크포인트
      // 사이의 기울기가 0으로 수렴해야 한다. 연도 키보드 스텝은 커밋마다
      // 시대 브래킷·수명 텍스처·flow diff 경로를 두드리는 실사용 스트레스다.
      await ctx.goto("#/");
      await ctx.waitIdle();
      await ctx.settle(2600); // deferred boot work (seal atlas, union plate)
      const slider = ctx.page.locator(".timeline-slider");
      await slider.focus();
      await ctx.settle(400);
      const read = async () => {
        const m = await ctx.metrics();
        return {
          textures: m.renderer.textures,
          geometries: m.renderer.geometries,
          bytes: m.renderer.memory.textureBytesEstimate
        };
      };
      const checkpoints = [20, 100, 500];
      const samples = [];
      let done = 0;
      for (const target of checkpoints) {
        while (done < target) {
          // one step down, one step up — era brackets churn, year commits
          await slider.press("ArrowLeft");
          await ctx.page.waitForTimeout(18);
          await slider.press("ArrowRight");
          await ctx.page.waitForTimeout(18);
          done++;
        }
        await ctx.settle(1500); // release timers breathe
        samples.push({ n: target, ...(await read()) });
      }
      // extra idle so the 10s era-plate release can run before the verdict
      await ctx.settle(11000);
      const final = await read();
      const s20 = samples[0];
      const s100 = samples[1];
      const s500 = samples[2];
      ctx.assert(
        "soak-slope-converges",
        s500.bytes <= s100.bytes * 1.02 && s100.bytes <= s20.bytes * 1.05,
        `bytes @20 ${(s20.bytes / 1048576).toFixed(1)}MiB → @100 ${(s100.bytes / 1048576).toFixed(1)} → @500 ${(s500.bytes / 1048576).toFixed(1)} (slope→0)`
      );
      ctx.assert(
        "soak-counts-bounded",
        Math.abs(s500.textures - s20.textures) <= 3 &&
          Math.abs(s500.geometries - s20.geometries) <= 4,
        `textures ${s20.textures}→${s500.textures}, geometries ${s20.geometries}→${s500.geometries}`
      );
      ctx.assert(
        "soak-final-release",
        final.bytes <= s20.bytes * 1.05,
        `after release wait: ${(final.bytes / 1048576).toFixed(1)}MiB vs @20 ${(s20.bytes / 1048576).toFixed(1)}MiB`
      );
      await ctx.beat("after-500");
    }
  },

  "en-locale": {
    title: "EN locale: 헤더·범례·프로필 영어 전환",
    async run(ctx) {
      await ctx.goto("#/?l=en&a=franz-kafka");
      await ctx.waitIdle();
      await ctx.beat("en-profile");
      const header = (await ctx.page.locator(".app-header").textContent()) ?? "";
      ctx.assert(
        "en-mode-toggle",
        header.includes("Literary affinity") && header.includes("Real geography"),
        "mode toggle in English"
      );
      const legend = (await ctx.page.locator(".legend-panel").textContent()) ?? "";
      ctx.assert("en-legend", legend.includes("Coordinates:"), "legend in English");
      await openProfile(ctx);
      const panel = (await ctx.page.locator(".detail-panel").textContent()) ?? "";
      ctx.assert("en-profile-name", panel.includes("Franz Kafka"), "profile in English");
    }
  },

  dpr2: {
    title: "DPR 2: 고해상도 렌더·라벨 예산 준수",
    contextOptions: { deviceScaleFactor: 2 },
    async run(ctx) {
      await ctx.goto("#/");
      await ctx.waitIdle();
      await ctx.beat("dpr2-overview");
      const m = await ctx.metrics();
      ctx.assert("dpr-reported", m.viewport?.dpr === 2, `dpr: ${m.viewport?.dpr}`);
      ctx.assert(
        "pixel-ratio-capped",
        (m.renderer?.pixelRatio ?? 0) === 2,
        `renderer pixelRatio: ${m.renderer?.pixelRatio} (cap 2)`
      );
      await searchSelect(ctx, "카프카", KAFKA);
      await ctx.settle(600);
      const sel = await ctx.metrics();
      const hw2 = sel.renderer.gl && !/swiftshader|llvmpipe/i.test(sel.renderer.gl.renderer);
      const fr = sel.frame;
      if (hw2) {
        ctx.assert(
          "dpr2-selection-frame-time",
          (fr?.maxMs ?? 999) <= 80,
          `selection segment max frame ${fr?.maxMs}ms at DPR2 (≤80 — a 265ms frame once passed unnoticed)`
        );
      } else {
        ctx.assert("dpr2-selection-frame-time", true, `swiftshader run — gate applies on hardware (max ${fr?.maxMs}ms recorded)`);
      }
      await ctx.beat("dpr2-selected");
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
