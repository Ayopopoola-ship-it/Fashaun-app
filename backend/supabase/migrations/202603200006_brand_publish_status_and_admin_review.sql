-- Add explicit publish status to brands/products and align public visibility with live state.

alter table public.brands
  add column if not exists status text;

update public.brands
set status = case when is_active then 'live' else 'draft' end
where status is null;

alter table public.brands
  alter column status set default 'draft';

alter table public.brands
  alter column status set not null;

alter table public.brands
  drop constraint if exists brands_status_check;

alter table public.brands
  add constraint brands_status_check check (status in ('draft', 'live', 'rejected'));

comment on column public.brands.status is 'Internal publish state. Only brands with status=live should appear in the public app.';

alter table public.products
  add column if not exists status text;

update public.products
set status = case when is_active then 'live' else 'draft' end
where status is null;

alter table public.products
  alter column status set default 'draft';

alter table public.products
  alter column status set not null;

alter table public.products
  drop constraint if exists products_status_check;

alter table public.products
  add constraint products_status_check check (status in ('draft', 'live', 'rejected'));

comment on column public.products.status is 'Internal publish state. Only products with status=live should appear in the public app.';

create index if not exists idx_brands_status_updated_at
  on public.brands(status, updated_at desc);

create index if not exists idx_products_status_created_at
  on public.products(status, created_at desc);

create index if not exists idx_products_brand_status_created_at
  on public.products(brand_id, status, created_at desc);

create or replace function public.sync_brand_is_active_from_status()
returns trigger
language plpgsql
as $$
begin
  new.is_active = (new.status = 'live');
  return new;
end;
$$;

drop trigger if exists trg_brands_sync_active_from_status on public.brands;

create trigger trg_brands_sync_active_from_status
before insert or update on public.brands
for each row
execute function public.sync_brand_is_active_from_status();

create or replace function public.sync_product_is_active_from_status()
returns trigger
language plpgsql
as $$
begin
  new.is_active = (new.status = 'live');
  return new;
end;
$$;

drop trigger if exists trg_products_sync_active_from_status on public.products;

create trigger trg_products_sync_active_from_status
before insert or update on public.products
for each row
execute function public.sync_product_is_active_from_status();
