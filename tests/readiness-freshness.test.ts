// 검수 신선도 계약 — 규칙을 산문에서 게이트로.
//
// depth-readiness.json 의 `surfaceVerifiedAt` 은 "검수가 읽은 표면의 시각"이고,
// 그 파일 자신의 규칙은 "표면 코드가 이 뒤에 바뀌면 검수는 낡은 것이다"였다.
// 2026-08-28 실측: 스탬프 2026-08-21 인 채 표면 코드 커밋 10건 — 규칙을 읽는
// 코드가 타입 주석 한 줄뿐이라 어느 게이트도 빨갛지 않았다. 이 파일이 그 이빨이다.
//
// 라이브 계약의 "표면 코드" 범위는 2026-08-31 에 재조준됐다. 성계 렌더러가
// 은퇴하면서 실물 자산을 그리는 코드가 전부 정적 생성기로 옮겨졌다 — 옛 범위
// (src/universe)는 이제 존재하지 않는 디렉터리이고, 그대로 두면 이 계약은
// "빈 경로의 마지막 커밋"을 재며 조용히 초록이 된다. 범위 = 표면을 그리는
// 생성기 + 준비도 사다리. (데이터 웨이브도 표면 문구를 바꾸지만 그쪽은 자기
// 웨이브의 검증 규율이 든다 — 여기 섞으면 모든 데이터 커밋이 검수를 무효화해
// 스탬프가 소음이 된다.)
const SURFACE = "scripts/generate-static-pages.ts src/book/readiness.ts";
import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import {
  READINESS,
  staleSurfaceVerifications,
  type ReadinessEntry,
} from "../src/book/readiness";

const entry = (over: Partial<ReadinessEntry>): ReadinessEntry => ({
  authorId: "synthetic",
  state: "ready",
  met: [],
  verifiedAt: "2026-08-21",
  verifiedBy: "synthetic",
  note: "",
  ...over,
});

const T0 = new Date("2026-08-21T15:30+09:00");
const AFTER = new Date("2026-08-25T00:00+09:00");
const BEFORE = new Date("2026-08-20T00:00+09:00");

describe("staleSurfaceVerifications — 규칙 하나당 케이스 하나", () => {
  it("표면이 스탬프 뒤에 바뀌면 발화한다", () => {
    const hits = staleSurfaceVerifications([entry({ surfaceVerifiedAt: T0.toISOString() })], AFTER);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.reason).toBe("stale");
  });

  it("표면이 스탬프보다 오래됐으면 침묵한다", () => {
    expect(
      staleSurfaceVerifications([entry({ surfaceVerifiedAt: T0.toISOString() })], BEFORE)
    ).toHaveLength(0);
  });

  it("ready 인데 스탬프가 없으면 발화한다 — 무스탬프는 신선이 아니라 미검수다", () => {
    const hits = staleSurfaceVerifications([entry({})], BEFORE);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.reason).toBe("no-stamp");
  });

  it("파싱 불가 스탬프는 발화한다 — 읽을 수 없는 시각은 시각이 아니다", () => {
    const hits = staleSurfaceVerifications([entry({ surfaceVerifiedAt: "곧" })], BEFORE);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.reason).toBe("bad-stamp");
  });

  it("ready 가 아닌 항목은 표면 검수 대상이 아니다", () => {
    expect(
      staleSurfaceVerifications([entry({ state: "in-progress" })], AFTER)
    ).toHaveLength(0);
  });
});

describe("라이브 계약 — 이 레포의 스탬프 대 이 레포의 표면 코드", () => {
  it("모든 ready 항목의 검수는 표면 코드의 마지막 변경보다 새것이다", () => {
    // 두 팔 규칙. 기본은 "스탬프 ≥ src/universe 마지막 커밋 시각"인데, 검수
    // 세션은 스탬프를 표면 변경과 **같은 커밋**에 싣는 것이 정당한 경로라서
    // (게이트 재실행 → 스탬프 → 커밋), 커밋 시각이 스탬프를 몇 분 차이로
    // 이기는 거짓 낡음이 생긴다(실측: #204 스쿼시 직후 main 이 이 모양으로
    // 빨갰다). 마지막 src 커밋이 스탬프 파일도 함께 실었다면 그 세션이 그
    // 트리를 보고 찍은 것이므로, 그때는 **직전 src 커밋**과 비교한다 — 스탬프
    // 없이 표면만 실은 커밋은 여전히 첫 팔에 걸린다.
    const git = (cmd: string) => execSync(cmd, { encoding: "utf8" }).trim();
    const lastSrc = git(`git log -1 --format=%H -- ${SURFACE}`);
    const lastStamp = git("git log -1 --format=%H -- data/depth-readiness.json");
    expect(lastSrc, "git 이 표면 코드의 마지막 커밋을 주지 못했다").not.toBe("");
    const iso =
      lastSrc === lastStamp
        ? git(`git log --skip=1 -1 --format=%cI -- ${SURFACE}`)
        : git(`git log -1 --format=%cI -- ${SURFACE}`);
    expect(iso, "비교할 커밋 시각이 없다").not.toBe("");
    const latest = new Date(iso);
    const stale = staleSurfaceVerifications(READINESS.entries, latest);
    expect(
      stale,
      `검수가 낡았다 — 표면(${SURFACE})의 마지막 변경 ${iso} 이 스탬프보다 뒤다. ` +
        `표면을 다시 검수하고(게이트 + 문구 대조) depth-readiness.json 의 surfaceVerifiedAt 을 ` +
        `갱신하는 것이 유일한 정당한 경로다: ${stale.map((s) => `${s.authorId}(${s.reason})`).join(", ")}`
    ).toHaveLength(0);
  });
});
