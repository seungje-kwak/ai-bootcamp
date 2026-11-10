-- =========================================================
-- 장바구니 기능용 테이블
-- Supabase 대시보드 → SQL Editor 에 전체를 붙여넣고 Run 하세요.
-- 여러 번 실행해도 안전합니다 (이미 있으면 건너뜀).
-- =========================================================

-- 1) 상품
create table if not exists public.products (
  id          bigint generated always as identity primary key,
  name        text    not null unique,
  description text,
  price       integer not null check (price >= 0),
  emoji       text,
  category    text,
  created_at  timestamptz not null default now()
);

-- 2) 장바구니에 담긴 상품 (브라우저마다 cart_id 로 구분)
create table if not exists public.cart_items (
  id          bigint generated always as identity primary key,
  cart_id     uuid    not null,
  product_id  bigint  not null references public.products(id) on delete cascade,
  quantity    integer not null default 1 check (quantity between 1 and 99),
  created_at  timestamptz not null default now(),
  unique (cart_id, product_id)
);
create index if not exists cart_items_cart_id_idx on public.cart_items (cart_id);

-- 3) 주문 (주문하기를 누르면 장바구니 내용을 기록)
create table if not exists public.orders (
  id          bigint generated always as identity primary key,
  cart_id     uuid    not null,
  items       jsonb   not null,
  item_total  integer not null,
  shipping    integer not null,
  total       integer not null,
  created_at  timestamptz not null default now()
);

-- 브라우저(공개키)에서는 직접 접근 못 하게 RLS 켜기.
-- 정책을 만들지 않았으므로 FastAPI가 쓰는 비밀키(service_role)만 읽고 쓸 수 있습니다.
alter table public.products   enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders     enable row level security;

grant all on public.products, public.cart_items, public.orders to service_role;

-- 4) 예시 상품 (제주 특산품)
insert into public.products (name, description, price, emoji, category) values
  ('한라봉 3kg',        '새콤달콤 과즙 가득, 서귀포 농장 직송',        32000, '🍊', '과일'),
  ('감귤 초콜릿',       '제주 감귤 향을 담은 밀크 초콜릿 12입',         9900, '🍫', '간식'),
  ('오메기떡 20개',     '차조와 팥으로 빚은 제주 전통 떡',             24000, '🍡', '간식'),
  ('제주 흑돼지 세트',  '오겹살 500g + 목살 500g, 멜젓 포함',         45000, '🥩', '정육'),
  ('제주 녹차 티백',    '서귀포 녹차밭에서 수확한 녹차 30티백',        15000, '🍵', '음료'),
  ('돌하르방 키링',     '손바닥만 한 귀여운 돌하르방 키링',             6500, '🗿', '기념품'),
  ('우도 땅콩 막걸리',  '고소한 우도 땅콩으로 빚은 막걸리 750ml',        8000, '🥜', '음료'),
  ('제주 바다 엽서 세트','제주 바다 풍경 일러스트 엽서 8장',            5000, '💌', '기념품')
on conflict (name) do nothing;
