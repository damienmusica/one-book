# 번역 생성 계약 — data/translations/en/

이 문서는 EN 번역 생성 에이전트를 구속하는 계약이다. 소스는 한국어 원본 데이터
(`data/authors|works|relations|movements|tours`)이며, 산출물은 그 **충실한 영어 번역**이다.

## 절대 규칙

1. **번역이지 리서치가 아니다.** 새 사실·새 주장·수식 추가 금지. 한국어 원문에 없는
   내용은 영어에도 없어야 한다. 원문의 편집적 어조(정밀·무과장·무찬양)를 유지한다.
2. **연도·숫자·고유명사는 그대로.** 원문 길이의 ±30% 안에서 자연스러운 영어로.
3. **자기 QC 금지.** 생성과 검토는 분리된다. 확신 없는 항목은 파일에 쓰되
   최종 메시지에 `UNCERTAIN:` 목록으로 보고한다 (특히 확립된 영어 제목이 불확실한 작품).
4. **보고서를 파일로 쓰지 마라.** 배치 보고는 최종 메시지 본문으로만.

## 이름 (authors[].name)

영어권 학술·출판에서 통용되는 표준 표기를 쓴다: 川端康成 → Yasunari Kawabata,
大江健三郎 → Kenzaburo Oe, 박경리 → Park Kyong-ni, Анна Ахматова → Anna Akhmatova.
서구 작가는 원어 표기 그대로 (Marcel Proust → Marcel Proust). `aliases`(선택)에는
흔한 대체 로마자 표기만 (예: Pak Kyŏngni). 새 로마자 표기를 발명하지 않는다.

## 작품 제목 (works[].title)

**확립된 영어 번역 제목**이 있으면 그것을 쓴다: 雪国 → Snow Country,
Die Verwandlung → The Metamorphosis, 토지 → Land. 확립된 영어 제목이 없거나
불확실하면: 원제가 라틴 문자면 원제 그대로, 아니면 통용 로마자 표기를 쓰고
`UNCERTAIN:`으로 보고한다. **존재하지 않는 '출판된 영어 제목'을 발명하지 마라.**

## 필드 최소 길이 (Zod 강제)

- authors: `importanceReason` ≥60자, `readingEntryReason` ≥30, `difficultyReason` ≥20,
  `readingWarning` ≥10 (**원본에 있을 때만, 있으면 반드시**), `worksException` 동일 규칙.
- works: `significance` ≥30. relations: `summary` ≥40.
- movements: `description` ≥20. tours: `stopNotes[]` 각 ≥60, **개수 = 원본 stops 개수**.

## 파일 형식

UTF-8, 2칸 들여쓰기, 배열 루트, id는 원본과 정확히 일치. 스키마 예시:

```json
// data/translations/en/authors/<batch>.json
[{ "id": "franz-kafka", "name": "Franz Kafka", "aliases": ["Kafka"],
   "importanceReason": "...", "readingEntryReason": "...",
   "readingWarning": "...(원본에 있을 때만)", "difficultyReason": "...",
   "worksException": "...(원본에 있을 때만)" }]

// data/translations/en/works/<batch>.json
[{ "id": "franz-kafka--die-verwandlung", "title": "The Metamorphosis", "significance": "..." }]

// data/translations/en/relations/<cluster>.json
[{ "id": "influence--fyodor-dostoevsky--franz-kafka", "summary": "..." }]

// data/translations/en/movements.json
[{ "id": "modernism", "name": "Modernism", "description": "..." }]

// data/translations/en/tours.json
[{ "id": "...", "title": "...", "description": "...", "stopNotes": ["...", "..."] }]
```

## 용어 일관성

관계 유형·시대층·근거 수준의 영어 라벨은 `src/types.ts`의 `en` 필드가 정본이다
(번역문 안에서 이를 지칭할 때 그 표기를 따른다). 운동 이름은 표준 영어 명칭
(Modernism, Surrealism, Nouveau roman, Magical realism, …)을 쓴다.
