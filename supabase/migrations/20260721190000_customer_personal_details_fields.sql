-- Customer personal details: contact, address, map pin, tier rubric, price rules

alter table public.salesmen
  add column if not exists contact_name text not null default '';

alter table public.salesmen
  add column if not exists address_building text not null default '';

alter table public.salesmen
  add column if not exists address_area text not null default '';

alter table public.salesmen
  add column if not exists address_city text not null default '';

alter table public.salesmen
  add column if not exists address_state text not null default '';

alter table public.salesmen
  add column if not exists address_pincode text not null default '';

alter table public.salesmen
  add column if not exists map_lat double precision;

alter table public.salesmen
  add column if not exists map_lng double precision;

alter table public.salesmen
  drop constraint if exists salesmen_map_coords_check;

alter table public.salesmen
  add constraint salesmen_map_coords_check
  check (
    (map_lat is null and map_lng is null)
    or (
      map_lat is not null
      and map_lng is not null
      and map_lat between -90 and 90
      and map_lng between -180 and 180
    )
  );

alter table public.salesmen
  add column if not exists tier_rubric jsonb not null default '{}'::jsonb;

alter table public.salesmen
  add column if not exists price_rules jsonb not null default '[]'::jsonb;

-- Backfill address_area from legacy area when empty
update public.salesmen
set address_area = area
where coalesce(nullif(trim(address_area), ''), '') = ''
  and coalesce(nullif(trim(area), ''), '') <> '';
