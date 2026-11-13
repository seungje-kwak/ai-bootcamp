-- MyPace Jeju schema (PRD 8장). Run once in the Supabase SQL editor, then:
--   backend/.venv/Scripts/python.exe backend/scripts/seed_supabase.py
-- RLS is on with no policies (11.2): only the backend's service key can read/write.

create table if not exists places (
  id                integer primary key,
  source_poi_id     text,
  name_en           text not null,
  name_ko           text not null,
  category          text not null check (category in ('nature','market','cafe','food','culture','photo')),
  description_en    text not null,
  lat               double precision not null,
  lng               double precision not null,
  address_ko        text not null,
  image_url         text,
  image_source      text,
  avg_stay_min      integer not null,
  opening_hours     text,                -- shown to people; the planner reads open_time / close_time
  open_time         text check (open_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  close_time        text check (close_time ~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$'),
  closed_days      text[] not null default '{}',
  price_level       integer,
  last_verified_at  date,
  source_date       date,
  -- both null = always open; close_time '24:00' = open past midnight
  constraint places_open_close check ((open_time is null) = (close_time is null) and open_time < close_time)
);

-- For a database made before open_time / close_time existed (safe to run again):
alter table places add column if not exists open_time  text check (open_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
alter table places add column if not exists close_time text check (close_time ~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$');
do $$ begin
  alter table places add constraint places_open_close
    check ((open_time is null) = (close_time is null) and open_time < close_time);
exception when duplicate_object then null;
end $$;

create table if not exists place_accessibility (
  place_id                   integer primary key references places(id) on delete cascade,
  walking_level              integer not null check (walking_level between 1 and 3),
  terrain                    text not null check (terrain in ('flat','slope','steep')),
  has_stairs                 boolean,
  wheelchair_ok              boolean,
  indoor                     boolean not null,
  has_seating                boolean,
  restroom                   boolean,
  nearest_public_restroom_m  integer,
  fatigue_score              integer not null check (fatigue_score between 1 and 5)
);

create table if not exists food_options (
  place_id           integer primary key references places(id) on delete cascade,
  solo_ok            boolean not null,
  vegan              boolean not null,
  vegetarian         boolean not null,
  halal              boolean not null,
  english_menu       boolean not null,
  signature_menu_en  text,
  allergens          text
);

create table if not exists phrase_cards (
  id         integer primary key,
  place_id   integer references places(id) on delete cascade,  -- null = generic card
  situation  text not null,
  text_en    text not null,
  text_ko    text not null
);

create table if not exists courses (
  id            uuid primary key,
  user_profile  jsonb not null,
  tier          text not null default 'free' check (tier in ('free','premium')),
  created_at    timestamptz not null default now()
);

create table if not exists course_items (
  course_id     uuid not null references courses(id) on delete cascade,
  "order"       integer not null,
  place_id      integer not null references places(id),
  start_time    text not null,
  stay_min      integer not null,
  move_method   text check (move_method in ('walk','bus','taxi')),
  move_min      integer,
  reason_en     text not null,
  is_rest_stop  boolean not null default false,
  status        text not null check (status in ('done','current','upcoming')),
  primary key (course_id, "order")
);

create table if not exists place_reports (
  id          bigint generated always as identity primary key,
  place_id    integer not null references places(id),
  type        text not null default 'closed',
  created_at  timestamptz not null default now()
);

alter table places              enable row level security;
alter table place_accessibility enable row level security;
alter table food_options        enable row level security;
alter table phrase_cards        enable row level security;
alter table courses             enable row level security;
alter table course_items        enable row level security;
alter table place_reports       enable row level security;
