import { useMemo } from "react";
import { useAppState, useContent, useServices, useT } from "./ctx.ts";
import { relationTypeLabel } from "../i18n/index.ts";
import { AuthorLink, EvidenceBadge } from "./bits.tsx";

export function RelationDialog() {
  const state = useAppState();
  const { store, relationById, dataset } = useServices();
  const t = useT();
  const content = useContent();
  const relation = state.pickedRelationId
    ? relationById.get(state.pickedRelationId)
    : undefined;
  const sourceById = useMemo(
    () => new Map(dataset.sources.map((s) => [s.id, s])),
    [dataset.sources]
  );

  if (!relation) return null;

  return (
    <div
      className="relation-dialog"
      role="dialog"
      aria-modal="false"
      aria-label={t.relationDialogAria}
    >
      <div className="relation-dialog-head">
        <span className="relation-type">{relationTypeLabel(relation.type, state.locale)}</span>
        <button
          type="button"
          className="icon-btn"
          aria-label={t.close}
          onClick={() => store.set({ pickedRelationId: null })}
        >
          ✕
        </button>
      </div>
      <p className="relation-parties">
        <AuthorLink id={relation.sourceId} />
        <span aria-hidden="true">
          {relation.direction === "directed" ? " → " : " ↔ "}
        </span>
        <AuthorLink id={relation.targetId} />
      </p>
      <p className="relation-summary">{content.relationSummary(relation)}</p>
      <p className="relation-evidence">
        <EvidenceBadge level={relation.evidenceLevel} />
        <span className="evidence-explain">{t.evidenceExplain[relation.evidenceLevel]}</span>
      </p>
      {/* weight is an editorial band value (relations-guide §1), not a
          measurement — present it as a tier, never as a percentage */}
      <p className="relation-weight" title={t.weightTitle}>
        {t.weightTier(relation.weight >= 0.7 ? "strong" : relation.weight >= 0.5 ? "medium" : "light")}
      </p>
      {relation.sourceIds.length > 0 && (
        <ul className="source-list">
          {relation.sourceIds.map((sid) => {
            const s = sourceById.get(sid);
            return s ? (
              <li key={sid}>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer noopener">
                    {s.title}
                  </a>
                ) : (
                  s.title
                )}
                {s.citation && <span className="work-meta"> — {s.citation}</span>}
              </li>
            ) : null;
          })}
        </ul>
      )}
    </div>
  );
}
