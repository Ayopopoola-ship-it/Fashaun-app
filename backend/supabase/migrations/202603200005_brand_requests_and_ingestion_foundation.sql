-- Extend catalog ingestion metadata and add brand request / voting foundation.

alter table public.brands
  drop constraint if exists brands_source_type_check;

alter table public.brands
  add column if not exists instagram_handle text,
  add column if not exists source_url text,
  add column if not exists ingestion_status text not null default 'pending',
  add column if not exists confidence_score numeric(4,3),
  add column if not exists is_verified boolean not null default false,
  add column if not exists last_synced_at timestamptz,
  add constraint brands_source_type_check check (source_type in ('shopify', 'generic_site', 'instagram', 'unknown')),
  add constraint brands_ingestion_status_check check (ingestion_status in ('pending', 'in_progress', 'needs_review', 'live', 'failed')),
  add constraint brands_confidence_score_check check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1));

comment on column public.brands.instagram_handle is 'Normalized Instagram handle for the brand when known.';
comment on column public.brands.source_url is 'Primary source URL used for ingestion/classification.';
comment on column public.brands.ingestion_status is 'Current ingestion state for the brand catalog.';
comment on column public.brands.confidence_score is '0-1 confidence score for source classification and ingestion quality.';
comment on column public.brands.is_verified is 'Internal review flag for approved/live brands.';
comment on column public.brands.last_synced_at is 'Timestamp of the last successful or attempted sync.';

update public.brands
set source_url = coalesce(source_url, external_store_link, case when domain is not null then 'https://' || domain else null end)
where source_url is null;

update public.brands
set ingestion_status = case when is_active then 'live' else 'pending' end
where ingestion_status is null;

create index if not exists idx_brands_ingestion_status on public.brands(ingestion_status, updated_at desc);
create index if not exists idx_brands_source_type on public.brands(source_type, updated_at desc);

create table if not exists public.raw_source_records (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  source_type text not null check (source_type in ('shopify', 'generic_site', 'instagram', 'unknown')),
  source_url text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.raw_source_records is 'Raw upstream source payloads preserved for review and reprocessing.';

create index if not exists idx_raw_source_records_brand_fetched
  on public.raw_source_records(brand_id, fetched_at desc);

create index if not exists idx_raw_source_records_product
  on public.raw_source_records(product_id, fetched_at desc);

alter table public.products
  add column if not exists title text,
  add column if not exists category text,
  add column if not exists variants jsonb not null default '[]'::jsonb,
  add column if not exists source_type text not null default 'unknown',
  add column if not exists confidence_score numeric(4,3),
  add column if not exists raw_source_id uuid references public.raw_source_records(id) on delete set null,
  add constraint products_source_type_check check (source_type in ('shopify', 'generic_site', 'instagram', 'unknown')),
  add constraint products_confidence_score_check check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1));

comment on column public.products.title is 'Normalized product title used by ingestion connectors.';
comment on column public.products.category is 'Normalized category/product type label.';
comment on column public.products.variants is 'Raw normalized variants/options payload.';
comment on column public.products.source_type is 'Connector/source type used to ingest this product.';
comment on column public.products.confidence_score is '0-1 confidence score for product normalization quality.';
comment on column public.products.raw_source_id is 'Latest raw source payload record linked to this product.';

update public.products
set title = coalesce(title, name),
    category = coalesce(category, collection),
    source_type = coalesce(source_type, 'unknown')
where title is null or category is null or source_type is null;

create index if not exists idx_products_source_type_created
  on public.products(source_type, created_at desc);

create index if not exists idx_products_raw_source_id
  on public.products(raw_source_id);

create table if not exists public.brand_requests (
  id uuid primary key default gen_random_uuid(),
  submitted_by_user_id uuid references public.users(id) on delete set null,
  linked_brand_id uuid references public.brands(id) on delete set null,
  name text not null,
  normalized_name text not null,
  website_url text,
  instagram_url text,
  normalized_domain text,
  instagram_handle text,
  normalized_instagram_handle text,
  category text,
  source_type text not null default 'unknown' check (source_type in ('shopify', 'generic_site', 'instagram', 'unknown')),
  source_url text,
  difficulty_tag text not null default 'unknown' check (difficulty_tag in ('easy', 'medium', 'hard', 'unknown')),
  estimated_onboarding_time text not null default 'unknown' check (estimated_onboarding_time in ('1_to_3_days', '3_to_7_days', '1_to_3_weeks', 'unknown')),
  status text not null default 'requested' check (status in ('requested', 'queued', 'priority', 'urgent', 'live', 'rejected')),
  vote_count integer not null default 0 check (vote_count >= 0),
  share_slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.brand_requests is 'User-submitted global brand requests used for voting and onboarding prioritization.';

create trigger trg_brand_requests_set_updated_at
before update on public.brand_requests
for each row
execute function public.set_updated_at();

create unique index if not exists ux_brand_requests_normalized_name
  on public.brand_requests(normalized_name);

create index if not exists idx_brand_requests_vote_count
  on public.brand_requests(vote_count desc, updated_at desc);

create index if not exists idx_brand_requests_status
  on public.brand_requests(status, updated_at desc);

create index if not exists idx_brand_requests_normalized_domain
  on public.brand_requests(normalized_domain);

create index if not exists idx_brand_requests_normalized_instagram_handle
  on public.brand_requests(normalized_instagram_handle);

create table if not exists public.brand_request_votes (
  id uuid primary key default gen_random_uuid(),
  brand_request_id uuid not null references public.brand_requests(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (brand_request_id, user_id)
);

comment on table public.brand_request_votes is 'One-vote-per-user support for requested brands.';

create index if not exists idx_brand_request_votes_request
  on public.brand_request_votes(brand_request_id, created_at desc);

create index if not exists idx_brand_request_votes_user
  on public.brand_request_votes(user_id, created_at desc);

create or replace function public.refresh_brand_request_vote_count(target_request_id uuid)
returns void
language plpgsql
as $$
declare
  next_vote_count integer;
begin
  select count(*)::integer
  into next_vote_count
  from public.brand_request_votes
  where brand_request_id = target_request_id;

  update public.brand_requests
  set vote_count = coalesce(next_vote_count, 0)
  where id = target_request_id;
end;
$$;

create or replace function public.sync_brand_request_vote_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_brand_request_vote_count(old.brand_request_id);
    return old;
  end if;

  perform public.refresh_brand_request_vote_count(new.brand_request_id);
  return new;
end;
$$;

create trigger trg_brand_request_votes_refresh_count
after insert or delete on public.brand_request_votes
for each row
execute function public.sync_brand_request_vote_count();

create or replace function public.derive_brand_request_status()
returns trigger
language plpgsql
as $$
begin
  if new.linked_brand_id is not null then
    new.status = 'live';
    return new;
  end if;

  if new.status = 'rejected' then
    return new;
  end if;

  if new.vote_count >= 100 then
    new.status = 'urgent';
  elsif new.vote_count >= 50 then
    new.status = 'priority';
  elsif new.vote_count >= 10 then
    new.status = 'queued';
  else
    new.status = 'requested';
  end if;

  return new;
end;
$$;

create trigger trg_brand_requests_derive_status
before insert or update on public.brand_requests
for each row
execute function public.derive_brand_request_status();
