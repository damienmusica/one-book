// 관계 인과성 — 선은 "왜 그어졌는가"를 말해야 한다 (R12, 외부 검토 2차 회신).
//
// /data 의 관계 263건은 전부 `summary`(왜 연결했는가) · `evidenceLevel` ·
// `direction` · `sourceIds` 를 갖는데, R11-e 까지의 성계는 그중 어느 것도 화면에
// 내지 않았다 — 선은 방향 없는 단색 선분이었고 카드는 유형 태그와 이름뿐이었다.
// `lenses.ts` 는 선마다 relationId 를 붙이며 "클릭하면 증거로 간다"고 적어 두고,
// 씬은 그것을 읽지 않았다. 설계에 있었고 구현에서 끊긴 자리가 여기다.
//
// 이 모듈은 그 셋을 독자의 말로 바꾼다: 방향 글리프(→ ← ↔), 근거 등급의 한국어
// 이름, 카드의 정렬, 하늘 캡션의 한 문장. 렌더는 카드(OrbitCard)와 씬(화살촉 ·
// 호버 캡션)이 하고, 규칙은 여기 한 곳에만 있다.

import type { EvidenceLevel, Relation, RelationType } from "../types.ts";

export const REL_KO: Record<RelationType, string> = {
  documented_influence: "영향",
  translation: "번역",
  mentorship: "사사",
  dialogue: "대화",
  affinity: "친연",
  contrast: "대비"
};

/** 근거 등급 — 코드 값(`scholarly_consensus`)을 독자에게 내보이지 않는다 */
export const EVIDENCE_KO: Record<EvidenceLevel, string> = {
  documented: "문헌 기록",
  scholarly_consensus: "학계 통설",
  editorial_inference: "편집 추론"
};

/** 강한 근거가 먼저 — 카드의 관계 목록과 추천의 정렬에 쓴다 */
export const EVIDENCE_RANK: Record<EvidenceLevel, number> = {
  documented: 3,
  scholarly_consensus: 2,
  editorial_inference: 1
};

export type RelationGlyph = "→" | "←" | "↔";

/**
 * 선택한 별(`selfId`)에서 본 관계의 방향.
 *   → : 내가 출발점 (내가 상대에게 영향을 주었다 / 상대를 번역했다 …)
 *   ← : 상대가 출발점 (상대가 나에게 …)
 *   ↔ : 방향 없는 관계(친연·대비 같은 상호 관계)
 * 방향이 없는 관계에 화살표를 붙이면 데이터에 없는 인과를 약속하게 된다.
 */
export function relationGlyph(rel: Pick<Relation, "sourceId" | "targetId" | "direction">, selfId: string): RelationGlyph {
  if (rel.direction === "bidirectional") return "↔";
  return rel.sourceId === selfId ? "→" : "←";
}

/** 방향 있는 관계만 화살촉을 갖는다 — 화살촉의 존재 자체가 "방향 주장"이다 */
export function isDirected(rel: Pick<Relation, "direction">): boolean {
  return rel.direction === "directed";
}

/** 카드의 관계 목록 정렬: 근거 등급 → 가중치 → id (결정적) */
export function sortRelations<T extends { rel: Relation }>(rows: T[]): T[] {
  return [...rows].sort((x, y) => {
    const e = EVIDENCE_RANK[y.rel.evidenceLevel] - EVIDENCE_RANK[x.rel.evidenceLevel];
    if (e) return e;
    const w = y.rel.weight - x.rel.weight;
    if (w) return w;
    return x.rel.id < y.rel.id ? -1 : x.rel.id > y.rel.id ? 1 : 0;
  });
}

/**
 * 하늘 캡션의 한 문장 — 선택한 별에서 이웃 별에 마우스를 올리면 그 선이 왜
 * 그어졌는지가 무대에 적힌다. 형식은 "출발 → 도착 · 유형 · 근거 — 요약".
 * 방향 없는 관계는 "A ↔ B".
 */
export function relationCaption(
  rel: Relation,
  selfId: string,
  nameOf: (id: string) => string
): string {
  const glyph = relationGlyph(rel, selfId);
  const self = nameOf(selfId);
  const other = nameOf(rel.sourceId === selfId ? rel.targetId : rel.sourceId);
  const head =
    glyph === "↔" ? `${self} ↔ ${other}` : glyph === "→" ? `${self} → ${other}` : `${other} → ${self}`;
  return `${head} · ${REL_KO[rel.type] ?? rel.type} · ${EVIDENCE_KO[rel.evidenceLevel] ?? rel.evidenceLevel} — ${rel.summary}`;
}

/**
 * 앵커 칩 (R12) — 관계 요약이 지목한 책·연도를 카드의 관계 행에 짧게 적는다.
 * "『변신』 1947" · "1913" · "『성』". 착륙 뒤 실이 어느 책에 닿을지를 카드가 먼저
 * 약속하는 자리다. 제목을 모르는 작품 id 는 칩이 되지 않는다(거짓 제목 금지).
 */
export function anchorChips(
  rel: Pick<Relation, "anchors">,
  titleOf: (workId: string) => string | undefined
): string[] {
  const out: string[] = [];
  for (const a of rel.anchors ?? []) {
    const title = a.workId ? titleOf(a.workId) : undefined;
    if (a.workId && !title) continue;
    const parts = [title ? `『${title}』` : "", a.year ? String(a.year) : ""].filter(Boolean);
    if (parts.length) out.push(parts.join(" "));
  }
  return out;
}
