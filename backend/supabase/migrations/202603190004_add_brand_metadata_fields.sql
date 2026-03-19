-- Add scalable metadata fields for richer brand seeding/import workflows.
alter table public.brands
  add column if not exists category text,
  add column if not exists country text,
  add column if not exists external_store_link text;

comment on column public.brands.category is 'Editorial or commerce category label for discovery grouping.';
comment on column public.brands.country is 'Primary country association for brand provenance.';
comment on column public.brands.external_store_link is 'Canonical brand storefront URL.';

create index if not exists idx_brands_category on public.brands(category);
create index if not exists idx_brands_country on public.brands(country);
