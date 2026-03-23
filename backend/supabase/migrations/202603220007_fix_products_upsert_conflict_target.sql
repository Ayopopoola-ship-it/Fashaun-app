-- Ensure product upserts can target (brand_id, external_product_id) reliably.
-- The previous partial unique index does not satisfy ON CONFLICT inference for the
-- current ingestion upsert shape used by the admin tooling.

do $$
declare
  duplicate_count integer;
begin
  select count(*)
  into duplicate_count
  from (
    select brand_id, external_product_id
    from public.products
    where external_product_id is not null
    group by brand_id, external_product_id
    having count(*) > 1
  ) duplicates;

  if duplicate_count > 0 then
    raise exception
      'Cannot create unique products index for (brand_id, external_product_id): found % duplicate non-null combination(s) in public.products. Resolve duplicates first.',
      duplicate_count;
  end if;
end
$$;

drop index if exists public.ux_products_brand_external_product;

create unique index if not exists ux_products_brand_external_product
  on public.products (brand_id, external_product_id);
