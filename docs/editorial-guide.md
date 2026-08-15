# 에디토리얼 가이드 — 작가·작품 데이터 생성 계약

이 문서는 《문학의 행성》 데이터 배치를 생성하는 에이전트가 **구속 계약**으로 따라야 하는
지침이다. 스키마의 기계적 정의는 `src/schema.ts`, 타입·레지스트리는 `src/types.ts`가 정본이다.

## 0. 정직성 계약 (위반은 배치 전체 기각 사유)

1. **모르는 사실을 만들지 마라.** 확신 없는 생몰년·연도·지명은 그럴듯하게 채우지 말고,
   그 항목을 batch 리포트(아래 §7)에 `UNCERTAIN:` 으로 명시하라. QC가 외부 확인한다.
2. **출처를 위조하지 마라.** URL은 절대 새로 만들지 마라 — `data/sources/core.json`의 공용
   출처를 참조하거나, URL 없는 1차 문헌 출처(실존 문서의 제목·맥락만 기록)를 추가하라.
3. **저작권 인용 금지.** 작품 본문을 인용하지 마라. 모든 해설은 직접 쓴 요약이다.
4. **찬양 금지.** "위대한", "불멸의", "천재" 류의 추상 찬사는 쓰지 마라. 무엇을 어떻게
   새로 만들었는지 구체적으로 쓰라.
5. **reviewStatus는 전부 `"draft"`.** `reviewedAt`은 쓰지 마라. 승급은 QC의 몫이다.

## 1. 산출 파일 (자기 배치 파일만 쓴다 — 다른 배치 파일을 읽거나 쓰지 마라)

배치 이름이 `<batch>`일 때 정확히 세 파일을 쓴다:

- `data/authors/<batch>.json` — Author 배열. 배치에 배정된 작가 전원, `data/registry.json`의
  id·ko·original·tier를 **그대로** 사용 (불일치는 검증 실패).
- `data/works/<batch>.json` — Work 배열. 작가당 3–6편.
- `data/sources/<batch>.json` — 이 배치가 새로 추가하는 출처들 (없으면 `[]`).
  공용 출처(`core.json`)는 다시 정의하지 말고 id로만 참조.

JSON은 2칸 들여쓰기, UTF-8, 배열 루트. 필드 순서는 스키마 선언 순서를 따른다.

## 2. Author 필드별 규율

- `names.aliases`: 국내 다른 표기, 로마자 표기, 필명·본명. ko/original과 동일 문자열 금지.
- `birthYear`/`deathYear`: 확실할 때만. `activeRange`: **문학 활동 기간**(첫 주요 발표 ~
  마지막 주요 활동), 생몰년이 아니다. `anchorYear`: 대표작 활동의 무게중심 연도 하나.
- `gender`: 공적으로 알려진 사실대로. 애매하면 `"unknown"`.
- `languages`: **집필 언어** ISO 코드 (`src/types.ts`의 `LANGUAGE_LABELS`에 있는 코드만).
- `regions`: `REGION_DEFS`의 id만. 복수 허용 (예: 망명 작가).
- `locations`: 1–3개. `primary: true` 정확히 1개 — 지리 모드에서 쓰이는 대표 좌표.
  출생지가 아니라 **문학 활동의 중심지**를 대표로 골라도 된다. 그 경우 `note`에 이유 한 줄.
  좌표는 도시 수준 (소수 2–4자리). 확신 없으면 batch 리포트에 `UNCERTAIN:`.
- `periods`: 주 활동이 걸치는 층 전부. 레지스트리의 `layer`는 주 층이며 반드시 포함.
  1990년 이후에도 주요 작품을 냈다면 `"contemporary"`를 추가.
- `movements`: `data/movements.json`의 20개 id만. 실제 소속·핵심 관련만 (억지 배정 금지, 0개 허용).
- `genres`: 실제 주요 장르 전부. SF·사변 계보의 작가는 `speculative: true`.
- `importanceReason`: 2–4문장. ① 무엇을 형식적으로 새로 만들었나 ② 문학사적으로 무엇을
  바꿨나. 구체적 명사로.
- `readingEntry`+`readingEntryReason`: 처음 읽을 한 편과 그 이유 (분량·접근성·대표성).
- `readingOrder`: 3–5편, 첫 항목 = readingEntry. 난도 상승 순서로.
- `readingWarning`: 잘못 시작하기 쉬운 경로가 실제로 있을 때만.
- `difficulty` 기준: 1=누구나 바로, 2=약간의 인내, 3=집중 독서 요구, 4=형식 실험을 감내,
  5=전공자적 끈기. `difficultyReason`에 난도의 **원인**(문장? 구조? 분량? 배경지식?)을 쓰라.
- `sourceIds`: 이 프로필의 사실 확인이 가능한 출처 1개 이상 (보통 `src--britannica` +
  해당 문화권 출처 + `src--kr-world-lit-editions`).

## 3. Work 필드별 규율

- `id`: `<authorId>--<원제-로마자-슬러그>` (예: `franz-kafka--die-verwandlung`).
- `titleKo`: 국내 통용 번역 제목 하나. **유일한 공식 제목이라 단정하지 않는다** — 원제가
  항상 병기되므로 대표 표기 하나면 된다.
- `year`: **원어 최초 발표 연도**. 사후 출간은 significance에 명시.
- `significance`: 1–2문장 — 이 작품이 왜 대표작인가.
- 장편/단편집/시집/희곡 각각 `genre` 정확히.

## 4. 근거 수준 3분류 (관계 데이터 배치에서 사용 — 프로필 배치에도 개념 공유)

1. `documented` — 서신·인터뷰·회고록·번역 사실·명시적 독서 기록이 있는 관계.
2. `scholarly_consensus` — 신뢰할 만한 2차 연구가 반복적으로 다루는 계보.
3. `editorial_inference` — 이 지도가 비교를 위해 가까이 놓은 편집적 친연성.

"비슷하다"는 이유만으로 documented를 주장하는 것이 이 프로젝트의 제1 금지 사항이다.

## 5. 한국어 문체

- '~다' 종결. 단정하고 구체적으로. 만연체 금지.
- 번역 제목은 『겹낫표』, 단편·시는 「홑낫표」.
- 사람 이름은 국내 통용 표기 (레지스트리의 ko 표기와 일치).

## 6. 예시 프로필 (품질 기준선 — franz-kafka)

`early-west-a` 배치는 아래 세 조각을 **그대로** 자기 파일에 포함하고 나머지 작가를 같은
수준으로 작성한다. 다른 배치는 이 수준을 기준으로 삼는다.

```json
{
  "id": "franz-kafka",
  "names": { "ko": "프란츠 카프카", "original": "Franz Kafka", "aliases": ["카프카", "Kafka"] },
  "birthYear": 1883,
  "deathYear": 1924,
  "activeRange": [1908, 1924],
  "anchorYear": 1915,
  "gender": "male",
  "languages": ["de"],
  "regions": ["central-europe"],
  "locations": [
    { "label": "프라하", "lat": 50.0875, "lon": 14.4213, "role": "birth", "primary": true, "note": "출생지이자 평생의 활동 무대" },
    { "label": "베를린", "lat": 52.52, "lon": 13.405, "role": "activity" }
  ],
  "periods": ["early-modernism"],
  "movements": ["modernism"],
  "genres": ["fiction"],
  "tier": "anchor",
  "importanceReason": "불가해한 죄의식과 관료제의 미로를 꿈의 논리로 서술하되, 정확하고 건조한 보고서의 문장으로 기록하는 산문을 만들었다. 환상과 사실주의의 대립을 무효화한 이 방법은 하나의 보통명사('카프카적')가 되었다. 사후 출간된 미완의 장편들은 실존주의, 부조리문학, 라틴아메리카 환상문학이 저마다 자기 선구자로 소급 발견한 좌표가 되었다.",
  "readingEntry": "franz-kafka--die-verwandlung",
  "readingEntryReason": "하룻밤 분량 안에 카프카적 상황의 전모 — 변신, 가족, 일상의 폭력 — 가 압축되어 있어 첫 관문으로 가장 확실하다.",
  "readingOrder": ["franz-kafka--die-verwandlung", "franz-kafka--der-process", "franz-kafka--das-schloss"],
  "readingWarning": "『성』이나 『소송』으로 시작하면 미완의 구조와 반복 때문에 중도 포기하기 쉽다. 단편에서 장편으로 가는 순서를 권한다.",
  "difficulty": 3,
  "difficultyReason": "문장 자체는 평이하지만 사건의 논리가 해석을 계속 미끄러뜨리고, 장편은 미완성이라 중반 이후 밀도 있는 독서가 필요하다.",
  "sourceIds": ["src--britannica", "src--cambridge-companions", "src--kr-world-lit-editions"],
  "reviewStatus": "draft"
}
```

```json
{
  "id": "franz-kafka--die-verwandlung",
  "authorId": "franz-kafka",
  "titleKo": "변신",
  "titleOriginal": "Die Verwandlung",
  "year": 1915,
  "genre": "fiction",
  "significance": "한 문장의 변신 선언으로 시작해 가족과 노동의 일상이 괴물성을 흡수하는 과정을 기록한다. 20세기 단편의 가장 유명한 첫 문장이 된 작품.",
  "sourceIds": ["src--britannica"]
}
```

```json
{
  "id": "src--kafka-letters-felice",
  "title": "펠리체 바우어에게 보낸 편지 (1913. 9.)",
  "publisherOrInstitution": "Franz Kafka 서간집",
  "citation": "그릴파르처·도스토옙스키·클라이스트·플로베르를 자신의 '진짜 혈족'으로 꼽은 편지 — 도스토옙스키 영향의 1차 근거"
}
```

## 7. 자기 점검 (기계 검증만 — 편집 QC는 별도 컨텍스트가 수행한다)

1. 파일 작성 후 `literary-planet/` 디렉토리에서:
   `npm run validate:data -- --only <batch>` 실행, 에러 0이 될 때까지 스키마 오류를 고친다.
2. 마지막 응답에 batch 리포트를 남긴다:
   - 작가 수 / 작품 수 / 신규 출처 수
   - `UNCERTAIN:` 항목 전부 (사실 + 불확실한 이유)
   - `JUDGMENT:` 편집 판단이 개입한 항목 (대표 좌표 선택, 시대층 경계 판정 등)
   - 실제 실행 모델 ID 자기보고 (프로비넌스 기록용)
3. 자기 출력의 사실 검토(잘 썼는지 평가)는 하지 마라 — 생성과 QC는 분리된다.
