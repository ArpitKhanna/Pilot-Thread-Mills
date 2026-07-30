-- Stand-alone advance payments + cheque cancel on invoice payments

create type public.payment_record_status as enum (
  'active',
  'cancelled'
);

create table public.salesmen_advances (
  id uuid primary key default gen_random_uuid(),
  salesman_id text not null references public.salesmen (id) on delete cascade,
  method public.invoice_payment_method not null,
  amount numeric(12, 2) not null check (amount > 0),
  remaining_amount numeric(12, 2) not null check (remaining_amount >= 0),
  cheque_number text,
  deposit_account_id text references public.bank_accounts (id) on delete set null,
  sender_name text,
  notes text,
  received_at timestamptz not null default now(),
  status public.payment_record_status not null default 'active',
  verification_status public.invoice_verification_status not null default 'verified',
  created_by uuid references public.profiles (id) on delete set null,
  created_by_name text,
  verified_by uuid references public.profiles (id) on delete set null,
  verified_by_name text,
  verified_at timestamptz,
  verification_note text,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete set null,
  cancelled_by_name text,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint salesmen_advances_remaining_lte_amount
    check (remaining_amount <= amount)
);

create index salesmen_advances_salesman_id_idx
  on public.salesmen_advances (salesman_id);
create index salesmen_advances_received_at_idx
  on public.salesmen_advances (received_at desc);
create index salesmen_advances_by_verification_status
  on public.salesmen_advances (verification_status, received_at desc)
  where status = 'active';

alter table public.salesmen_advances enable row level security;

create policy "Users with salesmen modules can view advances"
  on public.salesmen_advances for select to authenticated
  using (
    public.user_has_module('entity-salesmen')
    or public.user_has_module('order-salesmen')
    or public.user_has_module('entity-customers')
    or public.user_has_module('order-customers')
    or public.user_has_module('approvals')
  );

create policy "Users with order or entity modules can insert advances"
  on public.salesmen_advances for insert to authenticated
  with check (
    public.user_has_module('entity-salesmen')
    or public.user_has_module('order-salesmen')
    or public.user_has_module('entity-customers')
    or public.user_has_module('order-customers')
  );

create policy "Users with order or entity modules can update advances"
  on public.salesmen_advances for update to authenticated
  using (
    public.user_has_module('entity-salesmen')
    or public.user_has_module('order-salesmen')
    or public.user_has_module('entity-customers')
    or public.user_has_module('order-customers')
    or public.user_has_module('approvals')
  )
  with check (
    public.user_has_module('entity-salesmen')
    or public.user_has_module('order-salesmen')
    or public.user_has_module('entity-customers')
    or public.user_has_module('order-customers')
    or public.user_has_module('approvals')
  );

create trigger salesmen_advances_updated_at
  before update on public.salesmen_advances
  for each row execute function public.handle_updated_at();

alter table public.salesmen_invoice_payments
  add column if not exists status public.payment_record_status
    not null default 'active',
  add column if not exists advance_id uuid
    references public.salesmen_advances (id) on delete set null,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid
    references public.profiles (id) on delete set null,
  add column if not exists cancelled_by_name text,
  add column if not exists cancel_reason text;

create index if not exists salesmen_invoice_payments_advance_id_idx
  on public.salesmen_invoice_payments (advance_id)
  where advance_id is not null;

create index if not exists salesmen_invoice_payments_status_idx
  on public.salesmen_invoice_payments (status);
