#!/usr/bin/env bash
# 배포는 이 한 줄로만 한다: bash scripts/deploy.sh
#
# 왜 스크립트인가: 로컬 계약이 초록이라는 이유로 CI 가 빨간 커밋을 두 번 배포했다(2026-09-23). "체크가 없다"도,
# "로컬은 초록"도 초록이 아니다. 여기서는 푸시된 HEAD 의 CI 가 success 일 때만 올리고, 올린 뒤에는 상태 코드가
# 아니라 내용으로 확인한다(Pages 는 없는 경로에도 index.html 을 200 으로 준다).
set -euo pipefail
cd "$(dirname "$0")/.."
[ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "작업 트리가 깨끗하지 않다 — 커밋되지 않은 것을 배포하지 않는다" >&2; exit 1; }
HEAD=$(git rev-parse HEAD)
git fetch -q origin main
[ "$(git rev-parse origin/main)" = "$HEAD" ] || { echo "HEAD 가 origin/main 과 다르다 — 먼저 푸시한다" >&2; exit 1; }
echo "CI 를 기다린다: ${HEAD:0:7}"
for _ in $(seq 1 60); do
  line=$(gh run list --commit "$HEAD" --workflow CI --json status,conclusion -q '.[0] | "\(.status) \(.conclusion)"' 2>/dev/null || true)
  case "$line" in
    "completed success") echo "CI 초록"; break ;;
    completed*) echo "CI 가 초록이 아니다: $line — 배포하지 않는다" >&2; exit 1 ;;
    *) sleep 20 ;;
  esac
done
[ "${line:-}" = "completed success" ] || { echo "CI 결과가 오지 않았다 — 등록 경쟁이거나 멈췄다. 배포하지 않는다" >&2; exit 1; }
npm run build
npx wrangler pages deploy dist --project-name=literary-planet --branch=main --commit-dirty=true
# 내용으로 확인: 첫 장의 캡슐 이름(내용 해시)이 방금 지은 것과 같아야 한다
want=$(grep -o '/walk-[0-9a-f]*\.json' dist/index.html | head -1)
for _ in $(seq 1 12); do
  got=$(curl -s "https://literary-planet.pages.dev/?v=$(date +%s)" | grep -o '/walk-[0-9a-f]*\.json' | head -1)
  [ "$got" = "$want" ] && { echo "라이브 확인: $want"; exit 0; }
  sleep 10
done
echo "라이브가 방금 지은 것이 아니다 (기대 $want, 실제 ${got:-없음})" >&2; exit 1
