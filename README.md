# 하나의 책

> **모든 책을 품은 하나의 책.**

세계문학 작가 1,800여 인과 작품 3,900여 편, 22 권역. 도판 100인이 검토된 큐레이션이고,
나머지는 한 문장을 가진 스케치와 이름·자리만 아는 실루엣이다 — 검토되지 않은 쪽은
검색엔진에 제출하지 않는다. 전부 정적 HTML 이고 정확한 수는 빌드가 찍는다.

읽은 것이 다음 것을 연다. 첫 장은 묻지 않고 한 쪽을 열어 두고, 표시가 쌓이면 그것이
그래프에 불을 켜 다음 쪽을 고른다. 독자의 표시는 브라우저에 있고, 원하면 이메일 하나로
기기 사이에 동기화된다. 추적도, 광고도, 제3자 요청도, 런타임 LLM 호출도 없다.

- 지침 `CLAUDE.md` · 제품 `docs/one-book.md` · 게이트 `docs/one-sentence-contract.md`
- 이력 `docs/history.md` · QC 기록 `docs/qc-sketch-wave.md` · 백엔드 `docs/backend-design.md`

2026-08-31 에 [Noosphere](https://github.com/damienmusica/Noosphere) 에서 분가했다.
두 레포는 코드를 공유하지 않고, 엔티티 동일성의 조인 키는 Wikidata QID 다.

## 실행

```bash
npm install
npm run build        # validate:data → dist/
npm run serve        # dist/ 를 띄운다
npm run release      # typecheck · test · build · 브라우저 계약
```

번들러는 없다. `scripts/generate-static-pages.ts` 가 제품의 전부다.
`npm run verify:book` 은 DOM 노드가 아니라 **그려진 글자**를 잰다 — 접힌 것은 세지 않는다.

## 구조

```
data/        큐레이션 원장 — 작가·작품·관계·출처·판본·배차
src/         스키마(Zod) · 조립 · 관계 표기
scripts/     정적 생성기 · 검증 · 인제스트 · 폰트
public/      엔진(atlas.js·book.js) · 폰트 · 실물 자산
qa/          정적 서버 + 브라우저 계약
tests/       단위 계약
```
