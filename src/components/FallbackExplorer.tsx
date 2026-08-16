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
 */
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
          </div>
          <svg
            className="fallback-ego"
            viewBox={`0 0 ${W} ${H}`}
            role="img"
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
                    x={CX + ux * 0.5}
                    y={CY + uy * 0.5 - 6}
                    fill={color}
                    textAnchor="middle"
                  >
                    {relationTypeShort(relation.type, state.locale)}
                  </text>
                  {/* generous invisible hit area: click a line to read its evidence */}
                  <line
                    x1={CX}
                    y1={CY}
                    x2={x}
                    y2={y}
                    stroke="transparent"
                    strokeWidth={16}
                    className="fallback-edge-hit"
                    onClick={() => store.set({ pickedRelationId: relation.id })}
                  />
                </g>
              );
            })}

            {spokes.map(({ other, x, y }) => (
              <g
                key={other.id}
                className="fallback-node"
                onClick={() => store.selectAuthor(other.id)}
              >
                <circle cx={x} cy={y} r={9} />
                <text x={x} y={y + 24} textAnchor="middle">
                  {content.authorName(other)}
                </text>
              </g>
            ))}

            <g
              className="fallback-node fallback-node--center"
              onClick={() => store.selectAuthor(selected.id)}
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
