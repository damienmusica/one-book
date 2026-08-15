# 문학의 행성 (Literary Planet)

20세기 세계문학의 작가 100명·작품 500여 편·관계 250여 개를 **회전하는 구면 지도** 위에서
탐험하는 한국어 독서·연구 도구. 문학적 친연성이 높은 작가일수록 구면 위에서 가깝게 배치되며,
실제 지리 모드와 언제든 전환할 수 있다.

Noosphere 결정 (86)이 예약한 자매품 옵션 **Booksphere** 계보의 첫 프로토타입이다.
정체성·경계·상속 제약은 [docs/product-brief.md](docs/product-brief.md) 참조.
Noosphere 본체의 `/data`·`foundry/`와 완전히 분리된 자립 패키지다.

## 실행

```bash
cd literary-planet
npm install
npm run dev        # http://localhost:5173
```

## 명령

```bash
npm run typecheck        # tsc --noEmit
npm run test             # vitest — 데이터 불변식·레이아웃 결정성·URL·검색·그래프·컴포넌트
npm run validate:data    # 전체 데이터 기계 검증 (스키마 + 교차 불변식)
npm run build            # validate:data 통과 후 프로덕션 빌드 (dist/)
npm run preview          # 프로덕션 빌드 로컬 서빙

npm run layout:generate  # 시맨틱 좌표 증분 생성 (동결 좌표 유지, 신규만 배치)
npm run layout:full      # 전체 재계산 + 좌표 버전 범프 (공간 기억을 깨므로 신중히)
npm run report:coverage  # docs/coverage-report.md 생성 (지역·언어·젠더·장르·검토 분포)

npm run qc:crosscheck-dates   # 유지관리자 QC: Wikidata 생몰년 교차확인 (로컬 네트워크 전용)
```

배치별 부분 검증: `npm run validate:data -- --only <batch>` (작가 배치),
`-- --only-rel <cluster>` (관계 배치), `-- --allow-partial` (좌표 동결 전 전체).

## 구조

```
data/               JSON 데이터 (유일한 콘텐츠 원본 — UI에 하드코딩 없음)
  registry.json       작가 100명 ID 원장 (계층·티어·배치 배정)
  authors/ works/     배치별 작가 프로필·작품
  relations/          클러스터별 관계 (근거 수준 명시)
  sources/            출처 (core + 배치별 1차 문헌)
  movements.json      문학운동 레지스트리 (20)
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
                      단 qc:crosscheck-dates만 로컬 네트워크 사용)
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
