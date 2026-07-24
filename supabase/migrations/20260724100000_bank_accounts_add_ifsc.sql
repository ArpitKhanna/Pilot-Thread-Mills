alter table public.bank_accounts
  add column if not exists ifsc_code text not null default '';
