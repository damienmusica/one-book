# UX backlog — accepted from real-use feedback, not yet built

> 2026-08-16 second review (external desktop/QA spec): its verified items
> shipped the same day — methodology→map routing fix, instrumentation +
> debug overlay, the QA capture harness (docs/qa-harness.md), 2D fallback
> keyboard access + label collision pass, and qualitative relation-weight
> presentation. The desktop shell (Electron/Tauri) and any monorepo
> restructuring were deferred with rationale in docs/adr/0001 — the engine,
> data, and QA scenes stay shell-independent, and the shell decision waits
> for a real distribution need plus three-platform measurements.

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
4. **Work-level selection.** Clicking a town should open a work card
   (publication data, significance, entry guidance) rather than only labeling
   it; LOD already places the towns.
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
