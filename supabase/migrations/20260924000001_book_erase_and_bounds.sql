-- 독자가 자기 서버 기록을 지운다, 그리고 한 사람이 공유 DB 를 무한히 채우지 못한다 (2026-09-24 감사).
--
-- 지우기: 표시와 이벤트 이력 전부. 로그인 주소(auth.users)는 지우지 않는다 — 이 Supabase 프로젝트의 인증 저장소는
-- 운영자의 다른 서비스와 함께 쓰고, auth.users 행을 지우면 같은 주소로 로그인한 다른 서비스의 기록까지 cascade 로
-- 사라진다. 처리방침(/privacy/)이 그 요청 창구를 적는다.
drop policy if exists events_own_delete on book.mark_events;
create policy events_own_delete on book.mark_events for delete to authenticated using (user_id = auth.uid());
grant delete on book.mark_events to authenticated;

create or replace function book.account_erase()
returns void language sql security invoker set search_path = book, pg_temp as $$
  delete from book.mark_events where user_id = auth.uid();
  delete from book.marks where user_id = auth.uid();
$$;
revoke all on function book.account_erase() from public, anon;
grant execute on function book.account_erase() to authenticated;

-- 시각은 미래일 수 없다. 미래 시각의 표시는 「늦은 쪽이 이긴다」 합침에서 영원히 이긴다. 5분은 기기 시계의 오차다.
create or replace function book.mark_set(p_work_id text, p_state text, p_at timestamptz default now())
returns void language plpgsql security invoker set search_path = book, pg_temp as $$
begin
  p_at := least(p_at, now() + interval '5 minutes');
  insert into book.marks (user_id, work_id, state, at) values (auth.uid(), p_work_id, p_state, p_at)
  on conflict (user_id, work_id) do update set state = excluded.state, at = excluded.at
  where excluded.at >= book.marks.at;
  insert into book.mark_events (user_id, work_id, state, at) values (auth.uid(), p_work_id, p_state, p_at);
end $$;

-- 한 번의 합침은 5,000권까지 — 코퍼스의 작품이 4천여 편이다. 그 이상은 표시가 아니라 적재다.
create or replace function book.marks_merge(p_local jsonb)
returns setof book.marks language plpgsql security invoker set search_path = book, pg_temp as $$
declare r record;
begin
  if jsonb_typeof(p_local) <> 'array' or jsonb_array_length(p_local) > 5000 then
    raise exception 'marks_merge: expected an array of at most 5000 marks';
  end if;
  for r in select * from jsonb_to_recordset(p_local) as x(work_id text, state text, at bigint) loop
    perform book.mark_set(r.work_id, r.state, to_timestamp(r.at / 1000.0));
  end loop;
  return query select * from book.marks where user_id = auth.uid();
end $$;

-- 비로그인(anon)은 어느 함수도 부를 까닭이 없다. security invoker 라 표 권한에서 막히긴 하지만, 기본 PUBLIC 실행권을 남기지 않는다.
revoke all on function book.mark_set(text, text, timestamptz), book.marks_merge(jsonb), book.account_export() from public, anon;
grant execute on function book.mark_set(text, text, timestamptz), book.marks_merge(jsonb), book.account_export() to authenticated;
