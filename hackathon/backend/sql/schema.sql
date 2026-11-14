-- MyPace Jeju schema (PRD 8장). Run once in the Supabase SQL editor, then:
--   backend/.venv/Scripts/python.exe backend/scripts/seed_supabase.py
-- RLS is on with no policies (11.2): only the backend's service key can read/write.

-- The 14 areas a traveler can pick (tasks/prd-start-area.md 3장). Same rows as app/data/areas.json.
create table if not exists areas (
  id              text primary key,
  "group"         text not null check ("group" in ('jeju','seogwipo')),
  name_en         text not null,
  name_ko         text not null,
  description_en  text not null check (char_length(description_en) <= 80),
  center_lat      double precision not null,
  center_lng      double precision not null,
  sort_order      integer not null
);

insert into areas (id, "group", name_en, name_ko, description_en, center_lat, center_lng, sort_order) values
  ('jeju-city', 'jeju', 'Jeju City Downtown', '제주시 도심', 'Tapdong, Dongmun Market, Yongduam Rock', 33.5, 126.52, 1),
  ('hallim', 'jeju', 'Hallim', '한림읍', 'Hyeopjae Beach, Hallim Park', 33.41, 126.269, 2),
  ('aewol', 'jeju', 'Aewol', '애월읍', 'Coastal cafés and sea views', 33.463, 126.331, 3),
  ('gujwa', 'jeju', 'Gujwa', '구좌읍', 'Woljeong and Sehwa beaches', 33.522, 126.853, 4),
  ('jocheon', 'jeju', 'Jocheon', '조천읍', 'Hamdeok Beach', 33.538, 126.65, 5),
  ('hangyeong', 'jeju', 'Hangyeong', '한경면', 'Suwolbong Peak and the west coast', 33.344, 126.18, 6),
  ('chuja', 'jeju', 'Chuja Islands', '추자면', 'Small islands north of Jeju', 33.962, 126.3, 7),
  ('udo', 'jeju', 'Udo Island', '우도면', 'A small island off Seongsan', 33.504, 126.953, 8),
  ('seogwipo-city', 'seogwipo', 'Seogwipo Downtown', '서귀포시 도심', 'Cheonjiyeon Falls, Olle Market, Jungmun', 33.253, 126.56, 9),
  ('daejeong', 'seogwipo', 'Daejeong', '대정읍', 'Moseulpo Port, Songaksan', 33.224, 126.252, 10),
  ('namwon', 'seogwipo', 'Namwon', '남원읍', 'Keuneong coastal walk', 33.28, 126.718, 11),
  ('seongsan', 'seogwipo', 'Seongsan', '성산읍', 'Seongsan Ilchulbong, Seopjikoji', 33.442, 126.911, 12),
  ('andeok', 'seogwipo', 'Andeok', '안덕면', 'Sanbangsan, Yongmeori Coast', 33.256, 126.334, 13),
  ('pyoseon', 'seogwipo', 'Pyoseon', '표선면', 'Pyoseon Beach, Jeju Folk Village', 33.326, 126.832, 14)
on conflict (id) do update set
  "group" = excluded."group", name_en = excluded.name_en, name_ko = excluded.name_ko,
  description_en = excluded.description_en, center_lat = excluded.center_lat,
  center_lng = excluded.center_lng, sort_order = excluded.sort_order;

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
  area_id           text not null default 'jeju-city' references areas(id),  -- from address_ko (build_places.py)
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

-- For a database made before areas existed (safe to run again). Old rows become 'jeju-city';
-- seed_supabase.py then writes the real area of every place.
alter table places add column if not exists area_id text not null default 'jeju-city' references areas(id);

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

alter table areas               enable row level security;
alter table places              enable row level security;
alter table place_accessibility enable row level security;
alter table food_options        enable row level security;
alter table phrase_cards        enable row level security;
alter table courses             enable row level security;
alter table course_items        enable row level security;
alter table place_reports       enable row level security;
