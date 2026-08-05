alter table public.salesmen_invoices
  add column if not exists additional_amount_reason text;
