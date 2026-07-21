-- Customer listing fields: market day, area, defaulter flag
-- Also widen salesmen RLS so entity-customers can update/delete parties

alter table public.salesmen
  add column if not exists market_day text not null default '';

alter table public.salesmen
  drop constraint if exists salesmen_market_day_check;

alter table public.salesmen
  add constraint salesmen_market_day_check
  check (
    market_day = ''
    or market_day in (
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday'
    )
  );

alter table public.salesmen
  add column if not exists area text not null default '';

alter table public.salesmen
  add column if not exists is_defaulter boolean not null default false;

create index if not exists salesmen_entity_type_idx
  on public.salesmen (entity_type);

create index if not exists salesmen_market_day_idx
  on public.salesmen (market_day);

create index if not exists salesmen_area_idx
  on public.salesmen (area);

create index if not exists salesmen_is_defaulter_idx
  on public.salesmen (is_defaulter);

-- UPDATE: entity-salesmen or entity-customers
drop policy if exists "Users with entity-salesmen can update salesmen" on public.salesmen;
drop policy if exists "Users with entity modules can update salesmen" on public.salesmen;
create policy "Users with entity modules can update salesmen"
  on public.salesmen for update to authenticated
  using (
    public.user_has_module('entity-salesmen')
    or public.user_has_module('entity-customers')
  )
  with check (
    public.user_has_module('entity-salesmen')
    or public.user_has_module('entity-customers')
  );

-- DELETE: entity-salesmen or entity-customers (was missing entirely)
drop policy if exists "Users with entity modules can delete salesmen" on public.salesmen;
create policy "Users with entity modules can delete salesmen"
  on public.salesmen for delete to authenticated
  using (
    public.user_has_module('entity-salesmen')
    or public.user_has_module('entity-customers')
  );
