-- 추천 가설 검증용 이벤트 수집 테이블
--
-- 단일 events 테이블에 event_type으로 구매 클릭/추천 별점을 구분해 적재한다.
-- 익명(anon) 클라이언트가 PostgREST(/rest/v1/events)로 직접 insert 하며,
-- 로그인은 없고 한 사용자의 흐름은 클라이언트 생성 session_id(익명 UUID)로 느슨하게 묶는다.
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('purchase_click', 'rating')),
  session_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- RLS: anon 은 insert 만 가능. select/update/delete 정책은 두지 않아 기본 거부된다.
-- (이벤트는 적재만 하고 브라우저로 다시 읽어가지 않으므로 insert-only 가 안전하다.)
alter table public.events enable row level security;

drop policy if exists "anon can insert events" on public.events;
create policy "anon can insert events"
  on public.events
  for insert
  to anon
  with check (true);

-- 가설 검증 분석은 보통 "타입별 최신순"으로 조회하므로 복합 인덱스를 둔다.
create index if not exists events_event_type_created_at_idx
  on public.events (event_type, created_at desc);
