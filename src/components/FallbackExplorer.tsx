import { useMemo } from "react";
import { useAppState, useContent, useServices, useT } from "./ctx.ts";
import { visibleAuthorIds } from "../lib/filter.ts";
import { neighborsOf } from "../lib/graph.ts";
import { relationTypeShort } from "../i18n/index.ts";
import { RELATION_COLORS } from "../theme.ts";
import { RELATION_DEFS } from "../types.ts";
import type { Author } from "../types.ts";

const W = 960;
const H = 600;
const CX = W / 2;
const CY = H / 2;
const RING = 218;

/**
 * 2D replacement for the globe when WebGL is unavailable: an ego graph of the
 * selected writer (typed, direction-true edges; click a line for its evidence,
 * click a neighbor to travel) over the same store the 3D map uses — filters,
 * timeline, search, profile, and comparison keep working unchanged.
 *
 * Fully keyboard-operable: nodes and evidence lines are buttons (Enter/Space
 * activates, arrow keys cycle within the group, Escape closes the dialog via
 * the app-level handler), and direction is carried by arrows, dash patterns,
 * and label text — never by color alone.
 */

/** arrow keys cycle focus through the elements matching selector */
function rovingKeyNav(e: React.KeyboardEvent<SVGElement>, selector: string): void {
  if (!["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(e.key)) return;
  const all = Array.from(document.querySelectorAll<SVGElement>(selector));
  const i = all.indexOf(e.currentTarget);
  if (i < 0 || all.length === 0) return;
  const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
  all[(i + dir + all.length) % all.length]?.focus();
  e.preventDefault();
}

function pressable(
  action: () => void,
  cycleSelector: string
): {
  role: "button";
  tabIndex: number;
  onKeyDown: (e: React.KeyboardEvent<SVGElement>) => void;
} {
  return {
    role: "button",
    tabIndex: 0,
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        action();
        return;
      }
      rovingKeyNav(e, cycleSelector);
    }
  };
}

export function FallbackExplorer() {
  const state = useAppState();
  const services = useServices();
  const { store, dataset, adjacency } = services;
  const t = useT();
  const content = useContent();

  const visible = useMemo(
    () => visibleAuthorIds(dataset.authors, state.filters, state.year, state.yearMode),
    [dataset.authors, state.filters, state.year, state.yearMode]
  );
  const authorById = useMemo(
    () => new Map(dataset.authors.map((a) => [a.id, a])),
    [dataset.authors]
  );

  const selected = state.selectedAuthorId
    ? authorById.get(state.selectedAuthorId) ?? null
    : null;

  const spokes = useMemo(() => {
    if (!selected) return [];
    return neighborsOf(adjacency, selected.id)
      .filter(
        ({ otherId, relation }) =>
          state.filters.relationTypes.includes(relation.type) && visible.has(otherId)
      )
      .map(({ otherId, relation }, i, arr) => {
        const angle = (i / arr.length) * Math.PI * 2 - Math.PI / 2;
        return {
          other: authorById.get(otherId)!,
          relation,
          x: CX + Math.cos(angle) * RING,
          y: CY + Math.sin(angle) * RING
        };
      });
  }, [selected, adjacency, authorById, state.filters.relationTypes, visible]);

  // greedy label placement along each spoke (same discipline as the 3D
  // LabelLayer): try midpoint first, then slide outward/inward until the box
  // clears everything already placed — verified against real Kafka density
  const labelT = useMemo(() => {
    const placed: Array<{ x0: number; x1: number; y0: number; y1: number }> = [];
    const chosen = new Map<string, number>();
    for (const { relation, x, y } of spokes) {
      const text = relationTypeShort(relation.type, state.locale);
      const w = text.length * 11 + 6;
      const ux = x - CX;
      const uy = y - CY;
      let pick = 0.5;
      for (const t of [0.5, 0.64, 0.36, 0.78, 0.26]) {
        const lx = CX + ux * t;
        const ly = CY + uy * t - 6;
        const box = { x0: lx - w / 2, x1: lx + w / 2, y0: ly - 11, y1: ly + 3 };
        const hit = placed.some(
          (p) => p.x0 < box.x1 && p.x1 > box.x0 && p.y0 < box.y1 && p.y1 > box.y0
        );
        if (!hit) {
          pick = t;
          placed.push(box);
          break;
        }
      }
      chosen.set(relation.id, pick);
    }
    return chosen;
  }, [spokes, state.locale]);

  const roster = useMemo(() => {
    const tierRank = { anchor: 0, major: 1, context: 2 } as const;
    return dataset.authors
      .filter((a) => visible.has(a.id))
      .sort(
        (a, b) =>
          tierRank[a.tier] - tierRank[b.tier] ||
          content.authorName(a).localeCompare(content.authorName(b), state.locale)
      );
  }, [dataset.authors, visible, content, state.locale]);

  function nodeButton(a: Author) {
    return (
      <button
        key={a.id}
        type="button"
        className={`chip fallback-roster-chip${a.tier === "anchor" ? " is-anchor" : ""}`}
        onClick={() => store.selectAuthor(a.id)}
      >
        {content.authorName(a)}
      </button>
    );
  }

  return (
    <div className="fallback-explorer">
      <div className="fallback-note" role="note">
        <strong>{t.webglTitle}</strong> — {t.webglNote}
      </div>

      {!selected && (
        <>
          <p className="fallback-hint">{t.fallbackPickHint}</p>
          <div className="fallback-roster">{roster.map(nodeButton)}</div>
        </>
      )}

      {selected && (
        <>
          <div className="fallback-toolbar">
            <button type="button" className="chip" onClick={() => store.selectAuthor(null)}>
              ← {t.fallbackShowAll}
            </button>
            {/* direction totals for screen readers (arrows carry it visually) */}
            <span className="sr-only" role="note">
              {t.fallbackSummary(
                spokes.filter((s) => s.relation.direction === "directed" && s.relation.targetId === selected.id).length,
                spokes.filter((s) => s.relation.direction === "directed" && s.relation.sourceId === selected.id).length,
                spokes.filter((s) => s.relation.direction !== "directed").length
              )}
            </span>
          </div>
          <svg
            className="fallback-ego"
            viewBox={`0 0 ${W} ${H}`}
            role="group"
            aria-label={t.fallbackEgoAria(content.authorName(selected))}
          >
            {spokes.map(({ other, relation, x, y }) => {
              const def = RELATION_DEFS.find((d) => d.id === relation.type)!;
              const color = RELATION_COLORS[relation.type];
              // arrow keeps the relation's canonical direction: it sits near
              // the canonical target's end of the spoke
              const towardOther = relation.targetId === other.id;
              const tArrow = towardOther ? 0.78 : 0.26;
              const ux = x - CX;
              const uy = y - CY;
              const len = Math.hypot(ux, uy) || 1;
              // unit vector along the canonical source→target direction
              const dirX = (ux / len) * (towardOther ? 1 : -1);
              const dirY = (uy / len) * (towardOther ? 1 : -1);
              const ax = CX + ux * tArrow;
              const ay = CY + uy * tArrow;
              const s = 7;
              const tip = [ax + dirX * s, ay + dirY * s];
              const baseX = ax - dirX * s * 0.6;
              const baseY = ay - dirY * s * 0.6;
              const arrow = `${tip[0]},${tip[1]} ${baseX - dirY * s * 0.62},${
                baseY + dirX * s * 0.62
              } ${baseX + dirY * s * 0.62},${baseY - dirX * s * 0.62}`;
              const tLabel = labelT.get(relation.id) ?? 0.5;
              const parties =
                def.direction === "directed"
                  ? `${content.authorName(towardOther ? selected : other)} → ${content.authorName(towardOther ? other : selected)}`
                  : `${content.authorName(selected)} ↔ ${content.authorName(other)}`;
              const typeLabel = relationTypeShort(relation.type, state.locale);
              return (
                <g key={relation.id}>
                  <line
                    x1={CX}
                    y1={CY}
                    x2={x}
                    y2={y}
                    stroke={color}
                    strokeWidth={1.6}
                    strokeDasharray={def.dashed ? "5 4" : undefined}
                    opacity={0.8}
                  />
                  {def.direction === "directed" && <polygon points={arrow} fill={color} />}
                  <text
                    className="fallback-edge-label"
                    x={CX + ux * tLabel}
                    y={CY + uy * tLabel - 6}
                    fill={color}
                    textAnchor="middle"
                  >
                    {typeLabel}
                  </text>
                  {/* generous invisible hit area: click (or Enter) for evidence */}
                  <line
                    x1={CX}
                    y1={CY}
                    x2={x}
                    y2={y}
                    stroke="transparent"
                    strokeWidth={16}
                    className="fallback-edge-hit"
                    aria-label={t.fallbackEdgeAria(parties, typeLabel)}
                    onClick={() => store.set({ pickedRelationId: relation.id })}
                    {...pressable(
                      () => store.set({ pickedRelationId: relation.id }),
                      ".fallback-ego .fallback-edge-hit"
                    )}
                  />
                </g>
              );
            })}

            {spokes.map(({ other, x, y }) => (
              <g
                key={other.id}
                className="fallback-node"
                aria-label={t.fallbackNodeAria(content.authorName(other))}
                onClick={() => store.selectAuthor(other.id)}
                {...pressable(() => store.selectAuthor(other.id), ".fallback-ego .fallback-node")}
              >
                <circle cx={x} cy={y} r={9} />
                <text x={x} y={y + 24} textAnchor="middle">
                  {content.authorName(other)}
                </text>
              </g>
            ))}

            <g
              className="fallback-node fallback-node--center"
              aria-label={t.fallbackCenterAria(content.authorName(selected))}
              onClick={() => store.selectAuthor(selected.id)}
              {...pressable(() => store.selectAuthor(selected.id), ".fallback-ego .fallback-node")}
            >
              <circle cx={CX} cy={CY} r={13} />
              <text x={CX} y={CY + 30} textAnchor="middle">
                {content.authorName(selected)}
              </text>
            </g>
          </svg>
        </>
      )}
    </div>
  );
}
