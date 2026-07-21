-- Allow Tier D for auto-scored customers

alter table public.salesmen
  drop constraint if exists salesmen_tier_check;

alter table public.salesmen
  add constraint salesmen_tier_check
  check (
    tier = ''
    or tier in ('A', 'B', 'C', 'D')
  );
