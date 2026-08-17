# QA 캡처 하네스

사람이 매번 수동 녹화하지 않아도, 그리고 실행 환경이 없는 외부 리뷰어(사람이든
LLM이든)도 검토할 수 있도록 — 동일한 3D 씬을 결정적으로 재현하고 검토용 산출물을
생성한다. Playwright + Chromium이 **빌드된 정적 번들**을 로컬 서버로 구동하므로
셸(웹/데스크톱)과 무관하게 유효하다 (ADR 0001).

## 실행

```bash
npm run build                                # dist/ 가 캡처 대상
npm run qa:capture -- --scene kafka          # 한 씬
npm run qa:capture -- --scene kafka --renderer swiftshader
npm run qa:all                               # 전 씬
npm run qa:bundle                            # artifacts/ → 리뷰 zip + summary.md
npm run qa:source-zip                        # 소스 아카이브 (git archive)
```

옵션: `--renderer auto|hardware|swiftshader` (기본 auto = 하드웨어 우선, 실패 시
SwiftShader 폴백 — 사용된 모드는 `metrics.json`의 `rendererLaunched`에 기록),
`--overlay` (디버그 오버레이를 캡처에 포함), `--output <dir>`, `--dist <dir>`.

종료 코드: `0` 통과 · `2` 검증 실패(assert/콘솔 에러/외부 요청) · `3` 환경 실패
(WebGL 부재 등 — `failure-report.json` 생성, **조용한 2D 강등 없음**).

## 씬

| 씬 | 내용 |
|---|---|
| `overview` | 초기 진입, 회전, 확대·축소, **demand 게이트**(연표 intent 전 eras 요청 0), **첫 상호작용 게이트**(회전 창 p99<50ms·롱태스크 0 — 부트 태스크는 별도 기록) |
| `kafka` | 검색→선택, 방향 스파크 `/data` 대조, **흐름 상태 머신**(중심 임팩트 링 1회, outgoing 3웨이브 도착 분산 ≥800ms, pulse start/end 노드당 1회 — 풀=수신자 수), **활성 펄스 동기 캡처**, 보르헤스 왕복 |
| `works-cities` | 작품 도시 라벨 → **클릭·키보드로 작품 카드**, 카메라 보존, `w=` 딥링크; 도시 심화(지구·항구·교량)는 로드맵 선언 |
| `timeline` | 1850·1900·1922·1950·2000·전체 시기 — 시점별 작가/관계 계수 기록 |
| `coordinate-transition` | 친연성↔지리 전환, 중간 프레임 캡처, 전환 이벤트 쌍 검증 |
| `tour-modernism` | '모더니즘의 세 축' 첫 3단계 — 각 단계 선택 작가를 `data/tours.json`과 대조 |
| `era-morph` | **판구조**: 키프레임 브래킷·믹스 수치 검증(1880→2000), 주권 생애 4막, 도시 창건 3단(1913:1→1919:3→전체:5), 전체-시기 이중 바이패스 계약(생애+브래킷), 1925 연합 오버레이·**≈ 조약 카르투슈**(계산치 표기) 스윕, **의미 계약**(범례 문구 ↔ eras 파일 연도·개수·growth 산식 대조), 프로필 주권 배지 |
| `compare` | `a=&cmp=` 딥링크, 정본 방향 경로(←/→ 동시 표시), Escape 종료 |
| `reduced-motion` | 스파크 0 + 정적 화살촉 유지 (방향 정보는 모션 없이도 보존) |
| `geo-density` | 지리 원경 지역 클러스터 + 억제율 ≤25%(하드), **관계 LOD**: 미선택 raw 간선 0(229였다) — far 지역 항로 ≤16·상중경 항로 ≤24·인장 줌 quiet, **인장 군집** 겹침 ≤2(하드), 칩→팝오버→선택 E2E |
| `memory-soak` | 연도 스크럽 20회+선택 20회 후 텍스처/지오메트리/추정 바이트 기준선 복귀(LRU·해제 검증) |
| `kafka-journey` | **R8 신규 사용자 완주 (vertical-slice 계승)**: 검색 선택 → **위계**(작가 라벨 ≤ cast·집계 0·도시 mid 가시) → **관계 정체성**(far/near/드래그에 관계 ID 집합·storyKey·diff 0 불변) → **영토 입장 버튼**(도착 near·진입 세그먼트 max frame ≤60ms·메모리 +패치(~2MiB, 전판 170.7MiB였다)) → **상위 3도시 투영 반경 ≥8px·화면 안·패널 비가림** → **렌즈 픽셀 증명**(켜기 전후 영토 영역 mean |ΔL| ≥0.008 — 상태 플래그가 아니라 픽셀; owner-index 버그 재발 방지) → 도시 클릭 = **단일 인스펙터** 작품 깊이(부유 카드 0) + safe-area → 읽기 가도 이전/다음 → ← 프로필 복원 → Escape 완주 시 **패치 즉시 해제**(바이트 시작 ±4MiB) → 진입-이탈 ×3 soak(바이트 평탄·diff 0) |
| `flow-lifecycle` | **서사 수명주기**: LOD 2회 전환·카메라 드래그에 storyBuilds 불변, 스크럽 중 preview만(재시작 0), commit은 diff ≤1, 재생 버튼만 리셋 |
| `camera-interrupt` | **카메라 주권**: pointerdown/wheel이 자동 focus를 같은 디스패치에서 절단(월 21ms), 인계 후 스냅 0(최악 프레임 스텝 <0.1rad), Escape 북마크 복원(dist 오차 <8) |
| `lod-hysteresis` | 경계 ±3% 휠 진동 30회 × 두 경계에서 티어 전환 0, 의도된 이동은 전환됨 |
| `memory-soak-long` | **20/100/500 체크포인트 기울기 수렴**(바이트 @500 ≤ @100×1.02), 카운트 유계, 최종 해제 복귀 |
| `en-locale` | 헤더·범례·프로필 영어 전환 |
| `dpr2` | deviceScaleFactor 2에서 렌더·pixelRatio 캡 검증 |
| `fallback-2d` | `?nowebgl=1` 2D 에고 그래프: 근거 카드, 키보드 조작(Enter/Escape/이동), 3D 컨트롤 비노출 |

## 예산 (씬 실패 조건)

- **화면상 라벨 겹침** `labelsOverlapping ≤ 2` — 전 씬 전 비트 하드 예산.
  (`labelsSuppressed`는 그리디 배치가 겹침을 막으려고 탈락시킨 후보 수 —
  가독성 신호일 뿐 화면 겹침이 아니다. 이 구분을 혼동하지 말 것.)
- **지리 원경 억제율 ≤ 25%** (`geo-density` 씬 하드).
- **지리 중경 인장 겹침 쌍 ≤ 2** (`geo-density` 씬 하드) — 화면공간 군집이
  구조적으로 보장(충돌 술어 = 겹침 계측과 동일한 사각형 검사); 군집 ≥1과
  칩→팝오버→선택 E2E가 함께 게이트.
- **콘솔 에러 0 · 차단 외부 요청 0** — 전 씬.
- 프레임 지표는 비트마다 리셋되어 각 구간의 독립 수치로 기록된다
  (워밍업 히치가 이후 비트를 오염하지 않음). p95/p99는 기록·보고 대상이며
  하드 게이트는 아니다 — 절대 fps는 머신 의존이라 예산화하지 않는다
  (SwiftShader 수치는 성능 판정에 사용 금지).

씬은 실제 사용자 경로(검색·버튼·링크)로만 앱을 조작하고, 상태는 읽기 전용 훅
`window.__lpQA`로만 읽는다. 미구현 기능은 절대 연출하지 않는다.

## 산출물 (씬당)

```
artifacts/<scene>/
├─ recording.webm        # 전체 주행 영상 (환경상 불가 시 manifest에 사유)
├─ frames/NNN-<beat>.png # 비트별 1920×1080 스크린샷
├─ metrics.json          # 앱 버전·커밋, 호스트, GL 식별(webgl1/2·vendor·renderer),
│                        # HW 가속 여부, fps(avg/min·p50/p95/p99), draw calls·tris,
│                        # 라벨 표시/충돌 수, 표시 작가·관계 수, 최종 상태
├─ events.json           # 시간순 이벤트: 선택·필터·연도·좌표계·투어·카메라 시작/끝·
│                        # 모드 전환 시작/끝·flows-built(정본 방향 포함)/cleared
├─ scene-state.json      # 비트마다의 상태 스냅숏
├─ console.json          # 콘솔 에러·경고, 차단된 외부 요청 목록
└─ manifest.json         # 파일 sha256, 검증 결과, not_implemented, 재현 명령
```

## 결정성

고정 뷰포트 1920×1080 · DPR 1 · locale ko-KR, 카메라·전환 idle 대기
(`cameraAnimating`/`modeTransition` 폴링 + 감쇠 꼬리 대기), 좌표는 동결된
`positions.v1`. 픽셀 단위 재현이 필요하면 `--renderer swiftshader`
(GPU 무관 소프트웨어 렌더링 — 단, 성능 수치로 읽지 말 것).

## 오프라인 증명

하네스는 localhost 번들 외의 **모든 네트워크 요청을 차단**한 채 전 씬을 돌린다.
`blockedExternalRequests`가 0이 아니면 씬은 실패한다 — 번들 자급자족(오프라인
실행 계약)의 회귀 테스트를 겸한다.

## 앱 내 계측

- `?debug=1` 또는 `Cmd/Ctrl+Shift+D`: 디버그 오버레이 (fps·GL 식별·draw calls·
  라벨 충돌·표시 계수·카메라·진행 중 애니메이션·최근 이벤트). 포인터 투과 —
  측정 대상에 영향을 주지 않는다.
- `window.__lpQA`: `metrics()` / `events()` / `state()` / `overlay(bool)`.
  항상 장전되어 있다(한계 링 버퍼라 비용 무시 가능).

## 씬 추가하기

`qa/scenes.mjs`에 `{ title, run(ctx) }`를 등록한다. `ctx`는
`goto/waitIdle/settle/beat/metrics/events/drag/assert/notImplemented`와
`relationsById`(정본 관계), `tours`(정본 투어)를 제공한다. 규칙 두 가지:
사용자 경로로 조작할 것, 없는 기능은 `notImplemented`로 선언할 것.
