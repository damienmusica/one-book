#!/usr/bin/env bash
# 배포는 이 한 줄로만 한다: bash scripts/deploy.sh
#
# 왜 스크립트인가: 로컬 계약이 초록이라는 이유로 CI 가 빨간 커밋을 두 번 배포했다(2026-09-23). "체크가 없다"도,
# "로컬은 초록"도 초록이 아니다. 여기서는 푸시된 HEAD 의 CI 가 success 일 때만, **그 CI 가 짓고 계약으로 잰 dist 를
# 그대로** 올린다 — 로컬에서 다시 지으면 커밋되지 않은 파일이 따라 올라갈 수 있었다(2026-09-24 감사). 올린 뒤에는
# 상태 코드가 아니라 내용으로 확인한다: 라이브의 /build.txt 가 이 커밋이어야 한다.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "작업 트리가 깨끗하지 않다 — 커밋되지 않은 것을 배포하지 않는다" >&2; exit 1; }
HEAD=$(git rev-parse HEAD)
git fetch -q origin main
[ "$(git rev-parse origin/main)" = "$HEAD" ] || { echo "HEAD 가 origin/main 과 다르다 — 먼저 푸시한다" >&2; exit 1; }
echo "CI 를 기다린다: ${HEAD:0:7}"
run=""
for _ in $(seq 1 60); do
  line=$(gh run list --commit "$HEAD" --workflow CI --event push --json databaseId,status,conclusion -q '.[0] | "\(.databaseId) \(.status) \(.conclusion)"' 2>/dev/null || true)
  case "$line" in
    *" completed success") run=${line%% *}; echo "CI 초록 (run $run)"; break ;;
    *" completed "*) echo "CI 가 초록이 아니다: $line — 배포하지 않는다" >&2; exit 1 ;;
    *) sleep 20 ;;
  esac
done
[ -n "$run" ] || { echo "CI 결과가 오지 않았다 — 등록 경쟁이거나 멈췄다. 배포하지 않는다" >&2; exit 1; }
out=$(mktemp -d)
trap 'rm -rf "$out"' EXIT
gh run download "$run" -n dist -D "$out"
[ "$(head -1 "$out/build.txt")" = "$HEAD" ] || { echo "CI 산출물이 이 커밋의 것이 아니다" >&2; exit 1; }
npx wrangler pages deploy "$out" --project-name=literary-planet --branch=main --commit-hash="$HEAD" --commit-dirty=true
for _ in $(seq 1 12); do
  got=$(curl -s "https://literary-planet.pages.dev/build.txt?v=$(date +%s)" | head -1)
  [ "$got" = "$HEAD" ] && { echo "라이브 확인: ${HEAD:0:7}"; exit 0; }
  sleep 10
done
echo "라이브가 이 커밋이 아니다 (기대 ${HEAD:0:7}, 실제 ${got:-없음})" >&2; exit 1
