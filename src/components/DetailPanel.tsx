import { useMemo } from "react";
import { useAppState, useServices } from "./ctx.ts";
import { neighborsOf } from "../lib/graph.ts";
import type { Relation, RelationType } from "../types.ts";
import { RELATION_DEFS } from "../types.ts";
import {
  AuthorLink,
  DifficultyDots,
  EvidenceBadge,
  ReviewBadge,
  languageLabel,
  lifeSpan,
  regionLabel,
  relationLabel
} from "./bits.tsx";

export function DetailPanel() {
  const state = useAppState();
  const services = useServices();
  const { store, dataset, worksByAuthor, adjacency } = services;

  const author = useMemo(
    () => dataset.authors.find((a) => a.id === state.selectedAuthorId) ?? null,
    [dataset, state.selectedAuthorId]
  );

  const works = author ? worksByAuthor.get(author.id) ?? [] : [];
  const workById = useMemo(() => new Map(works.map((w) => [w.id, w])), [works]);
  const neighbors = author ? neighborsOf(adjacency, author.id) : [];
  const sourceById = useMemo(
    () => new Map(dataset.sources.map((s) => [s.id, s])),
    [dataset.sources]
  );
  const movementById = useMemo(
    () => new Map(dataset.movements.map((m) => [m.id, m])),
    [dataset.movements]
  );

  if (!author) return null;

  const byType = new Map<RelationType, Array<{ otherId: string; relation: Relation }>>();
  for (const n of neighbors) {
    const list = byType.get(n.relation.type) ?? [];
    list.push(n);
    byType.set(n.relation.type, list);
  }

  const entryWork = workById.get(author.readingEntry);

  return (
    <section className="detail-panel" aria-label={`${author.names.ko} 상세 정보`}>
      <div className="detail-head">
        <div>
          <h2 className="detail-name">{author.names.ko}</h2>
          <p className="detail-original">
            {author.names.original}
            {author.names.aliases.length > 0 && (
              <span className="detail-aliases"> · {author.names.aliases.join(" · ")}</span>
            )}
          </p>
          <p className="detail-life">
            {lifeSpan(author)} · 활동 {author.activeRange[0]}–{author.activeRange[1]} ·{" "}
            {author.regions.map(regionLabel).join(", ")} ·{" "}
            {author.languages.map(languageLabel).join(", ")}
          </p>
          <p className="detail-tags">
            {author.movements.map((m) => {
              const mv = movementById.get(m);
              return mv ? (
                <button
                  key={m}
                  type="button"
                  className="chip chip--sm"
                  title={mv.description}
                  onClick={() => store.setFilters({ movements: [m] })}
                >
                  {mv.ko}
                </button>
              ) : null;
            })}
            {author.speculative && <span className="chip chip--sm is-static">사변·SF</span>}
          </p>
        </div>
        <button
          type="button"
          className="icon-btn detail-close"
          aria-label="상세 패널 닫기"
          onClick={() => store.selectAuthor(null)}
        >
          ✕
        </button>
      </div>

      <div className="detail-body">
        <h3>왜 중요한가</h3>
        <p>{author.importanceReason}</p>

        <h3>어디서부터 읽을까</h3>
        {entryWork && (
          <p className="entry-work">
            <strong>{entryWork.titleKo}</strong>
            <span className="work-meta">
              {" "}
              ({entryWork.titleOriginal}, {entryWork.year})
            </span>
            <br />
            {author.readingEntryReason}
          </p>
        )}
        <ol className="reading-order">
          {author.readingOrder.map((wid) => {
            const w = workById.get(wid);
            return w ? (
              <li key={wid}>
                {w.titleKo} <span className="work-meta">({w.year})</span>
              </li>
            ) : null;
          })}
        </ol>
        {author.readingWarning && (
          <p className="reading-warning" role="note">
            {author.readingWarning}
          </p>
        )}
        <p className="difficulty-row">
          독서 난도 <DifficultyDots value={author.difficulty} />
          <span className="difficulty-reason">{author.difficultyReason}</span>
        </p>

        <h3>대표작</h3>
        <ul className="work-list">
          {works.map((w) => (
            <li key={w.id}>
              <strong>{w.titleKo}</strong>
              <span className="work-meta">
                {" "}
                {w.titleOriginal} · {w.year}
              </span>
              <p>{w.significance}</p>
            </li>
          ))}
        </ul>
        {author.worksException && (
          <p className="works-exception">{author.worksException}</p>
        )}

        <h3>관계</h3>
        {neighbors.length === 0 && (
          <p className="empty-note">
            아직 기록된 관계가 없습니다. 관계 데이터는 단계적으로 채워지고 있습니다.
          </p>
        )}
        {RELATION_DEFS.filter((d) => byType.has(d.id)).map((def) => (
          <div key={def.id} className="relation-group">
            <h4>{relationLabel(def.id)}</h4>
            <ul>
              {(byType.get(def.id) ?? []).map(({ otherId, relation }) => (
                <li key={relation.id} className="relation-item">
                  <div className="relation-line">
                    {relation.direction === "directed" ? (
                      relation.sourceId === author.id ? (
                        <span className="rel-dir">→ 영향을 준 작가</span>
                      ) : (
                        <span className="rel-dir">← 영향을 받은 원천</span>
                      )
                    ) : (
                      <span className="rel-dir">↔</span>
                    )}
                    <AuthorLink id={otherId} />
                    <EvidenceBadge level={relation.evidenceLevel} />
                  </div>
                  <p className="relation-summary">{relation.summary}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <h3>근거 출처</h3>
        <ul className="source-list">
          {author.sourceIds.map((sid) => {
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
                <span className="work-meta"> — {s.publisherOrInstitution}</span>
              </li>
            ) : null;
          })}
        </ul>

        <p className="detail-review">
          <ReviewBadge author={author} />
        </p>

        <div className="detail-actions">
          <button
            type="button"
            onClick={() => store.set({ comparePicking: true, compareAuthorId: null })}
          >
            다른 작가와 비교
          </button>
          <button
            type="button"
            onClick={() => services.globeRef.current?.focusAuthor(author.id)}
          >
            지도 중앙으로
          </button>
        </div>
      </div>
    </section>
  );
}
