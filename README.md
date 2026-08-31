# 하나의 책

> **모든 책을 품은 하나의 책.**

20세기 세계문학 작가 100인 · 작품 513편 · 관계 263건 · 출처 239건. 전부 검토된
큐레이션이고, 전부 **정적 HTML 616쪽**이다. 계정도, 데이터베이스도, 추적도,
광고도, 런타임 LLM 호출도 없다.

정체성과 경계는 [docs/one-book.md](docs/one-book.md), 상급 게이트와 손 떼기
조건은 [docs/one-sentence-contract.md](docs/one-sentence-contract.md).

## 실행

```bash
cd literary-planet
npm install
npm run build      # validate:data → 정적 616쪽을 dist/ 에 굽는다
npm run serve      # dist/ 를 띄운다
```

번들러는 없다. 2026-08-31 철거(결정 (132))로 3D 성계·2D 성좌도·React·three.js가
전부 은퇴했고, 제품은 생성기 하나가 굽는 정적 HTML이 됐다.
`scripts/generate-static-pages.ts` 가 제품의 전부다.

## 게이트

```bash
npm run typecheck
npm run test           # 유닛 계약
npm run build
npm run verify:book    # 브라우저 계약 — 그려진 글자를 잰다
npm run release        # 위 넷을 순서대로

python3 ../scripts/book-mutation-sweep.py --browser   # 계약에 이빨이 있는가 (유지보수자용)
```

`verify:book` 이 재는 것은 DOM 노드가 아니라 **그려진 글자**(innerText)다.
접힌 `<details>` 는 세지 않는다 — 접혔으니까. 이 규율은 값을 치르고 얻었다:
상태 단언이 픽셀을 증명하지 못한 자리를 다섯 번 겪었고, 마지막 한 번은 배포된
작가 페이지 100/100 이 정보 폭탄이던 것을 아무도 재지 않은 일이었다.

## 구조

```
data/            큐레이션 원장 — 작가·작품·관계·출처·판본
src/book/        관계 표기 · 준비도 사다리
src/data/        조립 + 검증 (Zod)
scripts/         정적 생성기 · 데이터 검증 · 리포트
qa/              정적 서버 + 브라우저 계약
assets/          권리 처리된 서명 원본 + 프로비넌스 (staging)
public/          배포되는 실물 자산 (초상·육필·표지)
```

## 하드 제약

계정·로그인 없음 · 서버 데이터베이스 없음(JSON 파일만) · 결제 없음 · 광고 없음 ·
사용자 생성 콘텐츠 없음 · 스크래핑 없음 · 레포와 환경에 비밀키/API 키 없음 ·
제품 런타임·빌드·CI에 클라우드 LLM 호출 없음. 개인 상태는 방문자 브라우저의
`localStorage` 에만 남고 전송되지 않는다.

**지어내지 않는다 — 없는 것은 없다고 적는다.** 판본 원장이 비어 있으면 페이지는
판본을 주장하지 않고, 검수하지 않았다는 사실을 날짜와 함께 적는다.
