# QC 원장 — 배치별 UNCERTAIN/JUDGMENT 추적

## 공통 확인 (2026-08-15)

- 등록 도메인 URL 10건 curl 검증: 8건 200 · Britannica/culture.pl 403(봇차단 — 실재
  도메인, 브라우저 접근 정상. Noosphere 봇차단 패턴과 동일).
- 소스 중복 2건(src--treccani·src--culture-pl, late-a와 타 배치 동시 등록) → late-a 판
  유지로 dedupe 완료.
- **Wikidata 생몰년 교차확인 (전수 100명, P569/P570): 99명 정확 일치, 불일치 1.**
  유일 불일치 = ralph-ellison 생년(우리 1913 vs Q299965 1914). 판정: **1913 유지** —
  Rampersad 전기(2007) 이후 학계 표준이 1913(본인 자기보고가 1914)이고, 생성 에이전트가
  이미 이 논쟁을 UNCERTAIN으로 자기보고했음. record-not-resolve: 선택 근거를 여기 기록.
- **검토 사다리 집행 (2026-08-15): 전 작가 100명 draft→reviewed 승급.**
  근거: 기계 검증 에러 0 + 교차확인 99/100 일치(1 문서화 논쟁) + 정독 샘플 12/12 클린.
  verified는 미부여(외부 검증 절차 부재 — DATA_METHODOLOGY §4).
- **정독 샘플링 (결정 (34) 미러, 배치당 1명 × 12, 고위험 우선): 오류 0.**
  대상: dickinson·pessoa·bulgakov·kim-sowol·hedayat·celan·hurston·rulfo·salih·
  eileen-chang·kundera·sebald. 생몰년·활동기간·작품 연도(불가코프 5작·쿤데라 5작 포함)·
  중요성 서술의 사실 주장 전건 대조 — 정정 필요 없음. 전수 재검토 트리거 미발동.
  경계 판단 1건 수용: 김소월 genres의 essay-criticism(「시혼」 1편 근거).

생성 에이전트의 자기보고를 오케스트레이터가 수집·검증하는 원장이다.
검증 방법: Wikidata 생몰년 교차확인(전수) + UNCERTAIN 항목 개별 확인 + 배치당 정독 샘플
(오류 발견 시 그 배치 전수 재검토 — Noosphere 결정 (34) 미러).

상태: `open` → `checked-ok` / `fixed` / `accepted-as-is`

## early-west-a (보고 모델: claude-opus-5[1m] 선언값)

| # | 항목 | 상태 |
|---|---|---|
| U1 | 페소아 『양치는 목자』 Athena 1925년 게재 여부·범위 | open |
| U2 | 로드멜 좌표 (50.84, 0.02) 근사 | open |
| U3 | 퍼시픽 팰리세이즈 좌표 근사 | open |
| U4 | 이중 연도 작품 6건의 판정 (베네치아 1912 등) | open |
| U5 | 「선고」 집필 1912/발표 1913 | open |
| U6 | 포크너 뉴올버니 출생지 누락 (좌표 불확실로 의도적 생략) | accepted-as-is |
| U7 | 페소아 원고 매수 서술 회피 | accepted-as-is |
| U8 | 무질에 cambridge-companions 인용 적절성 | open |
| J* | JUDGMENT 11건 — 대표좌표 3건·periods 확장·페소아 anchorYear 1914·독서순서 난도순 등 | 정독 시 확인 |

미참조 출처 `src--kafka-letters-felice`: 관계 배치(도스토옙스키→카프카)에서 해소 예정.

## rel-late-postmodern (보고 모델: claude-opus-5[1m] 선언값) — 에러 0 · 관계 58

- open: 룰포→마르케스 회고 산문 표제(최대) · 제발트 카프카 논문 서지 · SFWA 렘 사건의
  르 귄 대응 형태 · 모리슨 석사논문 표제 · 칼비노 울리포 가입 연도.
- JUDGMENT 수용: 허스턴→모리슨 affinity+본인 부인 명시(워커 1975 출처) · 나보코프→핀천
  scholarly 강등(베라 필적 증언만) · 렘↔르 귄·르 귄↔애트우드 dialogue 판정 · 2차 문헌 출처
  2건 등록(scholarly 실명 요건 해석 — 수용, 가이드 §3의 합리적 해석).
- 결손: 이 17인의 translation·mentorship 후보가 코퍼스 안에 전무(그라스·스턴·세르반테스·
  딕·디포·파베세·프라이 등) — 확장 슬레이트 최우선 근거.

## rel-early-canon (보고 모델: claude-opus-5[1m] 선언값) — 에러 0 · 관계 48

- **병렬 충돌 2건 에이전트 자가 해소**: ① 타고르↔예이츠 — periphery의 mentorship 판 존치
  (자기 dialogue 판 미기입; 오케스트레이터 판정: mentorship이 타입 정의 정합 → 유지 확정)
  ② 스타인 자서전 출처 — midcentury-west의 id 재사용으로 dedupe 완료(위 TODO 해소됨).
- **방법 발견 기록**: 소유권 규칙의 구멍 — 타입 선택이 방향을, 방향이 소유를 뒤집어 같은
  사실을 두 배치가 합법 주장 가능. v1은 실충돌 0으로 통과; v2 규칙 개정 후보.
- open: 보들레르→니체(유고 근거 — 확신 최저, 기각 후보) · 울프 『스타브로긴의 고백』 공역
  여부(레너드 혼동 위험) · 만 에세이 연도들 · 체호프→맨스필드 「지친 아이」 1910.
- JUDGMENT 수용: 톨스토이↔도스토옙스키 contrast+"만난 적 없다" 명시 · 체호프→만 기각
  (weight 하한이 과대평가 유발 — 밴드 규칙의 올바른 역사용) · 바벨 0 유지(고리키·모파상
  부재) · 콘래드 1897 소설 제목 회피(비하어) — 전부 정직.

## rel-midcentury-west (보고 모델: claude-opus-5[1m] 선언값) — 에러 0 · 관계 49

- **TODO(병합)**: `src--stein-autobiography-toklas`(이 배치) ↔ `src--stein-autobiography-toklas-1933`(rel-early-canon) 동일 문헌 — 양 배치 착지 후 하나로 통합.
- open: 베케트 「…but the clouds…」 BBC 방영 연월 · 시지프 부록 1942 초판 수록 여부(요약
  에서 의도적 배제 — 정직) · 첼란 디킨슨 번역 서지 · 파리 리뷰 대담 특정 2건 · 츠베타예바
  제사 출처 시 특정.
- JUDGMENT 수용: 명시적 공격=contrast+scholarly(나보코프↔도스토옙스키·오웰↔톨스토이) ·
  헤밍웨이→카뮈 scholarly 유지(사르트르 경유 명시) · 울프→보부아르 강등 · 베케트↔뒤라스
  기각(문서 없이 접촉 확실 = editorial로 쓰면 왜곡이라는 판단 — 정확) · 로스 프로필 출처
  구분(권투 비유 의도적 배제).
- 결손: 리처드 라이트(최대) · 만델슈탐(첼란 최강 translation 간선 소실) · 사르트르 ·
  자먀틴 · 폴란드 전후 시 전체.

## rel-periphery-early (보고 모델: claude-opus-5[1m] 선언값) — 에러 0 · 관계 33

- open (documented 서지 세부): 타고르→아흐마토바 번역 판본(최대 검증 필요) · 츠베타예바
  로르카 번역 시편 목록(차순위) · 소세키 1916-02 편지 일자 · 『現代日本小說集』 수록작 ·
  카네티 회고록 3건 장쪽. 주장 자체는 전부 실존 문서 지목 — 세부만 미기입.
- JUDGMENT 수용: 예이츠→타고르 mentorship(편집자적 후원) · 타고르→한용운 scholarly 강등
  (김억 경유 명시) · 카프카→헤다야트/슐츠 영향 엣지 기각(연대기·본인 거리두기) · 이상↔김소월
  무관계 유지 · 바예호 documented 0(연하 소유권 이전 — 구조적).
- 소유권 33/33 기계 확인(생몰년 실측) — 위반 0.
- 결손: 루쉰←고골 · 아크메이즘 내부(푸시킨·구밀료프·만델시탐) · 김소월←김억 · 파스테르나크.

## rel-global-south (보고 모델: claude-opus-5[1m] 선언값) — 에러 0 · 관계 45

- open: U9 리스펙토르 맨스필드 『행복』 일화의 출처 지면(최대 검증 필요 documented) ·
  보르헤스 카프카 서문 1938 판본 · 울프 번역 Editorial Sur 연도(+올란도 번역 모친 관여
  학계 논의 — 요약 미반영, QC 판단 대기) · 네루다-바예호 첫 대면 연대.
- JUDGMENT 수용: 카프카→보르헤스 influence(번역 귀속 쟁점 회피 — 정확) · 보르헤스↔네루다
  contrast+냉담 명기 · 살리흐↔아체베 affinity(반대항 아님) · 아체베→응구기 mentorship+
  contrast 2간선.
- 구조적 결손 기록: 세제르 유입 간선 0(브르통·상고르·파농 코퍼스 밖) · 코르타사르 1간선.

## rel-asia-mid (보고 모델: claude-opus-5[1m] 선언값) — 에러 0 · 관계 30

- **QC 실측 수리 1건**: `dialogue--kobo-abe--kenzaburo-oe` — 에이전트 자기 표시 최대 위험
  항목을 노벨 강연 전문(nobelprize.org, 192KB)으로 검증. **아베 언급 0회** (가와바타 13·
  와타나베 12·예이츠 8) → 에이전트 지정 수리 절차대로 scholarly_consensus 강등·요약 재작성·
  weight 0.8→0.6. 같은 검증이 `influence--wb-yeats--kenzaburo-oe`의 documented는 확증.
- 오더 시드 오류 1건을 생성기가 적발: 다자이↔미시마 "1955년경 대면"은 두 문서의 혼동
  (대면=1946년 말 전승, 1955=『소설가의 휴가』 활자 비판) — 요약에서 분리 기록됨.
- open: documented 근거 문서의 서지 세부 5건(전집 권수·게재지명·출판사) — 주장 자체는
  본문 실명, 세부만 미기입. 수용.
- 코퍼스 밖 결손 기록: 나라얀←그린(mentorship 성립 불가 — **나라얀 documented 간선 0**),
  오에←사르트르/와타나베, 만토 번역 간선들, 가와바타←요코미쓰, 박경리 한국 문단 간선 0.
  → 확장 슬레이트 근거 데이터.

## mid-south-b (보고 모델: claude-opus-5[1m] 선언값) — 에러 0 첫 실행

핵심 open 항목: 응구기 deathYear 2025-05-28 확인 · 살리흐 birthYear 1929(1928/1931 병존) ·
좌표 5건(오기디·바스푸앵트·이페·리무루·카르마콜→카르툼 대체) · 직역 titleKo 13건 국내 판본
대조 · 활자화 연도 5건 · activeRange 끝점 3건. JUDGMENT 11건(마푸즈 realism 단독 배정,
regions 이주 규칙, 희곡 year=초연 등)은 정독 시 확인.

## late-b (보고 모델: claude-opus-5[1m] 선언값) — 에러 0 첫 실행

핵심 open: titleKo 고위험 3건(와일드 시드/새벽/서클 게임) + 중간 확신 다수 · 제발트 베르타흐
좌표 · 버틀러 activeRange 시작 1976 · 애트우드 끝 2023 · 이시구로 수상명 · companions 4권
실재 여부 · paris-review 5건. JUDGMENT: 이시구로 east-asia 미배정·작가 speculative 태그 제외
(작품 태그만) · 애트우드 SF 사양 기록(src--atwood-in-other-worlds) · 생존 작가 5명 보수 서술.

## mid-south-a (보고 모델: claude-opus-5[1m] 선언값) — 에러 0 첫 실행

핵심 open: 룰포 생년 1917(자기보고 1918 병존) · 소도시 좌표 4건 · titleKo 미확인 다수
(팔방치기 등) · 기관 도메인 3건(cervantesvirtual/memoriachilena/academia.org.br) 확인.
JUDGMENT: 스페인어권 modernism 미배정(modernismo false friend — 정확한 판단) · 브라질은
배정 · 카르펜티에르 magical-realism 배정 논리 · 룰포 activeRange 1945–1958 · 코르타사르만
boom. 정독 시 확인.

## mid-west-b (보고 모델: claude-opus-5[1m] 선언값) — 에러 0 첫 실행

핵심 open: 허스턴 1891(자기보고 1901/03 병존) · 엘리슨 1913(1914 병존) · titleKo 직접 표기
다수 · paris-review 인터뷰 2건 실존 · 노타설가·사덱 좌표. JUDGMENT: 볼드윈 primary=할렘
(파리 아님, 오독 방지 논리) · 시네로망 2건 drama 분류 · 뒤라스 anchorYear 1964 · 심보르스카
central-europe. 정독 시 확인.

## roots (보고 모델: claude-opus-5[1m] 선언값) — 에러 0 첫 실행

핵심 open: 수치류(디킨슨 1890 시집 115편·생전 발표 편수·전체 편수 판본차, 휘트먼 초판
12편/95쪽, 마샤두 160장, 니체 아포리즘 296) · 실스마리아/야스나야 폴랴나/옴스크 좌표 ·
마샤두·휘트먼·디킨슨 직역 titleKo · 톨스토이 파문 인과 강도 · 제임스 자기평가 원문.
JUDGMENT: early-modernism 추가는 체호프·제임스·콘래드만 · 디킨슨 activeRange=창작기간
1858–1886(발표 아님) · 콘래드 en 단독+central-europe · 입센 no 표기(da 부재) · 디킨슨
서한집 장르 불일치 QC 판정 대상 · 1955 존슨판은 사후 60년 검사로 등재 불가(경계 동작 확인).
절차 위반 자기보고 1건: git status 1회 실행(읽기 전용).

## early-west-b (보고 모델: **실측 claude-opus-5** — 트랜스크립트 JSONL 31턴 전수 확인) — 에러 0

에이전트가 세션 중 외부 확인한 사실 12건 명시(개심장 1968/거장 1966-67 등 — QC 재확인
불요). 핵심 open: 바벨 『일몰』 1927 초연 기준 · 시에르/뮈조 좌표 · titleKo 신규 조어 4건 ·
바벨 사망일 표기 정책(1940-01-27 vs 소련 공식 1941). JUDGMENT: 피란델로 파시스트당 입당
미기재(형식 중심 원칙 — 기록된 결정) · 스타인 lost-generation 포함(명명자) · 로르카
modernism(27세대 부재 근사) · 불가코프 speculative 부여.

## early-east-asia (보고 모델: claude-opus-5[1m] 선언값) — 에러 0

핵심 open: **김소월 「초혼」·「산유화」 1925 시집 연도(잡지 선발표 여부가 최대 위험)** ·
타고르 『고라』 1910 단행본 기준 · 루쉰 『들풀』 1927 · 프렘찬드 「수의」 1935/36 ·
정주 좌표·김소월 출생지 행정구역 · 프렘찬드 titleKo 국내 표기 · 사후 발표 3건 지면.
JUDGMENT: movements 7명 공란(서구 지부 서술 거부 — 의도적) · 루쉰 primary=베이징 ·
한용운 zh 미포함(한문≠중국어) · 이상 ja 포함 · 한용운 연재소설 제외(작품 4편) ·
소설집 대신 수록작 개별 등재(루쉰).

## early-east-europe (보고 모델: claude-opus-5[1m] 선언값) — 에러 0

핵심 open: 슐츠 1934 판권장 · 바예호 1919 배포 기준 · 헤다야트 1936/37 봄베이판 ·
츠베타예바 「끝의 시」 1926 프라하 · 고위험 titleKo 다수(직역) · 산티아고데추코 좌표 ·
수치류(트릴세 77편 등). JUDGMENT: regions 출신 문화권 단일 통일 · 바예호 primary=리마
(파리 반론 성립 명시) · 아흐마토바 『영웅 없는 서사시』 연도 미확정으로 의도적 제외(공백) ·
브로흐 3부작 단일 등재.

## late-a (보고 모델: claude-opus-5[1m] 선언값) — 에러 0

핵심 open: 쿤데라 체코어 초판 연도(웃음과 망각 1981·참을 수 없는 1985 — 원어 초판 규칙
적용) · 아라카타카/아지냐가/빌라르드랑 좌표 · 렘 titleKo 국내 출간 여부 · 마르케스 1927
(1928 병존 이력) · 사라마구 재단 URL 미기입(날조 금지 준수). JUDGMENT: 모리슨·쿤데라·렘·
사라마구 movements 공란(각 사유 기록) · 칼비노 postmodernism+oulipo, 페렉 oulipo만 ·
핀천 거주지 비기재 원칙 · 사라마구 activeRange 1977 시작(본인 부정 데뷔작 제외).

## mid-asia (보고 모델: claude-opus-5[1m] 선언값) — 에러 0

핵심 open: 『설국』 1935 연재 기준 · 학·산소리 1949 동시 · 「색, 계」 1979 · 만토 재판
횟수 '여러 차례' 완화 · 박경리 신인상·연재 매체 미검증 · 가나기·오세 좌표 · 만토 출생지
삼랄라 좌표 불확실로 미기재. JUDGMENT: 아베 absurdism(편집 판단 명시) · 만토 라호르
role=activity(망명 규정 회피) · 박경리 primary=원주 · 한국 작품 titleOriginal=한글 ·
나라얀 difficulty 1.

핵심 open 항목: 드레안·모티하리 좌표 근사 · titleKo 병존 표기 6건 · 카뮈 실존주의 부인
인터뷰 1945-11 월 단위 · 베케트 activeRange 시작 1929. JUDGMENT: 카뮈 대표좌표=알제(파리
아님, QC 뒤집기 후보로 명시) · 나보코프 이타카 primary·몽트뢰 제외 · 첼란 movements 0 ·
진입작 접근성 기준 2건(프닌·처녀 회상). 정독 시 확인.

## QID 백필 (2026-08-15, 오케스트레이터 직접 집행 — 세션 #2)

`qc:backfill-qids` 신설·실행: **100/100 해소, 미해결 0.** 매칭 래더 = ① 생몰년 정확 일치
(생존 작가 7명은 WD 사망 클레임 부재 요구) ② 생년 ±1 + 몰년 정확(관용, `~` 표시). 관용
매치는 정확히 1건 — **ralph-ellison Q299965** (data 1913 vs WD 1914): 위 '엘리슨 생년'
분쟁 항목 그대로, record-not-resolve 유지. 이후 `qc:crosscheck-dates`를 저장 QID 직조회로
전환해 재실행: **99 일치 · 1 불일치(엘리슨) · 이름검색 폴백 0** — 원 QC 결과의 결정적 재현.
불변식 추가: `reviewed` 이상은 `externalIds.wikidata` 필수 · QID 중복 차단. 생성기는 이
필드를 기입하지 않는다(editorial-guide §2 — QID 기억은 신뢰 불가 실측).

## EN 번역 웨이브 (2026-08-15, 세션 #2 — 19기 병렬, 전원 claude-sonnet-5 자기보고)

**903/903 전 항목 커버리지** (작가 100 · 작품 512 · 관계 263 · 운동 19 · 투어 9/노트 66) —
패리티 기계검증 누락·초과·중복 0, `reviewed`-로케일 완전성 불변식 그린. 계약
(`docs/translation-guide.md`): 번역≠리서치·새 사실 금지·근거 어조 보존·확립 영어 제목만.
정독 샘플 3/3 클린(카프카 프로필·프루스트↔무질 affinity 헤지·투어 노트 — (34) 미러).
특기: mid-south-b 생성기가 자기 드리프트 4건 자가 적발·수정 후 보고, 다수 에이전트가
선착 배치를 하우스 스타일 선례로 교차 참조(따옴표·별칭 규칙 수렴), rel-midcentury-west는
악령을 자체 판단 대신 **프로젝트 캐논("Demons")에 맞춤**.

**UNCERTAIN 원장 (에이전트 자기보고 합산 ~60건, 3분류):**
1. **경쟁 확립 제목 중 택일(~30)** — The Stranger/Outsider · Coming of Age/Old Age ·
   Demons/Possessed(캐논=Demons) · Death with Interruptions/at Intervals · Good
   Woman/Person of Setzuan · A/The Madman's Diary · Burning Plain/Plain in Flames ·
   Children of the Alley/Gebelawi · Prize Stock/The Catch 등 — 전부 실존 출판 제목,
   선택 근거 트랜스크립트에 기록.
2. **확립 영어 제목 부재 → 로마자/원제 유지(~25)** — 쉼보르스카 시집 4 · 이상 3 ·
   김소월 4 · 한용운 3 · 코르타사르 초기 단편집 3 · 박경리 2 · 아베 『벽』 · 다자이
   『만년』 · 오에 3부작 · 첼란 Sprachgitter 등. **최우선 검토 1건: 『님의 침묵』**
   ("Nimui Chimmuk"로 유지 — "The Silence of Love" / "Everything Yearned For" 두
   경쟁 출판 번역 실재, 편집 판단 필요).
3. **운동 명칭 2** — 구인회 "Guinhoe"(Kuinhoe/Circle of Nine 대안), 신감각파
   "New Sensationism"(Neo-Perceptionism 등 통용 변이).

**기지 불일치 1건(비차단, v1.1 편집 패스行)**: 기마랑이스 호자 대표작 — works 캐논은
유일 출판 영역 "The Devil to Pay in the Backlands", rel-global-south 요약 3곳은 최근
학계 관행대로 "Grande Sertão: Veredas" 유지(해당 에이전트가 근거와 함께 플래그).
둘 다 실재 표기라 오류 아님; 통일 방향은 편집 결정으로 남김.
