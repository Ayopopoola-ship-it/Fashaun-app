-- Enforce unique domain for brands so ON CONFLICT (domain) works reliably.

-- Abort migration with a clear error if duplicates already exist.
do $$
declare
  duplicate_count integer;
begin
  select count(*)
  into duplicate_count
  from (
    select domain
    from public.brands
    group by domain
    having count(*) > 1
  ) duplicates;

  if duplicate_count > 0 then
    raise exception 'Cannot enforce unique(domain): found % duplicate domain value(s) in public.brands. Resolve duplicates first.', duplicate_count;
  end if;
end $$;

create unique index if not exists ux_brands_domain on public.brands (domain);
