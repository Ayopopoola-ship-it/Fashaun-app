-- Fashaun V1 initial schema (MVP)
-- Covers users, brands, products, follows, interactions, and purchases.

create extension if not exists pgcrypto;

-- Shared helper to keep updated_at current on row updates.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- App-level user profile linked to Supabase auth user.
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  username text unique,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.users is 'App user profile records mapped 1:1 to auth.users.';

create trigger trg_users_set_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

-- Brand catalog sources users can follow.
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  domain text not null unique,
  source_type text not null default 'unknown' check (source_type in ('shopify', 'unknown')),
  description text,
  logo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.brands is 'Brands available in the app and eligible for follow/feed.';

create trigger trg_brands_set_updated_at
before update on public.brands
for each row
execute function public.set_updated_at();

-- Products imported from brand catalogs (e.g., Shopify).
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  external_product_id text,
  name text not null,
  description text,
  image_urls text[] not null default '{}',
  sizes text[] not null default '{}',
  colors text[] not null default '{}',
  collection text,
  availability boolean not null default true,
  product_url text,
  price_amount numeric(12,2),
  currency_code char(3) not null default 'USD',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.products is 'Catalog products belonging to brands for feed and browsing.';

create trigger trg_products_set_updated_at
before update on public.products
for each row
execute function public.set_updated_at();

create unique index if not exists ux_products_brand_external_product
  on public.products (brand_id, external_product_id)
  where external_product_id is not null;

-- User follows for building personalized feed scope.
create table if not exists public.user_brand_follows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, brand_id)
);

comment on table public.user_brand_follows is 'Many-to-many mapping of users to followed brands.';

-- User actions on products for lightweight behavior tracking.
create table if not exists public.user_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  interaction_type text not null check (interaction_type in ('view', 'click', 'save', 'purchase')),
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.user_interactions is 'Event stream of user actions on products (view/click/save/purchase).';

-- Purchase records from in-app browsing return flow.
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  currency_code char(3) not null default 'USD',
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'refunded')),
  return_session_id text,
  purchased_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.purchases is 'Tracked purchases attributed back to in-app browsing flow.';

create trigger trg_purchases_set_updated_at
before update on public.purchases
for each row
execute function public.set_updated_at();

-- Helpful indexes for MVP queries.
create index if not exists idx_products_feed
  on public.products (is_active, created_at desc);

create index if not exists idx_products_brand_active_created
  on public.products (brand_id, is_active, created_at desc);

create index if not exists idx_user_brand_follows_user
  on public.user_brand_follows (user_id, created_at desc);

create index if not exists idx_user_brand_follows_brand
  on public.user_brand_follows (brand_id);

create index if not exists idx_user_interactions_user_created
  on public.user_interactions (user_id, created_at desc);

create index if not exists idx_user_interactions_user_type_created
  on public.user_interactions (user_id, interaction_type, created_at desc);

create index if not exists idx_user_interactions_product_created
  on public.user_interactions (product_id, created_at desc);

create index if not exists idx_purchases_user_purchased_at
  on public.purchases (user_id, purchased_at desc);

create index if not exists idx_purchases_brand_purchased_at
  on public.purchases (brand_id, purchased_at desc);

create index if not exists idx_purchases_product_purchased_at
  on public.purchases (product_id, purchased_at desc);

create unique index if not exists ux_purchases_return_session_id
  on public.purchases (return_session_id)
  where return_session_id is not null;
