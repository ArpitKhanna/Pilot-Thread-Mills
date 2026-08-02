-- Defaulter status is derived from pending_balance vs balance_threshold

drop index if exists public.salesmen_is_defaulter_idx;

alter table public.salesmen
  drop column if exists is_defaulter;
