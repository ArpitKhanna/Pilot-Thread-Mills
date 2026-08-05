alter table public.salesmen_invoices
  add column if not exists additional_amount numeric(12, 2) not null default 0
  check (additional_amount >= 0);
