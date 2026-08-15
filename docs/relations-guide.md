# 관계 데이터 생성 계약 — relations-guide

작가 프로필 계약(`docs/editorial-guide.md` §0 정직성 계약 포함)을 상속한다.
이 문서는 관계(`Relation`) 배치 전용 추가 규율이다. 기계 정의는 `src/schema.ts`가 정본.

## 0. 이 프로젝트의 제1 금지 사항

**"비슷하다"만으로 영향을 주장하는 것.** 모든 관계는 세 근거 수준 중 하나이며 섞으면 배치
전체가 기각된다:

1. `documented` — 서신·인터뷰·회고록·번역 사실·강의·명시적 독서 기록이 있다.
   **요약(summary) 또는 출처(citation)에 그 근거 문서를 반드시 실명으로 적는다.**
   예: "보르헤스는 에세이 「카프카와 그의 선구자들」(1951)에서 …"
2. `scholarly_consensus` — 신뢰할 만한 2차 연구가 반복적으로 다루는 계보. 어느 학술
   전통이 다루는지 요약에서 알 수 있어야 한다.
3. `editorial_inference` — 이 지도가 비교를 위해 가까이 놓은 편집적 친연성.
   요약에 "직접 접촉의 기록은 없다"는 사실이 드러나야 한다.

확신이 없으면 **한 단계 낮춰라** (documented→scholarly, scholarly→editorial).
그래도 확신이 없으면 그 관계를 버려라. 수를 채우기 위한 관계는 금지다.

## 1. 타입 의미론 (스키마가 방향·근거 수준·출처 요구를 강제한다)

| type | 방향 | 허용 수준 | 뜻 |
|---|---|---|---|
| `documented_influence` | directed (원천→수신자) | documented, scholarly_consensus | 확인된 직접 영향 또는 학계 정설 계보 |
| `translation` | directed — **원작자가 source, 번역·소개한 작가가 target** (영향 흐름과 같은 방향; 예: 보르헤스가 카프카를 번역 → `translation--franz-kafka--jorge-luis-borges`) | documented | 번역·자기 언어권 소개 |
| `mentorship` | directed (스승→제자) | documented | 사사·편집자적 후원·등단 지원 |
| `dialogue` | bidirectional | documented, scholarly_consensus | 실질 교류·우정·공개 논쟁 |
| `affinity` | bidirectional | scholarly_consensus, editorial_inference | 형식·주제 친연성 |
| `contrast` | bidirectional | scholarly_consensus, editorial_inference | 같은 문제의 반대항 (예: 되받아 쓰기) |

주의: 콘래드→아체베처럼 **한쪽이 다른 쪽을 명시적으로 비판하며 다시 쓴 경우**는
`contrast` + `scholarly_consensus`(또는 documented급 문서가 있으면 요약에 명시하되 수준은
스키마 제약상 scholarly_consensus)로 기록하고, 요약에 그 문서(「아프리카의 이미지」 등)를 실명한다.

- id 형식: `influence--<source>--<target>` (documented_influence만 `influence` 접두),
  나머지는 타입명 그대로 `translation--…`, `dialogue--…` 등.
- 상호 영향은 directed 두 개가 아니라 `dialogue` 하나다 (역방향 중복은 검증 실패).
- weight: documented 0.7–0.95 · scholarly 0.5–0.75 · editorial 0.3–0.55.
  이 값은 레이아웃 인력과 선 강조에 쓰인다.

## 2. 소유권 규칙 (배치 간 중복을 구조적으로 차단)

**후행 작가**(directed면 target, bidirectional이면 더 늦게 태어난 쪽)가 자기 배치의
소유 명단에 속하는 관계만 쓴다. 명단 밖이면 그 관계는 다른 배치 소유다 — 쓰지 마라.

## 3. 산출 파일

- `data/relations/<cluster>.json` — Relation 배열
- `data/sources/rel-<cluster>.json` — 신규 출처 (URL 금지, 실존 1차 문헌만; 없으면 `[]`)

기존 출처 재사용 우선: `data/sources/*.json`에 이미 등록된 id(코어 + 12개 프로필 배치의
1차 문헌들)를 grep으로 찾아 재사용하라. 특히 `src--kafka-letters-felice`,
`src--paris-review`, 각 배치의 강연·서문 출처들.

## 4. 예시 (품질 기준선)

```json
{
  "id": "influence--fyodor-dostoevsky--franz-kafka",
  "sourceId": "fyodor-dostoevsky",
  "targetId": "franz-kafka",
  "type": "documented_influence",
  "direction": "directed",
  "weight": 0.85,
  "summary": "카프카는 1913년 펠리체에게 보낸 편지에서 도스토옙스키를 자신의 '진짜 혈족' 넷 중 하나로 꼽았다. 『죄와 벌』의 죄의식 구조는 『소송』의 전제와 깊이 공명한다.",
  "evidenceLevel": "documented",
  "sourceIds": ["src--kafka-letters-felice"]
}
```

## 5. 자기 점검·리포트

1. `npm run validate:data -- --only-rel <cluster>` 를 에러 0까지 반복한다 (전체 작가
   데이터 위에서 자기 관계 파일만 검증하는 모드다).
2. 마지막 응답 = batch 리포트: 관계 수(타입별·수준별), UNCERTAIN 전부(특히 documented
   주장의 근거 문서), JUDGMENT 전부, 실행 모델 ID 자기보고.
3. 관계 수를 작가마다 균등하게 만들지 마라. 관계가 안 나오는 작가는 비워 둔다.
4. 자기 출력의 사실 검토는 하지 않는다 (생성/QC 분리).
