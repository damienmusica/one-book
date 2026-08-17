# UX backlog — accepted from real-use feedback, not yet built

> 2026-08-16 second review (external desktop/QA spec): its verified items
> shipped the same day — methodology→map routing fix, instrumentation +
> debug overlay, the QA capture harness (docs/qa-harness.md), 2D fallback
> keyboard access + label collision pass, and qualitative relation-weight
> presentation. The desktop shell (Electron/Tauri) and any monorepo
> restructuring were deferred with rationale in docs/adr/0001 — the engine,
> data, and QA scenes stay shell-independent, and the shell decision waits
> for a real distribution need plus three-platform measurements.

> 2026-08-16 third review (bundle-based product review): shipped same day —
> tour panel no longer auto-opens (planet dominant), always-available legend
> (types/coord-mode/terrain+town key), stronger selection dim (0.42→0.25,
> rest-edges 0.28→0.16), staged spark reveal (incoming 200ms → outgoing
> 700ms), per-line type labels now hover/pick-only, geo far view speaks in
> region clusters (+far-label regional fairness boost), **works are
> selectable cities** (clickable/keyboard town labels → work card, `w=` deep
> link, ring size = curated reading rank), QA measurement fixes (per-beat
> frame reset, suppressed≠overlapping semantics, budgets, cursor-visible
> videos), 5 new scenes (compare/reduced-motion/geo-density/en-locale/dpr2),
> and the review bundle now carries runnable `dist/` + full source zip.
>
> **Claims that review got wrong (recorded so they are not re-litigated):**
> - "지리 모드 라벨 60개 중 45개 충돌(75%) = 기능적으로 실패한 화면" — a
>   misread of our metric: `labelsCollided` counted candidates the greedy
>   pass *refused to place* (they never render); placed labels do not
>   overlap. The real issue was density → many things unlabeled, fixed at
>   far LOD by region clusters and now measured as `labelsSuppressed` vs
>   `labelsOverlapping` (true on-screen overlaps, budget ≤2, asserted).
> - "overview assertion 229/229 vs 상태 229/263 불일치 = 테스트가 데이터
>   누락을 못 잡는다" — not a correctness bug: the assert pinned visible
>   ==229 (contrast is default-off) and separate tests pin the 263 corpus
>   total; only the detail *string* was ambiguous, now spelled out.

Provenance: external real-use feedback received 2026-08-16. Its five falsifiable
correctness claims all reproduced and were fixed the same day (commits e2daf17,
fd2d832 — state-carrying nav, canonical path arrows, curated major works,
shown/total counts, 2D ego-graph fallback, typography, directional flow sparks).
This file records the items we judged **worth doing but out of that sprint's
scope**, so they survive session boundaries. Items the feedback got wrong are
listed at the bottom so we don't re-litigate them.

## Accepted, pending (roughly by value/effort)

1. **Profile progressive disclosure.** Detail panel is ~4,000px of continuous
   scroll. Essential card first (one-line significance, entry work, top works,
   strongest relations), then Overview / Works / Relations / Sources sections;
   collapse long relation groups.
2. **Guided journeys out of the filter drawer.** Tours are a reading mode, not
   an analytical filter; give them their own entry point (the drawer currently
   mixes both).
3. **Universal grouped search.** Works (KO + original titles), movements,
   languages/regions, tours alongside authors; preview target on the planet
   before committing.
4. ~~**Work-level selection.**~~ **Shipped 2026-08-16** (third review P0-4):
   town labels are buttons, work card with curated position + sources, `w=`
   deep link, ring size = reading rank. Remaining city-system depth is item
   13 below.
5. **Tour ↔ compare suspension.** Starting a comparison mid-tour should pause
   the tour instead of stacking tour overlay + panel + modal.
6. **Writers page card view.** Compact card list as default, full 10-column
   table as an opt-in; current table is dense on laptops, hostile on mobile.
7. **Mobile bottom-sheet pattern** for profile/filters instead of shrunken
   desktop panels.
8. **Claim-level evidence upgrade (editorial wave, not UI).** Relation evidence
   should carry exact author/title/year/pages + stable URL/DOI + short excerpt
   where available; today's sources are institution-level. This is a data
   generation + QC wave across 263 relations.
9. **Terrain lenses.** Alternative declared elevation/area metrics (canon
   weight, network centrality, translation brokerage…), always labeled with
   formula and limitations. Terrain v1 froze exactly one metric on purpose;
   lenses need a bake pipeline per metric.
10. **Temporal relation gating.** In timeline mode, show a relation only when
    its evidence supports the year range; needs per-relation time bounds in
    data first.
11. **Second-degree paths on demand** from the selection web; and camera travel
    along a clicked route after its evidence card.
12. **Edge bundling + label collision pass** at overview zoom (Phase-2 scale
    work).
13. **City-system depth** (third review P2): thematic districts, translation
    ports, adaptation bridges inside a territory; work-level metrics need
    registered semantics + legend before any "importance" encoding.
    *(2026-08-17: entity promotion shipped in territory v2.0 — raycastable
    markers, shared hover, 44px+ hits; districts/ports/bridges remain.)*
14. ~~**Geo mid-zoom city clustering.**~~ **Shipped 2026-08-17** (5th review
    P0-3): screen-space seal clustering at geo mid/near — colliding seals
    collapse into the highest-priority seal + "+N" chip; chip opens a member
    popover (list expansion, not spiderfy — a11y-friendlier); the collision
    predicate matches the overlap metric, so `overlapPairs` fell 144 → ≤2
    and is now a hard scene budget. Remaining nuance: hysteresis is
    camera-delta throttling only; boundary flicker during slow pans is
    possible (revisit if it reads badly in real use).
15. **Incoming/outgoing/all relation view toggle** on selection (staged
    reveal shipped; the filter toggle is UI + state work).
16. ~~**Arrival pulse.**~~ **Shipped 2026-08-17** (5th review P0-5): each
    receiving node answers its first arriving spark with one additive glow
    pulse (dim → incoming → selected answers → outgoing → receivers answer
    once → steady); `flow-arrival` events logged per node, QA asserts
    in/out arrivals + exactly-once per node; reduced-motion keeps zero
    pulses (asserted).
17. **Palette contrast regrade** (five distinct value tiers for surface /
    territory / relation / node / selection) — deliberately routed through
    an art-directed pass, not a unilateral CSS change: the antique-atlas
    identity is CPO-approved. *(2026-08-17 partial: map typography scaled
    up — author md 12.5→14 / sm 11→12 / selected 15 / work 11.5 / legend 12
    — alongside the planet scale-up R 100→118; the tonal regrade itself
    still awaits the art pass.)*
18. **Navigation depth**: selection history back/forward, breadcrumb
    (행성 > 지역 > 작가 > 작품), bookmarks/collections, A→B path finder UI.
19. **A11y audit batch**: full keyboard travel in 3D, screen-reader scene
    descriptions, 200% text zoom, high-contrast/color-blind check, small +
    ultrawide windows, slider a11y values.
20. **Relation data modeling wave** (editorial, not UI): per-type role
    fields (translation: translated_by/language/year), claim-type +
    disputed flags, affinity subtypes; extends the existing claim-level
    evidence wave (item 8).
21. **Load/scale scenes**: staged particle/label/author-count load tests +
    memory-growth repetition scene; budgets per commodity-GPU baseline when
    hardware is available.

> 2026-08-16 fourth review (source-audited): shipped same day — legend truth
> contract (the "size AND height = documented influence" line was wrong on
> all three counts; fixed + legend-contract test binds legend ↔ methodology
> ↔ territory.v1 formula), CPO-reported zoom bugs (rotate speed now scales
> with height above surface; near terrain plate 4096→6144px where the GPU
> allows), seal screen-space overlap metric (the geo-near collapse is now
> measured, not invisible), FPS summary regression fixed (per-beat
> aggregation: steady median + worst p95), pass/gap/fail reported
> separately, 44px town hit targets. The reviewer formally accepted both
> prior rebuttals. **Territory grammar v2 (nations / movement unions / era
> morphing) is designed, not built — docs/territory-grammar-v2.md, CPO
> decision points D1–D5.**

22. **Spatial compare mode**: keep the globe visible with both nations and
    the path highlighted; cards link to the map; hover cross-highlighting;
    swap second author without closing (4th review P1).
23. **Tour reading panel**: one unified journey panel instead of
    profile+tour card+legend+timeline stacking; collapse timeline during
    tours; legend to chip (4th review P1).
24. **Bundle splitting**: *(2026-08-17 partial: territory.v1.eras.json now
    loads as its own async chunk — main 3.14MB→1.79MB raw, gzip 939→559KB.)*
    Remaining: lazy author/work/translation data and per-page code splits
    before the corpus grows.
25. **E2E depth**: 3D relation-line pointer picking, work deep-link reload
    restore, active-year timeline mode, small/ultrawide windows, 200% zoom,
    touch/pinch, memory soak; cross-platform (Windows iGPU / Linux) when
    hardware exists.
26. **Editorial surface honesty**: expose reviewed≠verified distinction and
    QC-ledger open items in UI copy; claim-level sources wave remains item 8.

> 2026-08-17 fifth review (source-audited, of 2d5a3e3): **every claim
> verified accurate — zero rebuttals this round** (a first). Shipped same
> day: the era-morph truth contract (methodology's "the fader moves no
> coastline" was flatly false against shipped v2.5 — rewritten in both
> locales with the real growth formula + curated-corpus caveat; the
> legend-contract test that had PINNED the false sentence now binds legend ↔
> methodology ↔ territory.v1.eras.json params), legend era row + sovereignty
> state key, treaty spans demoted to ≈ computed values (treatyOf returns
> gap-preserving intervals — the merged-gap shortcut the reviewer flagged is
> fixed and unit-pinned; cartouche reads "모더니즘 ≈ 1895–1985"), geo mid
> seal clustering (144 overlap pairs → ≤2 hard budget + popover E2E),
> arrival pulses, map typography scale-up, small-screen legend bottom-sheet,
> profile sovereignty badge, eras async chunk, BUILD_COMMIT reproducibility
> (env > git > file ladder; source zips embed the sha via
> --add-virtual-file), canvas pointerleave now clears work hover (and a
> latent compare-after-assign bug that made marker hover emphasis dead code),
> planet scale-up R 100→118 + capacity ceilings raised (lifeTex 128→256;
> registry §4½) per CPO directive. Vitest exits cleanly here (157/157,
> exit 0) — the reviewer's hanging-process observation did not reproduce on
> macOS; likely their sandbox's tsx/IPC quirk, watch in CI.

> 2026-08-17 sixth review (source-audited, of a601479): again zero
> rebuttals — every number matched our own artifacts (renderer 2,323 lines,
> overview boot p99 133.3ms, geo mid 229 relations / 8,112 glLines, 13
> outgoing pulses inside a 166ms window against a 12-slot pool). The review
> prescribed the sprint (PR1–6) and we executed it same-day: instrumentation
> first (p99/max/long-task columns, texture-byte ledger, per-scene request
> log), then TRUE demand loading — the eras JSON now loads and parses inside
> the paint worker on first timeline intent, era/near/union plates paint
> off-thread, resident era plates LRU ≤3, target/display year split commits
> atomically with a "시간 지도 준비 중" state. Boot went from hitches in
> 12/12 scenes to ONE 66ms bootstrap task before first paint; the
> first-interaction window gates at p99 <50ms + zero long tasks (measured
> 18.6ms). RelationLayer policy: unselected geo draws 0 raw edges (was 229)
> — ≤16 region corridors at far, ≤24 cluster corridors at mid, quiet at
> near; selection ego caps at 20 with "더 보기" (max degree today is 18, so
> the cap is dormant but tested). Flow state machine v2: staggered incoming,
> an impact RING at the center, outgoing in 3 waves (arrival spread 967ms,
> was 166ms), pulse pool sized to receivers (14 starts / 14 ends, no
> truncation), pulse-start/end events + an event-synced live-pulse capture.
> Cluster popover: focus returns to the +N chip, bottom clamp, majority-
> region title, aria-describedby. Selection reticle: single ring + short
> halo. Legend: four folding keys. New memory-soak scene: 20 scrubs + 20
> selections return textures/bytes to baseline (7→10→8 textures, 54.1MiB
> steady). Deliberately NOT finished: the ≤900-line coordinator (item 29
> stays open — two layers extracted as real modules, the rest continues).

27. **Movement historical periods (editorial data model)**: curated
    movement-level activeRange with sources + uncertainty + per-author
    membership spans (join/leave or core-participation years), stored as
    interval arrays; only then may the cartouche drop the ≈. Until curated,
    computed-overlap display is the honest ceiling (5th review P0-2).
28. **Movement selection**: treaty cartouche + inset strokes clickable →
    movement card (description, members, period basis ≈ formula + sources,
    multi-membership); "보이는 것은 역으로 설명 가능해야 한다" (5th review).
29. **Renderer Layer decomposition** (strangler, in progress): the 6th-review
    sprint extracted `layers/temporal-terrain.ts` (worker paints, LRU,
    demand loading, own metrics/dispose) and `layers/relation-view.ts` (the
    raw/aggregate/ego display policy, unit-tested), and rewrote the flow
    state machine + pulse pool in place. renderer.ts is 2,681 lines as of
    R6 — still the coordinator AND the nation/seal/label/pick host; the
    remaining extractions (NationLayer, SealClusterLayer, FlowLayer file
    moves, ≤900-line coordinator) continue next sprint with the QA scenes
    as the characterization net. Do not update this count by hand — run
    `wc -l src/globe/renderer.ts`.
30. **Era-growth legibility pass**: the 1880→1915 change is subtle in the
    low-value palette (5th review) — candidate treatments: brighter embryonic
    islet ink, coastline-delta shimmer during scrub, era readout near the
    fader. Pairs with item 17's art pass.
31. **Five-value luminance regression**: screenshot-based value-tier
    measurement (surface/territory/relation/node/selection bands) pinned in
    QA once item 17's regrade lands.

> **Provenance — 7th external review (GPT sol max, 2026-08-17, of v0.1.0
> @2d6aade):** the game-grade UX review. Verified with ZERO rebuttals again —
> every number reproduced exactly (initial-frame mean luminance 0.0735 /
> 91.6% below 10%, kafka flows-built restart at 928ms during the focus
> flight, era-morph double rebuild at 7956/7957ms, 57 hard-coded colors in
> styles.css, Line raycast threshold 1.5 world units ≈ 6.5 screen px,
> zoomToCursor present-but-off in three 0.172). Confirmed P0 mechanisms:
> rebuildEdges() calls buildFlows() so LOD/scrub/filter changes restart the
> relation story; camAnim has no cancellation path and skips
> controls.update() so gesture deltas accumulate and snap at animation end;
> lodLevel() is a single-threshold function (310/205) with no hysteresis or
> dwell; year changes rebuild flows on every slider value; first contact
> feedback arrives ~1.2s after selection. The review's verdict stands: the
> engine earned trust, the product surface is not yet game-grade. Sprint
> R7 (PR0–PR5 below) executes its prescription; scope frozen (no galaxy, no
> new authors, no new pages) until the Kafka vertical slice passes.

32. **CameraController + LOD hysteresis** (7th review PR1) — SHIPPED R7:
    cancel measured 21ms wall incl. driver IPC, worst post-gesture step
    0.039rad; 0 tier transitions across 30× wheel oscillation in both
    deadbands; Escape restored dist 360.9→360.9. Crossfade shipped for the
    DOM label layer only (WebGL layers already fade continuously with
    distance) — full geometry crossfade not implemented.
33. **FlowStory lifecycle** (7th review PR2) — SHIPPED R7: storyBuilds
    stayed 1 across 2 LOD transitions + camera drag; 20-step held scrub =
    0 builds/0 diffs during, +1 diff on commit; replay chip = the only
    reset (builds 2). Removed sparks fade 150ms; joiners enter ambient.
34. **Immediate contact feedback** (7th review PR2) — SHIPPED R7: press→
    applied p95 0.3ms (same dispatch), terrain flash 50ms attack/160ms
    decay, search/keyboard selections covered, reduced-motion skips.
35. **Visual hierarchy regrade v2** (7th review PR3) — SHIPPED R7:
    below-10%-L pixel share 91.6%→68.0% (sea = its own L1 value at the
    mode palette), QA pins the band; 45 color literals → tokens + vitest
    lint; 13px map-text floor lint; semantic mid 229 raw → ≤24
    constellation corridors; seal + treaty-ink retreat. Art-directed
    palette pass (17) remains open; 30/31 subsumed.
36. **Kafka vertical slice** (7th review PR4) — SHIPPED R7: 11-assert
    uncut loop scene (hover p95 17.6ms → contact 0.3ms → narrative live →
    lens relief amp 0.97 → 5 towns/5 clusters/2 road segments →
    bidirectional hover → town card with safe-area framing → Escape
    ladder → drag cuts the restore flight). Port/sea-route archetypes
    stay data-blocked (no translation edges in the taxonomy yet).
37. **Memory/line-quality** (7th review PR5) — PARTIAL R7: seal atlas
    shipped (100 CanvasTextures → 1 shared source, one GPU upload; bytes
    honestly ±0 at the same 256px cells — the win is binds/uploads/
    lifecycle, recorded per the "adopt only if numbers improve" rule);
    memory-soak-long shipped (bytes flat at 64.8MiB across 20/100/500
    scrub checkpoints, slope 0, release back to 54.1MiB). NOT implemented:
    the near-plate visible-patch spike — analysis recorded: full-equirect
    8192×4096 near plate ≈170.7MiB with mips vs a 2048² camera-window
    patch ≈22.4MiB (−87%), at the cost of worker repaints on camera pan
    with hysteresis margins; do this spike before any galaxy-scale corpus,
    together with the SDF coast/line-quality experiment.
38. **Touch two-stage select** (7th review P1, deferred): first tap =
    preselect/context chip, second tap = enter. Needs a real touch-device
    pass, not just emulation; do with item 25's device matrix.

## Feedback claims we checked and rejected (do not re-open without new evidence)

- **"2026 acts as an undeclared all-time sentinel"** — the timeline label and
  `aria-valuetext` already read 전체 시기 / All years at the slider max.
- **"Selection shows static relations with no direction"** — arrowhead cones
  and a source-dim→target-bright gradient predate the feedback; what was
  missing was motion, added as selection-scoped flow sparks (fd2d832).
- **"Comparison needs a shareable route"** — `#/?a=X&cmp=Y` already serializes
  comparison; verified working as a cold deep link. (A dedicated `/compare`
  path would add nothing but a second URL shape.)
- **"Add prominenceRank / isMajorWork fields"** — `author.readingOrder` is
  already the explicit editorial ranking (schema-enforced entry-first). The bug
  was UI ignoring it; adding parallel fields would create a second source of
  truth.
- **"Move secondary nodes with constrained optimization, version layouts"** —
  rejected for now: frozen positions v1 are a deliberate trust property (stable
  addresses, stable terrain); revisit only at a major corpus expansion.
