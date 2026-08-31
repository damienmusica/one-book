// 착륙지 준비도 — **자산 파일의 존재가 아니라 명시적 검증 상태** (R11-c).
//
// 첫 구현은 `art.grounds[id]` 유무로 착륙을 열었다. 그것은 "파일이 있으면
// 준비된 것"이라는 추론이고, 준비도는 추론이 아니라 편집 판단이다 — 지면
// 자산이 있어도 표면에서 읽히는 문구가 검수되지 않았으면 착륙지가 아니다.

import raw from "../../data/depth-readiness.json";

export type ReadinessState = "ready" | "in-progress" | "not-started";

export interface ReadinessEntry {
  authorId: string;
  state: ReadinessState;
  met: string[];
  verifiedAt: string;
  verifiedBy: string;
  /** 검수가 읽은 표면의 시각 — 표면 코드가 이 뒤에 바뀌면 검수는 낡은 것이다 */
  surfaceVerifiedAt?: string;
  note: string;
}

export interface ReadinessFile {
  version: number;
  note: string;
  criteria: Record<string, string>;
  states: Record<string, string>;
  default: ReadinessState;
  entries: ReadinessEntry[];
}

export const READINESS = raw as ReadinessFile;

const byId = new Map(READINESS.entries.map((e) => [e.authorId, e]));

export function readinessOf(authorId: string): ReadinessEntry | null {
  return byId.get(authorId) ?? null;
}

export function readinessState(authorId: string): ReadinessState {
  return byId.get(authorId)?.state ?? READINESS.default;
}

/** 착륙은 **검수된 ready** 에만 열린다 */
export function isLandable(authorId: string): boolean {
  return readinessState(authorId) === "ready";
}

export const READY_IDS: ReadonlySet<string> = new Set(
  READINESS.entries.filter((e) => e.state === "ready").map((e) => e.authorId)
);

// --- 검수 신선도 -------------------------------------------------------------
//
// `surfaceVerifiedAt` 의 규칙("표면 코드가 이 뒤에 바뀌면 검수는 낡은 것이다")은
// 2026-08-28 까지 위 타입 주석에만 있었다 — 스탬프는 2026-08-21 인 채로 표면
// 코드에 커밋 10건이 쌓였고, 어느 게이트도 그것을 보지 않았다. 상태 단언은
// 화면을 보지 않는다(§⑫)의 원장 판본이다. 아래 함수가 그 규칙의 집행이고,
// 게이트는 tests/readiness-freshness.test.ts 가 든다: ready 항목의 스탬프가
// 표면 코드의 마지막 변경보다 오래되면 npm test 가 빨갛다. 스탬프를 갱신하는
// 유일한 정당한 경로는 표면을 다시 검수하는 것이다.

export type SurfaceStaleReason = "no-stamp" | "bad-stamp" | "stale";

export interface StaleSurfaceVerification {
  authorId: string;
  reason: SurfaceStaleReason;
  surfaceVerifiedAt?: string;
}

/**
 * ready 항목 중 표면 검수가 낡은 것을 돌려준다. 순수 함수 — 표면 코드의 마지막
 * 변경 시각은 호출자가 잰다(게이트에서는 git 이 정본).
 */
export function staleSurfaceVerifications(
  entries: readonly ReadinessEntry[],
  latestSurfaceChangeAt: Date
): StaleSurfaceVerification[] {
  const out: StaleSurfaceVerification[] = [];
  for (const e of entries) {
    if (e.state !== "ready") continue;
    if (!e.surfaceVerifiedAt) {
      out.push({ authorId: e.authorId, reason: "no-stamp" });
      continue;
    }
    const stamp = new Date(e.surfaceVerifiedAt);
    if (Number.isNaN(stamp.getTime())) {
      out.push({ authorId: e.authorId, reason: "bad-stamp", surfaceVerifiedAt: e.surfaceVerifiedAt });
      continue;
    }
    if (stamp.getTime() < latestSurfaceChangeAt.getTime()) {
      out.push({ authorId: e.authorId, reason: "stale", surfaceVerifiedAt: e.surfaceVerifiedAt });
    }
  }
  return out;
}

/**
 * 실물 기록(여는 문장·집필 시기·초판 서지·유고 경위)을 이 작품 쪽에 세울 것인가.
 *
 * 두 조건이 **모두** 있어야 한다: 그 작품에 실물 데이터가 있고, 그 작가가
 * 준비도 사다리에서 검수를 통과했을 것. 데이터 유무만으로 게이트하면 사다리가
 * 표면을 지배하지 못하고, 그 순간 검수 신선도 계약이 아무것도 재지 않는
 * 계약이 된다(2026-08-31 변이 스윕이 이 자리를 SURVIVED 로 잡았다).
 */
export function showsPhysicalRecord(work: { authorId: string; world?: unknown }): boolean {
  return Boolean(work.world) && READY_IDS.has(work.authorId);
}
