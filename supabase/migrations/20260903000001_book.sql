-- 하나의 책 — 도감 저장소. 결정 (136), docs/backend-design.md.
--
-- 이 프로젝트(ianojiicjdskogzjeuqw)는 다른 앱 5개와 공유한다. 그래서 `public` 에 손대지
-- 않고 스키마 `book` 하나로 격리한다. 분리해야 하는 날은 `pg_dump -n book` 한 줄이다.
--
-- 접근 모델은 now-ml 과 다르다: now-ml 은 신원이 없어(토스 익명키) service role + Edge 로
-- 우회했지만, 여기는 Supabase Auth 사용자다. 그래서 **정석**을 쓴다 — 브라우저가 anon 키 +
-- 사용자 JWT 로 PostgREST 를 직접 부르고, RLS 가 `user_id = auth.uid()` 로 지킨다.
-- anon 키는 공개 설계다. 지키는 것은 키가 아니라 아래 정책이다.

create schema if not exists book;

-- 도감 한 칸: 사용자 × 작품 → 현재 상태. 「모르는 책」은 행이 없는 것이다 — 저장하지 않는다.
create table if not exists book.marks (
  user_id  uuid        not null references auth.users(id) on delete cascade,
  work_id  text        not null check (work_id ~ '^[a-z0-9-]+--[a-z0-9-]+$'),
  state    text        not null check (state in ('want','opened','have','read')),
  at       timestamptz not null default now(),
  primary key (user_id, work_id)
);
create index if not exists marks_user_at on book.marks (user_id, at desc);

-- 전이 이력. 레터박스드가 whenAddedToWatchlist 와 whenCompleted 를 둘 다 남기는 이유와
-- 같다 — 1년 된 「관심」과 어제의 「관심」을 나중에 구분할 유일한 방법. state null = 되돌림.
create table if not exists book.mark_events (
  id       bigint generated always as identity primary key,
  user_id  uuid        not null references auth.users(id) on delete cascade,
  work_id  text        not null,
  state    text        check (state is null or state in ('want','opened','have','read')),
  at       timestamptz not null default now()
);
create index if not exists mark_events_user_at on book.mark_events (user_id, at desc);

alter table book.marks       enable row level security;
alter table book.mark_events enable row level security;

-- 정책: 자기 행만. anon(비로그인)은 어느 정책에도 걸리지 않아 0행이다.
drop policy if exists marks_own_select on book.marks;
drop policy if exists marks_own_write  on book.marks;
create policy marks_own_select on book.marks for select to authenticated using (user_id = auth.uid());
create policy marks_own_write  on book.marks for all    to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists events_own_select on book.mark_events;
drop policy if exists events_own_insert on book.mark_events;
create policy events_own_select on book.mark_events for select to authenticated using (user_id = auth.uid());
create policy events_own_insert on book.mark_events for insert to authenticated with check (user_id = auth.uid());

grant usage on schema book to authenticated, anon;
grant select, insert, update, delete on book.marks       to authenticated;
grant select, insert                 on book.mark_events to authenticated;
grant usage, select on all sequences in schema book to authenticated;

-- 상태 변경 한 번 = marks 갱신 + 이벤트 1행. 클라가 두 번 부르지 않게 함수 하나로 묶는다.
-- security invoker: 호출자의 RLS 그대로. user_id 는 인자로 받지 않는다 — auth.uid() 만.
create or replace function book.mark_set(p_work_id text, p_state text, p_at timestamptz default now())
returns void language plpgsql security invoker set search_path = book, pg_temp as $$
begin
  if p_state is null then
    delete from book.marks where user_id = auth.uid() and work_id = p_work_id;
  else
    insert into book.marks (user_id, work_id, state, at) values (auth.uid(), p_work_id, p_state, p_at)
    on conflict (user_id, work_id) do update set state = excluded.state, at = excluded.at
    where excluded.at >= book.marks.at;            -- 늦은 시각이 이긴다 (합침 규칙과 동일)
  end if;
  insert into book.mark_events (user_id, work_id, state, at) values (auth.uid(), p_work_id, p_state, p_at);
end $$;

-- 로그인 순간 로컬 도감 전부를 한 번에 합친다. 작품마다 `at` 늦은 쪽이 이긴다.
-- 입력: [{work_id, state|null, at(ms epoch)}]. 반환: 합친 뒤의 서버 도감 전부.
create or replace function book.marks_merge(p_local jsonb)
returns setof book.marks language plpgsql security invoker set search_path = book, pg_temp as $$
declare r record;
begin
  for r in select * from jsonb_to_recordset(p_local) as x(work_id text, state text, at bigint) loop
    perform book.mark_set(r.work_id, r.state, to_timestamp(r.at / 1000.0));
  end loop;
  return query select * from book.marks where user_id = auth.uid();
end $$;

grant execute on function book.mark_set(text, text, timestamptz) to authenticated;
grant execute on function book.marks_merge(jsonb)                to authenticated;

-- 내 도감 전부 — 내보내기(§5). 이 함수의 결과가 곧 "저장되는 것의 전부"다.
create or replace function book.account_export()
returns jsonb language sql security invoker set search_path = book, pg_temp as $$
  select jsonb_build_object(
    'marks',  coalesce((select jsonb_agg(to_jsonb(m) - 'user_id' order by m.at) from book.marks m where m.user_id = auth.uid()), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(to_jsonb(e) - 'user_id' - 'id' order by e.at) from book.mark_events e where e.user_id = auth.uid()), '[]'::jsonb)
  );
$$;
grant execute on function book.account_export() to authenticated;
