-- Salesmen entities, bank accounts, and invoices (create / edit / list)

create type public.invoice_payment_method as enum (
  'cash',
  'cheque',
  'upi',
  'imps'
);

create table public.salesmen (
  id text primary key,
  name text not null,
  phone text not null default '',
  category text not null default 'Salesmen',
  is_active boolean not null default true,
  pending_balance numeric(12, 2) not null default 0 check (pending_balance >= 0),
  last_invoice_at timestamptz,
  discount_rule jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index salesmen_is_active_idx on public.salesmen (is_active);
create index salesmen_name_idx on public.salesmen (name);

alter table public.salesmen enable row level security;

create policy "Users with salesmen modules can view salesmen"
  on public.salesmen for select to authenticated
  using (
    public.user_has_module('entity-salesmen')
    or public.user_has_module('order-salesmen')
  );

create policy "Users with entity-salesmen can update salesmen"
  on public.salesmen for update to authenticated
  using (public.user_has_module('entity-salesmen'))
  with check (public.user_has_module('entity-salesmen'));

create policy "Users with entity-salesmen can insert salesmen"
  on public.salesmen for insert to authenticated
  with check (public.user_has_module('entity-salesmen'));

create trigger salesmen_updated_at
  before update on public.salesmen
  for each row execute function public.handle_updated_at();

create table public.bank_accounts (
  id text primary key,
  name text not null,
  bank_name text not null,
  account_number text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.bank_accounts enable row level security;

create policy "Authenticated users with bank or order access can view bank accounts"
  on public.bank_accounts for select to authenticated
  using (
    public.user_has_module('bank-accounts')
    or public.user_has_module('order-salesmen')
    or public.user_has_module('entity-salesmen')
  );

create table public.salesmen_invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  salesman_id text not null references public.salesmen (id),
  issued_at timestamptz not null default now(),
  item_count int not null default 0 check (item_count >= 0),
  total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
  amount_paid numeric(12, 2) not null default 0 check (amount_paid >= 0),
  discount_amount numeric(12, 2) not null default 0 check (discount_amount >= 0),
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index salesmen_invoices_salesman_id_idx
  on public.salesmen_invoices (salesman_id);
create index salesmen_invoices_issued_at_idx
  on public.salesmen_invoices (issued_at desc);

alter table public.salesmen_invoices enable row level security;

create policy "Users with salesmen modules can view invoices"
  on public.salesmen_invoices for select to authenticated
  using (
    public.user_has_module('entity-salesmen')
    or public.user_has_module('order-salesmen')
  );

create policy "Users with order-salesmen can insert invoices"
  on public.salesmen_invoices for insert to authenticated
  with check (public.user_has_module('order-salesmen'));

create policy "Users with order-salesmen can update invoices"
  on public.salesmen_invoices for update to authenticated
  using (public.user_has_module('order-salesmen'))
  with check (public.user_has_module('order-salesmen'));

create trigger salesmen_invoices_updated_at
  before update on public.salesmen_invoices
  for each row execute function public.handle_updated_at();

create table public.salesmen_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.salesmen_invoices (id) on delete cascade,
  name text not null,
  qty numeric(12, 3) not null check (qty > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  amount numeric(12, 2) not null check (amount >= 0),
  price_list_item_id uuid references public.price_list_items (id) on delete set null,
  is_return boolean not null default false,
  sort_order int not null default 0
);

create index salesmen_invoice_lines_invoice_id_idx
  on public.salesmen_invoice_lines (invoice_id);

alter table public.salesmen_invoice_lines enable row level security;

create policy "Users with salesmen modules can view invoice lines"
  on public.salesmen_invoice_lines for select to authenticated
  using (
    public.user_has_module('entity-salesmen')
    or public.user_has_module('order-salesmen')
  );

create policy "Users with order-salesmen can insert invoice lines"
  on public.salesmen_invoice_lines for insert to authenticated
  with check (public.user_has_module('order-salesmen'));

create policy "Users with order-salesmen can update invoice lines"
  on public.salesmen_invoice_lines for update to authenticated
  using (public.user_has_module('order-salesmen'))
  with check (public.user_has_module('order-salesmen'));

create policy "Users with order-salesmen can delete invoice lines"
  on public.salesmen_invoice_lines for delete to authenticated
  using (public.user_has_module('order-salesmen'));

create table public.salesmen_invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.salesmen_invoices (id) on delete cascade,
  method public.invoice_payment_method not null,
  amount numeric(12, 2) not null check (amount > 0),
  cheque_number text,
  deposit_account_id text references public.bank_accounts (id) on delete set null,
  sender_name text,
  sort_order int not null default 0
);

create index salesmen_invoice_payments_invoice_id_idx
  on public.salesmen_invoice_payments (invoice_id);

alter table public.salesmen_invoice_payments enable row level security;

create policy "Users with salesmen modules can view invoice payments"
  on public.salesmen_invoice_payments for select to authenticated
  using (
    public.user_has_module('entity-salesmen')
    or public.user_has_module('order-salesmen')
  );

create policy "Users with order-salesmen can insert invoice payments"
  on public.salesmen_invoice_payments for insert to authenticated
  with check (public.user_has_module('order-salesmen'));

create policy "Users with order-salesmen can update invoice payments"
  on public.salesmen_invoice_payments for update to authenticated
  using (public.user_has_module('order-salesmen'))
  with check (public.user_has_module('order-salesmen'));

create policy "Users with order-salesmen can delete invoice payments"
  on public.salesmen_invoice_payments for delete to authenticated
  using (public.user_has_module('order-salesmen'));

-- Seed bank accounts
insert into public.bank_accounts (id, name, bank_name, account_number, is_active) values
  ('ba-hdfc-current', 'HDFC Current', 'HDFC Bank', '50200012345678', true),
  ('ba-sbi-current', 'SBI Current', 'State Bank of India', '30123456789', true),
  ('ba-icici-savings', 'ICICI Ops', 'ICICI Bank', '000501234567', true);

-- Seed salesmen (same ids as previous mock data)
insert into public.salesmen (
  id, name, phone, category, is_active, pending_balance, last_invoice_at, discount_rule
) values
  (
    'sm-nandkishore',
    'Nandkishore',
    '919876543210',
    'Salesmen',
    true,
    0,
    null,
    '{"itemType":"dibbi","itemNameIncludes":"poly","amountPerUnit":1,"description":"₹1 per Needle Poly Dibbi"}'::jsonb
  ),
  (
    'sm-ramesh',
    'Ramesh Kumar',
    '919811122233',
    'Salesmen',
    true,
    0,
    null,
    '{"itemType":"dibbi","itemNameIncludes":"poly","amountPerUnit":1,"description":"₹1 per Needle Poly Dibbi"}'::jsonb
  ),
  (
    'sm-suresh',
    'Suresh Patel',
    '919822233344',
    'Salesmen',
    true,
    0,
    null,
    null
  ),
  (
    'sm-anil',
    'Anil Sharma',
    '919833344455',
    'Salesmen',
    false,
    0,
    null,
    null
  ),
  (
    'sm-vijay',
    'Vijay Mehta',
    '919844455566',
    'Salesmen',
    true,
    0,
    null,
    '{"itemType":"dibbi","amountPerUnit":1,"description":"₹1 per Dibbi"}'::jsonb
  ),
  (
    'sm-prakash',
    'Prakash Joshi',
    '919855566677',
    'Salesmen',
    false,
    0,
    null,
    null
  );
