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

      // towns are destinations now: open 소송 with a real click, read the
      // card, confirm the camera never moved, close with Escape
      const before = await ctx.metrics();
      await ctx.page.getByRole("button", { name: "작품 카드 열기: 소송" }).click();
      await ctx.page.locator(".work-card").waitFor({ timeout: 5000 });
      await ctx.beat("work-card");
      const cardText = await ctx.page.locator(".work-card").textContent();
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
      ctx.assert(
        "camera-preserved-on-card",
        Math.abs((after.renderer?.cameraDistance ?? 0) - (before.renderer?.cameraDistance ?? 0)) < 2,
        `${before.renderer?.cameraDistance} → ${after.renderer?.cameraDistance}`
      );
      ctx.assert(
        "work-url-shareable",
        (await ctx.page.evaluate(() => window.location.hash)).includes("w=franz-kafka--der-process"),
        "w= in hash"
      );
      await ctx.page.keyboard.press("Escape");
      await ctx.page.locator(".work-card").waitFor({ state: "detached", timeout: 5000 });

      // keyboard path: focus a town label, Enter opens its card
      await ctx.page.getByRole("button", { name: "작품 카드 열기: 변신" }).focus();
      await ctx.page.keyboard.press("Enter");
      await ctx.page.locator(".work-card").waitFor({ timeout: 5000 });
      await ctx.beat("work-card-keyboard");
      ctx.assert("work-keyboard-open", true, "Enter on focused town label");
      await ctx.page.keyboard.press("Escape");
      await ctx.page.locator(".work-card").waitFor({ state: "detached", timeout: 5000 });

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
        await ctx.page.locator(".work-card").waitFor({ timeout: 5000 });
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

      // ring size = curated reading rank + ◆ harbor = entry are live; the
      // full city system (thematic districts, translation ports, adaptation
      // bridges) stays declared roadmap, not staged
      ctx.notImplemented(
        "city-districts",
        "districts/ports/bridges are P2 roadmap (ux-backlog); size+shape+route encodings shipped"
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
