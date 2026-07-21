-- Customer tier and balance alert threshold for detail page

alter table public.salesmen
  add column if not exists tier text not null default '';

alter table public.salesmen
  drop constraint if exists salesmen_tier_check;

alter table public.salesmen
  add constraint salesmen_tier_check
  check (
    tier = ''
    or tier in ('A', 'B', 'C')
  );

alter table public.salesmen
  add column if not exists balance_threshold numeric(12, 2);

alter table public.salesmen
  drop constraint if exists salesmen_balance_threshold_check;

alter table public.salesmen
  add constraint salesmen_balance_threshold_check
  check (
    balance_threshold is null
    or balance_threshold >= 0
  );
