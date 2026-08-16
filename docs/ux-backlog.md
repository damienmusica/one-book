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
14. **Geo mid-zoom city clustering.** Far LOD now clusters by region; dense
    mid-zoom areas (Europe) still suppress many label candidates — cluster
    same-city authors with spiral expansion on focus.
15. **Incoming/outgoing/all relation view toggle** on selection (staged
    reveal shipped; the filter toggle is UI + state work).
16. **Arrival pulse** on the receiving node when a spark lands (staging
    shipped without it — needs a cheap per-arrival glow that respects
    reduced-motion).
17. **Palette contrast regrade** (five distinct value tiers for surface /
    territory / relation / node / selection) — deliberately routed through
    an art-directed pass, not a unilateral CSS change: the antique-atlas
    identity is CPO-approved.
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
