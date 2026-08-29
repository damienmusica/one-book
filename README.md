# 문학의 성계 (Literary Star System)

20세기 세계문학의 작가 100명·작품 500여 편·관계 250여 개를 **천구의 별들**로
탐험하는 한국어 독서·연구 도구. 별을 발견하고, 다가가 궤도 정보를 읽고, 준비된
작가의 천체에 착륙해 육필 지각 위의 작품 도시(연도 서가)를 걷는다.
(패키지·저장소 이름 `literary-planet` 은 역사적 이름으로 유지한다.)

Noosphere 결정 (86)이 예약한 자매품 옵션 **Booksphere** 계보의 첫 프로토타입이며,
결정 (130)이 비준한 우주 아키텍처의 **제1성계**다((129) 제자리 개정) — 성계는 정본
코퍼스를 잘라 만들지 않고 따로 모아 짓는 자립 세계이며, 성계 간 조인 키는 Wikidata QID다.
정체성·경계·상속 제약은 [docs/product-brief.md](docs/product-brief.md) 참조.
Noosphere 본체의 `/data`·`foundry/`와 완전히 분리된 자립 패키지다.

## 실행

```bash
cd literary-planet
npm install
npm run dev        # http://localhost:5173
```

엔트리는 성계 하나다.

| 경로 | 무엇인가 |
|---|---|
| `/` (index.html) | **성계** — 천구의 별 → 접근 → 작가 천체 착륙. [docs/universe-thesis.md](docs/universe-thesis.md) |
| `/universe.html` | 같은 앱의 별칭 엔트리 — 기존 딥링크·하네스 URL 이 살아 있도록 유지 |

**행성 앱(R1–R10 구면 영토 지도)은 정문 교체(2026-08-29, CPO)와 함께 은퇴했다** —
코드·QA 하네스는 git 히스토리에 남고(`git log -- src/components qa/`), 데이터·동결
좌표·지형 생성 스크립트·기록 계약(eras/terrain)·R10 자산은 성계가 그대로 상속한다.

## 명령

```bash
npm run typecheck        # tsc --noEmit
npm run test             # vitest — 데이터 불변식·레이아웃 결정성·성계 문법·검색·i18n·기록 계약
npm run validate:data    # 전체 데이터 기계 검증 (스키마 + 교차 불변식)
npm run build            # validate:data 통과 후 프로덕션 빌드 (dist/)
npm run preview          # 프로덕션 빌드 로컬 서빙

# 성계 게이트 (dist 빌드 후)
node art-r11/verify-journey.mjs     # 넓은 화면 여정 계약
npm run universe:flight             # 카메라 주권 — 조준·추력·조속기·걷기
npm run universe:mobile             # 손안의 계약 — 390×664, 손가락 입력
npm run universe:reproduce          # 한 명령 전체 게이트 + 리포트
npm run universe:mutation-sweep     # 계약의 이빨 측정 (트리 잠금)

npm run layout:generate  # 시맨틱 좌표 증분 생성 (동결 좌표 유지, 신규만 배치)
npm run layout:full      # 전체 재계산 + 좌표 버전 범프 (공간 기억을 깨므로 신중히)
npm run report:coverage  # docs/coverage-report.md 생성 (지역·언어·젠더·장르·검토 분포)

npm run qc:crosscheck-dates   # 유지관리자 QC: Wikidata 생몰년 교차확인 (저장 QID 직조회, 로컬 네트워크 전용)
npm run qc:backfill-qids      # 유지관리자 QC: Wikidata QID 해소·기입 (1회성/신규 작가용, 로컬 네트워크 전용)
```

오프라인 실행: `dist/`를 아무 정적 서버로 서빙하면 전 기능 동작 (외부 요청 0).
데스크톱 셸은 의도적으로 유보 (docs/adr/0001).

배치별 부분 검증: `npm run validate:data -- --only <batch>` (작가 배치),
`-- --only-rel <cluster>` (관계 배치), `-- --allow-partial` (좌표 동결 전 전체).

## 구조

```
data/               JSON 데이터 (유일한 콘텐츠 원본 — UI에 하드코딩 없음)
  registry.json       작가 100명 ID 원장 (계층·티어·배치 배정)
  authors/ works/     배치별 작가 프로필·작품
  relations/          클러스터별 관계 (근거 수준 명시)
  sources/            출처 (core + 배치별 1차 문헌)
  movements.json      문학운동 레지스트리 (19)
  tours.json          안내 여정
  positions.v1.json   동결된 시맨틱 좌표 (시드 고정·결정적)
src/
  types.ts schema.ts  타입 + Zod 스키마 (데이터 계약의 정본)
  data/               로딩·병합·불변식 검사
  lib/                순수 로직 (구면 수학·필터·검색·그래프·LOD·시드 RNG)
  state/              스토어 + URL 해시 직렬화
  globe/              three.js 렌더러 + DOM 레이블 레이어
  components/         React UI
scripts/              검증·레이아웃·커버리지·QC 스크립트 (LLM·네트워크 비의존,
                      단 qc:crosscheck-dates·qc:backfill-qids만 로컬 네트워크 사용)
docs/                 프로덕트 브리프 · 에디토리얼/관계 생성 계약 · QC 원장 · 커버리지
tests/                vitest 스위트
```

## 데이터 정직성 (요약 — 전문은 DATA_METHODOLOGY.md)

- 모든 관계는 근거 수준을 명시한다: `documented`(1차 기록) / `scholarly_consensus`(학계
  정설 계보) / `editorial_inference`(이 지도의 편집적 친연성). **직접 영향·번역·사사
  관계는 출처 없이 저장될 수 없다** (기계 검증이 차단).
- 검토 사다리: `draft`(생성 직후) → `reviewed`(기계 검증 + Wikidata 교차확인 + 정독
  샘플링) → `verified`(외부 검증 — v1에서는 미부여).
- 번역 제목은 통용 표기 하나 + 원제 병기. URL은 검증된 도메인 수준만 기록.
- 지리 좌표와 문학적 좌표는 별개다. 시맨틱 좌표는 시드 고정 결정적 알고리즘으로 생성 후
  동결하며, 신규 작가는 기존 좌표를 흔들지 않고 증분 배치된다.

## 하드 제약 (Noosphere 상속)

로그인·DB·관리 UI·UGC·스크래핑·광고·결제·시크릿 없음. **빌드·런타임·CI는 LLM을 요구하지
않는다** — LLM은 유지관리자가 대화형으로 데이터 초안을 만들 때만 쓰이고, 커밋된 JSON이
산출물이다.
