-- Supabase → SQL Editor → New query → 전체 붙여넣기 → Run
-- 테이블 2개: 측정소별 값(air_measurements), 시간대별 요약(air_summary)

create table if not exists public.air_measurements (
  id            bigint generated always as identity primary key,
  sido          text        not null,
  station_name  text        not null,
  data_time     timestamptz not null,
  pm10          double precision,
  pm25          double precision,
  grade         text        not null,
  is_missing    boolean     not null default false,
  collected_at  timestamptz not null default now(),
  -- upsert(중복 없이 덮어쓰기)에 꼭 필요한 조건.
  -- 측정소 이름은 시도가 달라도 겹칠 수 있어서(예: 중앙동) sido 까지 묶습니다.
  unique (sido, station_name, data_time)
);

create table if not exists public.air_summary (
  id             bigint generated always as identity primary key,
  sido           text        not null,
  data_time      timestamptz not null,
  station_count  int,
  missing_count  int,
  avg_pm10       double precision,
  avg_pm25       double precision,
  grade          text,
  worst_station  text,
  worst_pm25     double precision,
  collected_at   timestamptz not null default now(),
  unique (sido, data_time)
);

create index if not exists air_measurements_sido_time on public.air_measurements (sido, data_time desc);
create index if not exists air_summary_sido_time on public.air_summary (sido, data_time desc);

-- RLS 켜기 + 정책 없음 = 브라우저 공개키로는 못 읽음. 서버의 secret 키만 읽고 씀.
-- 그래서 화면(Vercel)은 언제나 FastAPI(Railway)를 거쳐야 합니다.
alter table public.air_measurements enable row level security;
alter table public.air_summary enable row level security;
