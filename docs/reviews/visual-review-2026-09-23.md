# 시각 심사 — 종이와 인장, 두 번째 바퀴 (2026-09-23)

「종이와 인장」이 배포된 다음 날, 다섯 갈래의 심사(아트디렉터 미감 · 모바일 구도 · 첫 독자 걸음 ·
롱테일 견고성 · 접근성과 무게)가 빌드된 화면을 스크린샷과 계측으로 보고, 갈래마다 별도의
회의론자가 모든 지적을 새 스크린샷으로 재현해 판정했다. 이 문서는 그 원장과 처분이다.
숫자는 회의론자의 재계측을 쓴다. 지적 ID 는 워크플로 저널의 것.

## 판정 원장

| ID | 판정 | 처분 |
|---|---|---|
| art-director-01 왼쪽 쪽이 비어 있다 | 기각 — 표제지가 본문 면을 마주 보는 것은 책의 관습, 독자 피해 없음 | 그래도 문해의 지도를 verso 로 옮김 |
| art-director-02 중철이 1px 선뿐 | 기각 — 그라디언트가 이미 있었음(픽셀 샘플) | 그림자를 더 짚게 |
| reader-walk-01 도장이 제목을 덮는다 (모바일) | 확정 major | 900px 아래에서 제목 아래 정상 배치 |
| reader-walk-02 독의 ▾ 가 아무것도 열지 않는다 | 확정 major | 사다리가 독 위로 시트처럼 선다; 바깥 탭으로 닫힘 |
| reader-walk-03 표시 상태가 뒤집혔다 | 기각 — 인주색 pip·▾·「서재에 꽂혔다」 셋이 이미 말함 | 그래도 표시된 칸을 인주색 채움으로(판정 전에 고침 — 아래 참조) |
| reader-walk-04 「카프카 → 카프카」 | 확정 minor | go() 중복 제거 |
| reader-walk-05 별칭을 모른다(도스토예프스키) | 확정 major, 실제로는 더 나쁨(세익스피어·까뮈도) | 캡슐에 별칭, 정규화 비교, 여럿이면 고르게, 「못 찾았다」+색인 ?q= |
| reader-walk-06 인장이 서명 끝을 먹는다 | 확정 major (6.2–8.9px 겹침) | 양의 간격 12px, 서명 폭 축소; 계약 |
| reader-walk-07 저본 칸이 빈다 (979/1,605) | 확정 major | 원서 / 원전 직역 / 중역 / 번안·재화 / 저본 미확인 — 빈 칸 0 |
| reader-walk-08 제목으로 걸린 이유가 안 보인다 | 확정 minor | 행에 『맞은 제목』 표시 |
| reader-walk-09 지우기 단추가 브라우저 파랑 | 확정 minor (262 픽셀) | 먹색 마스크; qa/png.mjs 로 픽셀을 셈 |
| a11y-perf-fonts-index 색인 활자 3.9MB | 확정, major 로 하향 (swap 이라 읽기는 막히지 않음) | 전집 서브셋: KR 402+228KB, Noto Serif 15+16KB, JP 14+14KB |
| a11y-perf-shelf-empty-flash 서재가 「비었다」고 먼저 말한다 | 확정 blocker (4Mbps 에서 1.6초) | 표시할 때 들은 제목(lp.shelf.v1)으로 첫 화면; 사전은 모르는 책에만 |
| a11y-perf-front-eager-json 첫 장이 1.2MB+605KB 를 미리 받는다 | 확정, 단 리뷰어의 처방은 틀림(둘 다 recto 를 그리는 데 쓰임) | **미해결** — 작가별 캡슐 분할이 다음 바퀴 |
| a11y-perf-pencil-seal-contrast 2.97:1 | 기각 — 상자(점선)가 상태를 말하고 글자는 장식 | 그래도 #7a705e (3.9:1) |
| a11y-perf-zoom200-front 200% 에서 107px 넘침 | 확정 | 제목 18vw 상한, 문 줄바꿈 |
| a11y-perf-cls-front CLS 0.47 | 확정, 리뷰어 수치보다 나쁨 | recto min-height 예약 |
| a11y-perf-index-name-clip 원어 이름 17건 잘림 | 확정 minor | 줄바꿈 허용 |
| a11y-perf-work-triple-action | 절반 확정 (▾ 는 화면에 없었음 — DOM 만 읽음) | .big 의 ▾ 제거 |
| mobile-composition-signature-seal-collision | 기각 — 간격 12px 측정 (**판정 전에 고쳐진 빌드**) | reader-walk-06 과 같은 수정 |
| mobile-composition-confirm-stamp-cuts-title | 기각 (**판정 전에 고쳐진 빌드**) | reader-walk-01 과 같은 수정 |
| mobile-composition-inconsistent-cover-border | 기각 — CSS 동일, 스캔의 가장자리 차이 | 그래도 표지에 같은 헤어라인 |
| mobile-composition-search-count-stale 「도판 157」 위에 한 사람 | 확정 | 절 제목·큰 제목의 수가 필터를 따름 |
| mobile-composition-front-input-truncated-320 | 기각 — 320 에서 문이 줄을 바꿈 (**판정 전에 고쳐진 빌드**) | zoom 수정과 같은 것 |
| robustness-greek-accent-dropped 그리스 이름 58/58 이 두 글꼴 | 확정 major (CDP 로 글꼴 확인) | 그리스·키릴 문자권을 Noto Serif 가 통째로 맡음; 계약이 CDP 로 한 글꼴을 확인 |
| robustness-edition-row-overflow 판본 쪽 28/556 옆으로 샘 | 확정 blocker — 리뷰어의 처방은 틀렸고 원인은 `.pub{white-space:nowrap}` | nowrap 제거; 최악 5쪽 계약 |
| robustness-seal-glyph-fit-nonlatin | 아랍 94쪽 확정 major, 히브리·타이·타밀 저평가 — 범위는 리뷰어 주장의 1/4 | 문자권별 크기·기준선 재조정, 견본판으로 확인 |
| robustness-seal-letter-from-epithet 55건 | 확정, minor 로 하향 | qc/seal-letters.json 38건 판정 + 헝가리 성-앞 규칙 + Sr./Jr. 제외 |
| robustness-mark-state-reads-backwards | 기각 — 이미 인주색 채움(**판정 전에 고쳐진 빌드**) | — |
| robustness-index-zero-results-silent | 확정 major, 「색인 1806」/「0인」 모순까지 | 문장 + 큰 제목 수 0 |
| robustness-publisher-catalogue-cruft 6건 | 확정 minor | qc/publisher-fixes.json + 승격 가드(괄호·우편번호) |

확정 23 · 기각 8. 기각 8 중 4 는 회의론자가 이미 고쳐진 빌드를 보았다 — 심사 중에 빌드를 움직인
내 잘못이고, 다음 바퀴부터는 리뷰된 dist 를 스냅샷으로 고정한다.

## 재고 남은 것

- 첫 장의 무게: 캡슐 1.2MB(브로틀리 307KB) + 그래프 605KB(118KB) 를 입력 전에 받는다. 둘 다 recto 를
  그리는 데 쓰이므로 「미루기」로는 안 되고, 작가별 캡슐 + 이름 사전으로 갈라야 한다.
- 아랍·데바나가리·타이·타밀·에티오피아·히브리 글자 407자는 시스템 글꼴이다(낱말 단위라 깨지지 않음).
- 아랍 낱글자 인장은 작다 — ا 는 본디 가늘다. 두 글자 연결형(مح)은 다음 바퀴의 실험.

## 계약

브라우저 계약 73 → 100. 단위 128. 도구: qa/png.mjs(스크린샷 픽셀), scripts/subset-fonts.sh,
scripts/glyph-corpus.mjs, qa/shoot.mjs.
