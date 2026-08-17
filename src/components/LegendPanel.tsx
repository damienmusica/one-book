import { useState } from "react";
import { useAppState, useT } from "./ctx.ts";
import { relationTypeShort } from "../i18n/index.ts";
import { RELATION_COLORS, UNION_COLORS } from "../theme.ts";
import { RELATION_DEFS } from "../types.ts";

/**
 * Always-available compact legend: what the line styles mean, which
 * coordinate system the map is currently showing, and what terrain size
 * encodes. Types the filter drawer has switched off stay listed but dimmed —
 * the legend explains the world, the drawer changes it.
 */
export function LegendPanel() {
  const state = useAppState();
  const t = useT();
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <button type="button" className="legend-chip" onClick={() => setOpen(true)}>
        {t.legendTitle}
      </button>
    );
  }

  return (
    <div className="legend-panel" role="note" aria-label={t.legendTitle}>
      <div className="legend-head">
        <span className="legend-mode">
          {t.legendCoord(state.mode === "semantic" ? t.modeSemantic : t.modeGeo)}
        </span>
        <button
          type="button"
          className="icon-btn legend-close"
          aria-label={t.close}
          onClick={() => setOpen(false)}
        >
          ✕
        </button>
      </div>
      <ul className="legend-types">
        {RELATION_DEFS.map((def) => {
          const on = state.filters.relationTypes.includes(def.id);
          const color = RELATION_COLORS[def.id];
          return (
            <li key={def.id} className={on ? "" : "is-off"} title={on ? undefined : t.legendOff}>
              <svg width="30" height="10" aria-hidden="true">
                <line
                  x1="1"
                  y1="5"
                  x2={def.direction === "directed" ? 22 : 29}
                  y2="5"
                  stroke={color}
                  strokeWidth="1.8"
                  strokeDasharray={def.dashed ? "4 3" : undefined}
                />
                {def.direction === "directed" && (
                  <polygon points="22,1.5 29,5 22,8.5" fill={color} />
                )}
                {def.direction === "bidirectional" && !def.dashed && (
                  <>
                    <polygon points="7,1.5 1,5 7,8.5" fill={color} />
                    <polygon points="23,1.5 29,5 23,8.5" fill={color} />
                  </>
                )}
              </svg>
              <span>{relationTypeShort(def.id, state.locale)}</span>
            </li>
          );
        })}
      </ul>
      <p className="legend-terrain" title={t.legendTerrainTitle}>
        {t.legendTerrain}
      </p>
      <p className="legend-terrain legend-union">
        <svg width="30" height="10" aria-hidden="true" style={{ verticalAlign: "-1px" }}>
          <line x1="1" y1="3" x2="29" y2="3" stroke={UNION_COLORS[0]} strokeWidth="1.6" />
          <line x1="1" y1="7" x2="29" y2="7" stroke={UNION_COLORS[2]} strokeWidth="1.6" />
        </svg>{" "}
        {t.legendUnion}
      </p>
    </div>
  );
}
