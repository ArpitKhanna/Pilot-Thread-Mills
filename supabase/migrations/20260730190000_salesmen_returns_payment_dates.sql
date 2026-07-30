-- Stand-alone returns (mirror advances) + payment business dates

create table public.salesmen_returns (
  id uuid primary key default gen_random_uuid(),
  salesman_id text not null references public.salesmen (id) on delete cascade,
  total_amount numeric(12, 2) not null check (total_amount > 0),
  remaining_amount numeric(12, 2) not null check (remaining_amount >= 0),
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
  constraint salesmen_returns_remaining_lte_total
    check (remaining_amount <= total_amount)
);

create index salesmen_returns_salesman_id_idx
  on public.salesmen_returns (salesman_id);
create index salesmen_returns_received_at_idx
  on public.salesmen_returns (received_at desc);
create index salesmen_returns_by_verification_status
  on public.salesmen_returns (verification_status, received_at desc)
  where status = 'active';

alter table public.salesmen_returns enable row level security;

create policy "Users with salesmen modules can view returns"
  on public.salesmen_returns for select to authenticated
  using (
    public.user_has_module('entity-salesmen')
    or public.user_has_module('order-salesmen')
    or public.user_has_module('entity-customers')
    or public.user_has_module('order-customers')
    or public.user_has_module('approvals')
  );

create policy "Users with order or entity modules can insert returns"
  on public.salesmen_returns for insert to authenticated
  with check (
    public.user_has_module('entity-salesmen')
    or public.user_has_module('order-salesmen')
    or public.user_has_module('entity-customers')
    or public.user_has_module('order-customers')
  );

create policy "Users with order or entity modules can update returns"
  on public.salesmen_returns for update to authenticated
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

create policy "Users with order or entity modules can delete returns"
  on public.salesmen_returns for delete to authenticated
  using (
    public.user_has_module('entity-salesmen')
    or public.user_has_module('order-salesmen')
    or public.user_has_module('entity-customers')
    or public.user_has_module('order-customers')
  );

create trigger salesmen_returns_updated_at
  before update on public.salesmen_returns
  for each row execute function public.handle_updated_at();

create table public.salesmen_return_lines (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.salesmen_returns (id) on delete cascade,
  name text not null,
  qty numeric(12, 3) not null check (qty > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  amount numeric(12, 2) not null check (amount >= 0),
  price_list_item_id text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index salesmen_return_lines_return_id_idx
  on public.salesmen_return_lines (return_id);

alter table public.salesmen_return_lines enable row level security;

create policy "Users with salesmen modules can view return lines"
  on public.salesmen_return_lines for select to authenticated
  using (
    public.user_has_module('entity-salesmen')
    or public.user_has_module('order-salesmen')
    or public.user_has_module('entity-customers')
    or public.user_has_module('order-customers')
    or public.user_has_module('approvals')
  );

create policy "Users with order or entity modules can insert return lines"
  on public.salesmen_return_lines for insert to authenticated
  with check (
    public.user_has_module('entity-salesmen')
    or public.user_has_module('order-salesmen')
    or public.user_has_module('entity-customers')
    or public.user_has_module('order-customers')
  );

create policy "Users with order or entity modules can update return lines"
  on public.salesmen_return_lines for update to authenticated
  using (
    public.user_has_module('entity-salesmen')
    or public.user_has_module('order-salesmen')
    or public.user_has_module('entity-customers')
    or public.user_has_module('order-customers')
  )
  with check (
    public.user_has_module('entity-salesmen')
    or public.user_has_module('order-salesmen')
    or public.user_has_module('entity-customers')
    or public.user_has_module('order-customers')
  );

create policy "Users with order or entity modules can delete return lines"
  on public.salesmen_return_lines for delete to authenticated
  using (
    public.user_has_module('entity-salesmen')
    or public.user_has_module('order-salesmen')
    or public.user_has_module('entity-customers')
    or public.user_has_module('order-customers')
  );

alter table public.salesmen_invoice_lines
  add column if not exists stand_alone_return_id uuid
    references public.salesmen_returns (id) on delete set null;

create index if not exists salesmen_invoice_lines_stand_alone_return_id_idx
  on public.salesmen_invoice_lines (stand_alone_return_id)
  where stand_alone_return_id is not null;

-- Business / backdated date + system created_at for invoice payments
alter table public.salesmen_invoice_payments
  add column if not exists received_at timestamptz not null default now(),
  add column if not exists created_at timestamptz not null default now();

-- Advances: delete policies (select/insert/update already exist)
drop policy if exists "Users with order or entity modules can delete advances"
  on public.salesmen_advances;
create policy "Users with order or entity modules can delete advances"
  on public.salesmen_advances for delete to authenticated
  using (
    public.user_has_module('entity-salesmen')
    or public.user_has_module('order-salesmen')
    or public.user_has_module('entity-customers')
    or public.user_has_module('order-customers')
  );
