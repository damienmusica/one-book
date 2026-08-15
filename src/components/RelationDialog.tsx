import { useMemo } from "react";
import { useAppState, useServices } from "./ctx.ts";
import { AuthorLink, EvidenceBadge, relationLabel } from "./bits.tsx";
import { EVIDENCE_LEVEL_KO } from "../types.ts";

const LEVEL_EXPLANATION: Record<string, string> = {
  documented: "서신·인터뷰·번역·회고록 같은 1차 기록으로 확인되는 관계입니다.",
  scholarly_consensus: "신뢰할 만한 2차 연구가 반복적으로 다뤄 온 계보입니다.",
  editorial_inference:
    "직접 접촉의 기록은 없습니다. 형식·주제의 친연성을 근거로 이 지도가 가까이 놓은, 편집적 판단이 포함된 관계입니다."
};

export function RelationDialog() {
  const state = useAppState();
  const { store, relationById, dataset } = useServices();
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
      aria-label="관계 설명"
    >
      <div className="relation-dialog-head">
        <span className="relation-type">{relationLabel(relation.type)}</span>
        <button
          type="button"
          className="icon-btn"
          aria-label="닫기"
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
      <p className="relation-summary">{relation.summary}</p>
      <p className="relation-evidence">
        <EvidenceBadge level={relation.evidenceLevel} />
        <span className="evidence-explain">
          {LEVEL_EXPLANATION[relation.evidenceLevel] ?? EVIDENCE_LEVEL_KO[relation.evidenceLevel]}
        </span>
      </p>
      <p className="relation-weight">
        관계 강도 {(relation.weight * 100).toFixed(0)}%
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
