-- Bank accounts: write policies + replace mock seed with real accounts
-- Policies may already exist on remote; use DO blocks for idempotency when re-applied locally.

do $$ begin
  create policy "Users with bank-accounts can insert bank accounts"
    on public.bank_accounts for insert to authenticated
    with check (public.user_has_module('bank-accounts'));
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Users with bank-accounts can update bank accounts"
    on public.bank_accounts for update to authenticated
    using (public.user_has_module('bank-accounts'))
    with check (public.user_has_module('bank-accounts'));
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Users with bank-accounts can delete bank accounts"
    on public.bank_accounts for delete to authenticated
    using (public.user_has_module('bank-accounts'));
exception when duplicate_object then null;
end $$;

delete from public.bank_accounts
where id in ('ba-hdfc-current', 'ba-sbi-current', 'ba-icici-savings');

insert into public.bank_accounts (id, name, bank_name, account_number, is_active) values
  ('ba-pilot-hdfc', 'Pilot Thread Mills', 'HDFC', '50200081037354', true),
  ('ba-pilot-boi', 'Pilot Thread Mills', 'Bank of India', '670125130000012', true),
  ('ba-khanna-sales-kotak', 'Khanna Sales Corp', 'Kotak', '5911210807', true),
  ('ba-rajesh-textile-idbi', 'Rajesh Textile Co.', 'IDBI Bank', '248102000002776', true),
  ('ba-rajesh-khanna-hdfc', 'Rajesh Khanna', 'HDFC', '', true),
  ('ba-rajesh-kanna-cbi', 'Rajesh Kanna', 'Central Bank of India', '1167609389', true),
  ('ba-mukesh-khanna-hdfc', 'Mukesh Khanna', 'HDFC', '', true),
  ('ba-mukesh-khanna-cbi', 'Mukesh Khanna', 'Central Bank of India', '1167583325', true),
  ('ba-neeru-khanna-cbi', 'Neeru Khanna', 'Central Bank of India', '1167587976', true),
  ('ba-sonia-khanna-cbi', 'Sonia Khanna', 'Central Bank of India', '1167587364', true),
  ('ba-mukesh-khanna-huf-hdfc', 'Mukesh Khanna HUF', 'HDFC', '50100637877926', true),
  ('ba-rajesh-khanna-huf-hdfc', 'Rajesh Khanna HUF', 'HDFC', '50100647068501', true)
on conflict (id) do update set
  name = excluded.name,
  bank_name = excluded.bank_name,
  account_number = excluded.account_number,
  is_active = excluded.is_active;