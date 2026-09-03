# 백엔드 설계 — 이미 쓰는 것 위에 (2026-09-03, 결정 (136) 초안)

CPO: *"내가 이미 이용 중인 서비스 위주로 고려해서 설계해."*

## 0. 먼저 목적지 한 줄

> 한국어 독자가 **어느 기기에서 열어도 같은 도감**(모르는→관심→펼쳐본→구매한→읽은)을
> 갖고, 기기를 바꾸거나 브라우저를 지워도 **잃지 않으며**, 언젠가 다른 독자들의 도감이
> 합쳐져 **다음 책을 추천받는** 도구.

이 세 절(동기화 · 복구 · 교차 사용자 신호)이 백엔드가 존재하는 이유의 전부다.
그 밖의 것(프로필·팔로우·댓글·소셜)은 이 설계에 없다.

## 1. 실측 — 사장님이 이미 쓰는 것

| 서비스 | 실제 상태 (2026-09-03 조회) | 이 설계에서의 역할 |
|---|---|---|
| **Cloudflare Pages** | `literary-planet` (현 배포) · `damienmusica`(damienmusica.com 커스텀 도메인) | 정적 616쪽 그대로. **변경 없음** |
| **Cloudflare Workers** | 5개 운영 중 — `damien-admin`(Basic Auth + R2), `now-ml-push`(cron → Supabase RPC → Toss 발송, **mTLS 인증서 바인딩 보유**), `lashhill-assets`, `wtfisgoingon`×2 | 필요 시 cron·mTLS 경계만. 이 설계의 API 층은 **Workers 가 아니라 Supabase** |
| **Cloudflare R2** | `damien-assets`, `lashhill-assets` | 해당 없음(도감은 텍스트) |
| **Cloudflare Email Routing** | damienmusica.com 에 활성 | 발신은 아님. 매직링크 메일은 Supabase 가 보낸다 |
| **Supabase** | 프로젝트 1개 `ianojiicjdskogzjeuqw`, ap-southeast-1, Postgres 17, **free 플랜**, **Email 인증 켜짐**(OTP/매직링크 경로 존재, `mailer_autoconfirm=false`), 익명 로그인 꺼짐, OAuth 전부 꺼짐, SMTP 미설정(Supabase 기본 메일러). `public` 에 **다른 앱 5개의 테이블 21개**가 이미 산다(now-ml·스케줄포탈·체스·크레·한숨) | **신원 + 저장소 + API.** 사장님 코드베이스의 확립된 패턴: 클라 → Edge Function(service role) → RPC, RLS on + 정책 없음 |
| **Apps in Toss** | 워크스페이스 `Lashhillapps`(56431), OPEN 미니앱 3(오늘의 크레·날씨력 측정기·체스 오프닝북), 대기 4. now-ml 은 `getAnonymousKey()` 로 사용자를 식별 | **2단계 유통 채널.** 1단계에는 없다 |
| GitHub | `damienmusica/one-book` 공개 | 소스·CI |

## 2. 결정

### 신원: Supabase Auth, 이메일 매직링크 하나

- 비밀번호 없음. 이메일 입력 → 링크 클릭 → 끝. 사장님 프로젝트에 **이미 켜져 있는** 방식이다.
- 왜 익명 세션이 아닌가: 익명 세션은 "이 브라우저"를 식별하지 "이 사람"을 식별하지 않는다.
  목적지의 두 절(기기 간 동기화·복구)이 곧 "이 사람"을 요구한다. 그리고 이 프로젝트에는
  익명 로그인이 꺼져 있다 — 켜지 않는다.
- 왜 소셜 로그인이 아닌가: 프로젝트에 OAuth 가 하나도 없고, 카카오·구글은 각각 앱 등록·심사·
  키 관리가 붙는다. 매직링크는 그 비용이 0이다. 필요해지면 나중에 켠다(Supabase 는 한 계정에
  여러 provider 를 붙일 수 있다).
- **로그인 없이도 전부 동작한다.** 도감은 지금처럼 localStorage 에 먼저 쓰이고, 로그인하면
  그 시점에 서버로 **합쳐진다**(아래 §4). 로그인은 "잃지 않기 위한" 선택이지 관문이 아니다.

### 저장소: 같은 Supabase 프로젝트, 별도 스키마 `book`

- 새 프로젝트를 파지 않는다 — free 플랜은 프로젝트 2개 상한이고, 하나는 이미 5개 앱이 쓰는
  운영 프로젝트라 두 번째 슬롯을 여기에 쓰면 사장님의 다음 앱이 갈 곳이 없다.
- `public` 에 섞지 않는다 — 21개 테이블이 이미 이름 공간을 쓰고 있다. **Postgres 스키마
  `book`** 하나로 격리한다. 이름 충돌 0, 권한 경계 명확, 나중에 프로젝트를 분리해야 하면
  `pg_dump -n book` 한 줄이다.

### API: Edge Function 한 개, RPC 여섯 개

now-ml 의 패턴을 그대로 쓴다 — 클라는 REST 를 직접 부르지 않고 Edge Function 을 부르고,
Edge 가 service role 로 RPC 를 대신 부른다. **다른 점 하나**: now-ml 은 익명키였지만 여기는
로그인 사용자라, Edge 는 `Authorization: Bearer <user JWT>` 를 검증해 `auth.uid()` 를 얻고
그 값으로만 RPC 를 부른다. RLS 는 켜고 정책은 없다(now-ml 과 동일 — service role 만 통과).

### 유통 2단계: Toss 미니앱 — **지금 아니다**

- 사장님이 이미 쓰는 채널이고 OPEN 앱이 셋이라 언젠가 자연스럽다. 그러나 Toss 표면은 **토스
  앱 안에서만** 돈다. 지금 제품은 공개 웹이다.
- `getAnonymousKey()` 는 미니앱 안에서 사용자별로 안정적이지만 **외부 계정에 연결할 수 없다**
  (토스 개발자 커뮤니티 공식 답변: *"토스 로그인을 사용하는 경우 맵핑할 수 있으나,
  getAnonymousKey() 만 사용하셨다면 불가합니다."*). 도감이 토스 안팎에서 하나여야 하므로
  토스 진입은 **토스 로그인 → Supabase 계정 연결**이어야 하고, 그건 토스 로그인 약관·심사가
  붙는 별도 라운드다.
- 그래서 지금 설계가 준비하는 것은 한 칸뿐이다: `book.identities(user_id, provider, provider_key)`
  — 나중에 토스 신원 한 행을 넣으면 같은 사람이다. 토스 문서(신원 이관 가이드)는 파트너가
  `hash`(익명키) 와 `authorizationCode`(토스 로그인) 를 받아 **자기 서버에서 맵핑**하는
  형태(`/api/auth/migration/link`)를 정식 패턴으로 적고 있으므로, `provider` 는 `toss-userkey`
  와 `toss-hash` 둘을 받는다. 공식 문장 그대로: 익명키는 *"같은 미니앱 안에서 동일한 사용자에게
  항상 같은 값"*, 서버 검증은 `POST /api-partner/v1/apps-in-toss/users/anon-key/verify` 에
  **mTLS 필수** — 사장님 `now-ml-push` 워커에 그 인증서가 이미 바인딩돼 있다.

## 3. 스키마 (`book`)

```sql
create schema if not exists book;

-- 도감 한 칸: 사용자 × 작품 → 현재 상태. 「모르는 책」은 행이 없는 것이다 — 저장하지 않는다.
create table book.marks (
  user_id     uuid not null references auth.users(id) on delete cascade,
  work_id     text not null,                       -- one-book 작품 id (예: franz-kafka--die-verwandlung)
  state       text not null check (state in ('want','opened','have','read')),
  at          timestamptz not null default now(),  -- 이 칸에 오른 시각
  primary key (user_id, work_id)
);
create index on book.marks (user_id, at desc);

-- 전이 이력: 사다리를 오르내린 기록. 레터박스드가 whenAddedToWatchlist/whenCompleted 를
-- 둘 다 남기는 이유와 같다 — 1년 된 「관심」과 어제의 「관심」을 나중에 구분할 유일한 방법.
create table book.mark_events (
  id       bigint generated always as identity primary key,
  user_id  uuid not null references auth.users(id) on delete cascade,
  work_id  text not null,
  state    text,                                   -- null = 「모르는 책」으로 되돌림
  at       timestamptz not null default now()
);
create index on book.mark_events (user_id, at desc);

-- 외부 신원 연결 자리. 지금은 비어 있다. 나중에 toss userKey 가 여기 온다.
create table book.identities (
  user_id       uuid not null references auth.users(id) on delete cascade,
  provider      text not null check (provider in ('toss-userkey','toss-hash')),
  provider_key  text not null,
  linked_at     timestamptz not null default now(),
  primary key (provider, provider_key),
  unique (user_id, provider)
);

alter table book.marks        enable row level security;
alter table book.mark_events  enable row level security;
alter table book.identities   enable row level security;
-- 정책 없음: anon/authenticated 직접 접근 0. Edge(service role)만 통과. now-ml 과 같은 규율.
```

**저장하지 않는 것**: 이메일 외 프로필, 이름, 기기 정보, 열어본 페이지, 클릭. `auth.users`
가 이메일을 갖고 우리는 `user_id` 만 참조한다. 최소 수집을 스키마로 못 박는다 — now-ml
`push_subscribers.sql` 의 규율과 같다.

**RPC 여섯 개** (`security definer`, `search_path = book`):
`mark_set(work_id, state)` · `mark_clear(work_id)` · `marks_all()` · `marks_merge(jsonb)`(§4) ·
`events_since(ts)` · `account_export()`(§5).

## 4. 동기화 규칙 — 합치되 덮어쓰지 않는다

1. **로컬이 먼저**다. 페이지는 지금처럼 `localStorage(lp.reader.v3)` 를 읽고 쓴다. 서버가
   죽어도, 로그인 전이어도, 도감은 동작한다.
2. 로그인 순간 `marks_merge(로컬 전부)` 를 한 번 부른다. 충돌 규칙은 **작품마다 `at` 이 늦은
   쪽이 이긴다** — 마지막으로 그 책에 대해 생각을 바꾼 기록이 진실이다. 삭제(모르는 책으로
   되돌림)도 `at` 을 가진 이벤트라 같은 규칙으로 판정된다.
3. 이후 매 변경은 로컬에 쓰고 **즉시** 서버에 쓴다(`mark_set`/`mark_clear`). 실패하면 로컬에
   `pending` 표시를 남기고 다음 로드에서 재시도한다. 큐가 아니라 상태다 — 같은 작품의 마지막
   상태 하나만 보내면 되니까.
4. 다른 기기에서 로그인하면 `marks_all()` 을 받아 로컬과 같은 규칙으로 합친다.
5. **사파리 7일 삭제 문제는 여기서 닫힌다**: 로컬이 지워져도 서버에 있다. 성공 문장의 뒷
   절("일주일 뒤 스스로 돌아온다")이 처음으로 측정 가능해진다 — `auth.users.last_sign_in_at`
   과 `mark_events.at` 이 그 계기다. 전송은 있지만 **행위 로그가 아니라 도감 자체**다.

## 5. 정직성·프라이버시 — 데이터 주장에만, 그러나 그건 지킨다

- 독자에게 보이는 문장: "로그인하면 이 도감을 다른 기기에서도 열 수 있고, 브라우저를 지워도
  남습니다. 저장되는 것은 **어떤 책을 어느 칸에 두었는가**와 그 시각뿐입니다." — 이 문장은
  스키마와 1:1 로 대응해야 하고, 어긋나면 스키마가 아니라 문장을 고친다.
- `account_export()` 는 내 도감 전부를 JSON 으로 돌려준다. `account_delete` 는 Supabase 의
  사용자 삭제 = `on delete cascade` 로 전부 사라진다. 소프트 삭제 없음.
- 교차 사용자 신호(추천기)는 **이 설계의 범위 밖**이다. 여기서 준비하는 것은 그 신호가 나올
  자리(`marks`)뿐이다. 추천기를 켜기 전에 "다른 독자들의 도감이 당신의 추천에 쓰입니다"에
  동의를 받는 별도 결정이 필요하다 — 결정 (137) 후보.

## 6. 비용·한도 — free 플랜에서

| 항목 | 한도 | 이 제품 |
|---|---|---|
| Supabase Auth 기본 메일러 | **시간당 약 3~4통** (커스텀 SMTP 없이) | 매직링크 = 로그인 1회당 1통. 낯선 5인 테스트에는 충분. **독자 수십 명이 되는 날 SMTP 를 붙인다** — Cloudflare Email Routing 은 수신 전용이라 발신은 Resend/Postmark 류 하나가 필요. 그 전까지는 한도가 곧 규모의 신호다 |
| Edge Function 호출 | 월 50만 | 표시 1회 = 1호출. 넉넉 |
| DB 500MB | — | 행 하나 ≈ 100B. 독자 1만 명 × 100권 = 100MB |
| 프로젝트 일시정지 | 무료 프로젝트는 **7일 비활성 시 정지** | now-ml cron 이 매일 두드려서 이미 살아 있다 — 이 위험은 공유 프로젝트라서 오히려 없다 |

## 7. 무엇을 하지 않는가

- Cloudflare D1/KV/Workers 에 새 API 를 세우지 않는다 — Supabase 가 이미 신원·DB·함수를 갖고
  있고 사장님 코드가 그 패턴으로 짜여 있다. 두 벤더에 같은 층을 두 번 두지 않는다.
- 별도 Supabase 프로젝트를 파지 않는다(§2).
- 소셜 로그인·프로필·팔로우·댓글·공개 도감을 만들지 않는다. 목적지 세 절에 없다.
- Toss 를 1단계에 넣지 않는다. 자리(`identities`)만 남긴다.
- 추천기를 이 설계에 넣지 않는다. 자리(`marks`)만 남긴다.

## 8. 첫 라운드 (짓기 전 결재 대기)

1. `book` 스키마 + RPC 6 — SQL 한 파일, Supabase SQL Editor 1회 실행(now-ml 방식).
2. Edge Function `book` 하나 — JWT 검증 → RPC. now-ml `push/index.ts` 를 본으로 60줄.
3. 정적 페이지에 로그인 한 줄("이메일로 이 도감 지키기") + 상태 사다리에 서버 쓰기 훅.
4. 합치기 규칙(§4)의 유닛 계약 — 늦은 `at` 이 이긴다 · 삭제도 이벤트다 · 서버 실패 시 로컬 보존.
5. **실제 아이폰으로 7일 실측** — 로컬을 지운 뒤 로그인해 도감이 돌아오는가. 이게 이 라운드의
   유일한 성공 지표다.

측정 불가인 것은 측정 불가라고 적는다: 이 라운드는 "몇 명이 로그인하는가"를 재지 않는다.
재는 것은 "로그인한 사람의 도감이 살아남는가" 하나다.

---

**결재 필요**: §2 신원 방식(매직링크) · 스키마 격리 방식(같은 프로젝트, `book` 스키마) ·
Toss 는 2단계. 셋 다 승인이면 첫 라운드를 시작한다.

## 참고 — 토스 공식 문서 (2단계 착수 시 읽을 것, 지금 읽지 않는다)

이번 설계에서 확인한 사실은 둘뿐이고, 둘 다 위 §2 에 반영됐다: (a) `getAnonymousKey()` 는
미니앱마다 고유하고 같은 사용자는 항상 같은 값을 받는다(토스 블로그 「토스 로그인, 꼭
붙여야 할까요?」), (b) 익명키만으로는 다른 신원과 맵핑할 수 없고 토스 로그인이면 가능하다
(개발자 커뮤니티 공식 답변). 나머지 — 로그인 흐름·토큰 교환·mTLS·제공 개인정보 항목 — 는
2단계의 일이다.

- 토스 로그인: https://developers-apps-in-toss.toss.im/documentation/common/authentication/toss-login.md
- 익명 키(해시 키): https://developers-apps-in-toss.toss.im/documentation/common/authentication/hash-key.md
- 신원 이관 가이드: https://developers-apps-in-toss.toss.im/guide/authentication/migration.md
- 사용자 정보 동의 항목: https://developers-apps-in-toss.toss.im/guide/authentication/user-info.md
- 서버 API — 사용자 키: https://developers-apps-in-toss.toss.im/api/user-key.md
- 블로그 「토스 로그인, 꼭 붙여야 할까요?」: https://toss.im/apps-in-toss/blog/toss-login-vs-anonkey
