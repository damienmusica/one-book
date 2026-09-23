-- 「모르는 책」으로 되돌림도 시각을 가진 사실이다 — 행을 지우지 않고 state null 로 남긴다.
--
-- 왜: 처음 설계는 되돌림을 DELETE 로 했다. 그러면 서버는 "되돌렸다"와 "처음 본다"를 구분하지 못해, 다른 기기의
-- 오래된 표시가 "서버에 없음"으로 보여 다시 올라왔다(되살아남). 그 DELETE 는 시각도 보지 않아서, 늦게 도착한 옛
-- 되돌림이 새 표시를 지우기도 했다(2026-09-23 코드 감사, 병합 시뮬레이션으로 재현). 클라이언트(mergeMarks)는
-- 처음부터 서버의 null 행을 되돌림으로 읽는다 — 서버만 그것을 남기면 된다.
alter table book.marks alter column state drop not null;
alter table book.marks drop constraint if exists marks_state_check;
alter table book.marks add constraint marks_state_check
  check (state is null or state in ('want','opened','have','read'));

-- 이벤트의 작품 id 도 marks 와 같은 모양만 받는다. 공유 무료 DB(500MB)에 임의 문자열을 무한히 쓰지 못하게.
alter table book.marks drop constraint if exists marks_work_id_len;
alter table book.marks add constraint marks_work_id_len check (length(work_id) <= 200);
alter table book.mark_events drop constraint if exists mark_events_work_id_check;
alter table book.mark_events add constraint mark_events_work_id_check
  check (work_id ~ '^[a-z0-9-]+--[a-z0-9-]+$' and length(work_id) <= 200);

-- 상태 변경 한 번 = marks 갱신 + 이벤트 1행. 되돌림(null)도 같은 upsert — 늦은 시각이 이긴다.
create or replace function book.mark_set(p_work_id text, p_state text, p_at timestamptz default now())
returns void language plpgsql security invoker set search_path = book, pg_temp as $$
begin
  insert into book.marks (user_id, work_id, state, at) values (auth.uid(), p_work_id, p_state, p_at)
  on conflict (user_id, work_id) do update set state = excluded.state, at = excluded.at
  where excluded.at >= book.marks.at;
  insert into book.mark_events (user_id, work_id, state, at) values (auth.uid(), p_work_id, p_state, p_at);
end $$;

-- 내보내기의 "도감"은 지금 표시된 책이다. 되돌림 기록은 이벤트 이력에 이미 있다.
create or replace function book.account_export()
returns jsonb language sql security invoker set search_path = book, pg_temp as $$
  select jsonb_build_object(
    'marks',  coalesce((select jsonb_agg(to_jsonb(m) - 'user_id' order by m.at) from book.marks m where m.user_id = auth.uid() and m.state is not null), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(to_jsonb(e) - 'user_id' - 'id' order by e.at) from book.mark_events e where e.user_id = auth.uid()), '[]'::jsonb)
  );
$$;
