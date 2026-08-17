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

27. **Movement historical periods (editorial data model)**: curated
    movement-level activeRange with sources + uncertainty + per-author
    membership spans (join/leave or core-participation years), stored as
    interval arrays; only then may the cartouche drop the ≈. Until curated,
    computed-overlap display is the honest ceiling (5th review P0-2).
28. **Movement selection**: treaty cartouche + inset strokes clickable →
    movement card (description, members, period basis ≈ formula + sources,
    multi-membership); "보이는 것은 역으로 설명 가능해야 한다" (5th review).
29. **Renderer Layer decomposition** (dedicated sprint, deliberately NOT
    bundled into the fix sprint): renderer.ts ~2,100 lines → the documented
    Layer interface (update/render/pick/describe/metrics/dispose) from
    territory-grammar §6; the QA harness is the safety net. Planet/era data
    lazy-loading landed first (this sprint) so the split can be mechanical.
30. **Era-growth legibility pass**: the 1880→1915 change is subtle in the
    low-value palette (5th review) — candidate treatments: brighter embryonic
    islet ink, coastline-delta shimmer during scrub, era readout near the
    fader. Pairs with item 17's art pass.
31. **Five-value luminance regression**: screenshot-based value-tier
    measurement (surface/territory/relation/node/selection bands) pinned in
    QA once item 17's regrade lands.

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
