-- When payment is deposited to a party outside registered bank accounts
alter table public.salesmen_invoice_payments
  add column if not exists deposit_account_other text;
