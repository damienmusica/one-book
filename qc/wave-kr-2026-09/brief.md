# 웨이브 KR-2026-09 — 생성 규칙서 (조회 모드)

「하나의 책」은 한국 독자가 **다음에 읽을 책을 고르게** 돕는 세계문학 지도다. 도판(plate)은 한 작가에 대해
세 가지를 준다: **어디서 시작하나**(입문작과 그 이유, 입문 순서), **누구와 이어지나**(출처 있는 관계), **얼마나 어렵나**.
이 웨이브는 지도에 없던 한국 현대문학과 동시대 작가를 들인다. 슬레이트: `slate.json`.

## 조회 모드 — 기억이 아니라 대조
- 연도·제목·출간 사실·생애 사실·관계를 담은 **모든 문장**은 쓰는 순간 출처를 붙인다: `evidence` 배열에
  `{field, claim, url, quote}` — quote 는 이 세션에서 실제로 가져온 페이지의 원문 그대로(원어), url 은 그 페이지.
- 출처를 못 찾은 사실은 쓰지 않는다. 더 좁은 참인 문장으로 쓴다. 「최초·유일·모든·가장」은 출처가 정확히 그만큼 말할 때만.
- 봇 차단·유료 페이지는 우회하지 않는다(Wayback·Google Books 권내 검색·도서관 목록으로 대신).
- 생존 작가: 보수적으로. 사생활·논란은 쓰지 않는다 — 작품과 공적 경력만. 수상은 공식 발표로 확인.

## 필드 (규율은 `docs/editorial-guide.md` — 먼저 읽는다)
- `importanceReason` 60–450자: 왜 이 사람이 지도에 있는가 — 무엇을 새로 했는가를 구체적으로(평가어 대신 방법).
- `works` 3편 이상: `{id, titleKo, titleOriginal, year, yearBasis?, genre, significance}`.
  - id = `<작가 id>--<원제 로마자 kebab>` (예: `han-kang--chaesikjuuija`, `haruki-murakami--noruwei-no-mori`).
  - titleKo = 한국어판이 실제로 쓰는 제목. year = 첫 출간(단행본 전 연재가 먼저면 연재 해; 사후 출간이면 yearBasis "first-print").
  - significance 30자 이상: 그 책에서 무슨 일이 일어나고 무엇이 새로웠나(한두 문장).
  - 기존 스케치·실루엣 작가는 이미 있는 작품 id 를 그대로 쓴다(`grep -l '"<작가 id>--' data/works/*.json`).
- `readingEntry` = 입문작 id, `readingEntryReason` = 왜 여기서 시작하나(분량·구조·배경지식), `readingOrder` 3–5편, 첫째가 입문작, 난도 오름차순.
  **입문작은 지금 한국어판으로 살 수 있는 책**이어야 한다(한국어 원작이면 그 책 자체).
- `readingWarning`(선택): 어디서 시작하면 안 되나와 그 이유.
- `difficulty` 1–5 정수, `difficultyReason` 무엇이 어려운가.
- `genres`: fiction poetry drama essay-criticism epic history 중에서.
- `sourceIds`: 프로필 출처 1개 이상 — 기존 출처 id(`sources.tsv`) 또는 `newSources` 에 정의한 것.

## 관계 (규율은 `docs/relations-guide.md` — 먼저 읽는다)
- 1개 이상. 상대는 **이미 도판인 작가**(`plates.tsv`) 또는 **이 웨이브의 작가**(`slate.json`).
- 종류·등급: documented_influence(documented|scholarly_consensus) · translation(documented) · mentorship(documented) ·
  dialogue(documented|scholarly_consensus) · affinity/contrast(scholarly_consensus). **editorial_inference 금지.**
- documented 는 근거 문서를 요약에 실명으로 적고 그 문서를 출처 레코드로 낸다. scholarly_consensus 는 "학계가 그렇게 다룬다"를
  말하는 실제 출처(연구서·학술 백과)가 있어야 한다 — 총칭 백과사전 하나로는 안 된다.
- `{type, sourceId, targetId, evidenceLevel, summary, weight(0–1), sourceIds}`. 요약은 한두 문장, 누가 무엇을 읽고/옮기고/썼는지.
- 새 출처: `newSources: [{id:"src--kebab", title, publisherOrInstitution, citation?, url?(https)}]` — 실재하는 문헌만.

## 새 작가의 실루엣 칸 (status "new" 일 때만)
`silhouette: {id, names:{ko, original, aliases:[다른 한국어 표기·로마자]}, birthYear, deathYear?, activeRange:[첫 발표 해, 마지막 해 또는 2026],
anchorYear, gender, languages:[ko|ja|zh|fr|en|pt|no|pl|…], regions:[east-asia|…], tier:"anchor"|"major", wikidata:"Q…"}`
— 생몰년·QID 는 Wikidata 를 실제로 조회해 evidence 로 남긴다. 한국 작가 names.original 은 한글 본명(필명이면 필명), aliases 에 로마자.

## 출력
`qc/wave-kr-2026-09/gen/<id>.json` = `{ "silhouette"?: {…}, "plate": {id, importanceReason, genres, difficulty, difficultyReason, works, readingEntry,
readingEntryReason, readingOrder, readingWarning?, sourceIds, newSources?, relations}, "evidence": [{field, claim, url, quote}] }`
쓴 뒤 `npx tsx scripts/check-wave-candidate.ts qc/wave-kr-2026-09/gen/<id>.json` 이 OK 를 낼 때까지 고친다.
