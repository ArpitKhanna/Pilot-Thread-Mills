-- Daily expenses for operational cash book outflows

create type public.expense_category as enum (
  'petrol',
  'dyer',
  'maintenance',
  'scheduled',
  'other'
);

create table public.daily_expenses (
  id uuid primary key default gen_random_uuid(),
  category public.expense_category not null,
  payee text,
  amount numeric(12, 2) not null check (amount > 0),
  method public.invoice_payment_method not null,
  paid_at timestamptz not null default now(),
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index daily_expenses_paid_at_idx
  on public.daily_expenses (paid_at desc);

create index daily_expenses_category_idx
  on public.daily_expenses (category, paid_at desc);

alter table public.daily_expenses enable row level security;

create policy "Authenticated users with expenses module can view daily expenses"
  on public.daily_expenses for select to authenticated
  using (
    public.user_has_module('expenses')
    or public.user_has_module('dashboard')
    or public.user_has_module('payments')
  );

create policy "Authenticated users with expenses module can insert daily expenses"
  on public.daily_expenses for insert to authenticated
  with check (
    public.user_has_module('expenses')
    or public.user_has_module('dashboard')
  );

create policy "Authenticated users with expenses module can delete daily expenses"
  on public.daily_expenses for delete to authenticated
  using (
    public.user_has_module('expenses')
    or public.user_has_module('dashboard')
  );

create trigger daily_expenses_updated_at
  before update on public.daily_expenses
  for each row execute function public.handle_updated_at();

-- Misc receipt sources on advances (chitfund, mutual fund, etc.)

create type public.ledger_receipt_source as enum (
  'party_payment',
  'chitfund',
  'mutual_fund',
  'other'
);

alter table public.salesmen_advances
  add column if not exists source_category public.ledger_receipt_source
    not null default 'party_payment';

alter table public.salesmen_advances
  alter column salesman_id drop not null;

alter table public.salesmen_advances
  add constraint salesmen_advances_party_or_misc
    check (
      (source_category = 'party_payment' and salesman_id is not null)
      or (source_category <> 'party_payment')
    );

create index salesmen_advances_source_category_idx
  on public.salesmen_advances (source_category, received_at desc);

-- Realtime for new tables (safe to re-run)
do $$
declare
  t text;
  tables text[] := array['daily_expenses', 'salesmen_advances'];
begin
  foreach t in array tables loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        t
      );
    end if;
  end loop;
end $$;
