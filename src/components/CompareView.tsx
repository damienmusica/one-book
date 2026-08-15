import { useMemo } from "react";
import { useAppState, useServices } from "./ctx.ts";
import { shortestPath } from "../lib/graph.ts";
import type { Author } from "../types.ts";
import {
  AuthorLink,
  DifficultyDots,
  EvidenceBadge,
  languageLabel,
  lifeSpan,
  regionLabel,
  relationShort
} from "./bits.tsx";

function CompareColumn({ author }: { author: Author }) {
  const { worksByAuthor, dataset } = useServices();
  const works = worksByAuthor.get(author.id) ?? [];
  const movementById = new Map(dataset.movements.map((m) => [m.id, m]));
  const entry = works.find((w) => w.id === author.readingEntry);
  return (
    <div className="compare-col">
      <h3>{author.names.ko}</h3>
      <p className="detail-original">{author.names.original}</p>
      <p className="detail-life">
        {lifeSpan(author)} · {author.regions.map(regionLabel).join(", ")} ·{" "}
        {author.languages.map(languageLabel).join(", ")}
      </p>
      <p className="detail-tags">
        {author.movements.map((m) => (
          <span key={m} className="chip chip--sm is-static">
            {movementById.get(m)?.ko ?? m}
          </span>
        ))}
      </p>
      <h4>왜 중요한가</h4>
      <p>{author.importanceReason}</p>
      <h4>입문작</h4>
      {entry && (
        <p>
          <strong>{entry.titleKo}</strong>
          <span className="work-meta"> ({entry.year})</span> — {author.readingEntryReason}
        </p>
      )}
      <h4>대표작</h4>
      <ul className="work-list--compact">
        {works.slice(0, 4).map((w) => (
          <li key={w.id}>
            {w.titleKo} <span className="work-meta">({w.year})</span>
          </li>
        ))}
      </ul>
      <p className="difficulty-row">
        난도 <DifficultyDots value={author.difficulty} />
      </p>
    </div>
  );
}

export function CompareView() {
  const state = useAppState();
  const { store, dataset, adjacency } = useServices();

  const a = dataset.authors.find((x) => x.id === state.selectedAuthorId);
  const b = dataset.authors.find((x) => x.id === state.compareAuthorId);

  const path = useMemo(() => {
    if (!a || !b) return null;
    return shortestPath(adjacency, a.id, b.id);
  }, [a, b, adjacency]);

  if (!a || !b) return null;

  const direct = dataset.relations.filter(
    (r) =>
      (r.sourceId === a.id && r.targetId === b.id) ||
      (r.sourceId === b.id && r.targetId === a.id)
  );

  // walk the path to render A → X → … → B with each hop's relation
  const hops: Array<{ fromId: string; toId: string; label: string; evidence: string }> = [];
  if (path) {
    let cur = a.id;
    for (const rel of path) {
      const next = rel.sourceId === cur ? rel.targetId : rel.sourceId;
      hops.push({
        fromId: cur,
        toId: next,
        label: relationShort(rel.type),
        evidence: rel.evidenceLevel
      });
      cur = next;
    }
  }

  return (
    <div className="compare-view" role="dialog" aria-modal="true" aria-label="작가 비교">
      <div className="compare-head">
        <h2>
          {a.names.ko} · {b.names.ko} 비교
        </h2>
        <button
          type="button"
          className="icon-btn"
          aria-label="비교 닫기"
          onClick={() => store.set({ compareAuthorId: null })}
        >
          ✕
        </button>
      </div>

      <div className="compare-grid">
        <CompareColumn author={a} />
        <CompareColumn author={b} />
      </div>

      <div className="compare-links">
        <h4>두 작가 사이의 기록된 관계</h4>
        {direct.length > 0 ? (
          <ul>
            {direct.map((r) => (
              <li key={r.id} className="relation-item">
                <div className="relation-line">
                  <span>{relationShort(r.type)}</span>
                  <EvidenceBadge level={r.evidenceLevel} />
                </div>
                <p className="relation-summary">{r.summary}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-note">직접 기록된 관계는 없습니다.</p>
        )}

        <h4>최단 관계 경로</h4>
        {hops.length > 0 ? (
          <p className="compare-path">
            {hops.map((h, i) => (
              <span key={i}>
                {i === 0 && <AuthorLink id={h.fromId} />}
                <span className="path-hop"> —{h.label}→ </span>
                <AuthorLink id={h.toId} />
              </span>
            ))}
          </p>
        ) : (
          <p className="empty-note">현재 데이터에서 두 작가를 잇는 경로가 없습니다.</p>
        )}
      </div>
    </div>
  );
}
