-- Raw Stock Status: suppliers + movement ledger, module + RBAC

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------
create type public.raw_stock_movement_type as enum (
  'opening_balance',
  'purchase',
  'send_to_narela',
  'mark_dyed',
  'receive_from_narela'
);

-- ---------------------------------------------------------------------------
-- Suppliers
-- ---------------------------------------------------------------------------
create table public.raw_stock_suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint raw_stock_suppliers_name_not_blank check (length(trim(name)) > 0)
);

create unique index raw_stock_suppliers_name_unique
  on public.raw_stock_suppliers (lower(trim(name)));

create index raw_stock_suppliers_is_active_idx
  on public.raw_stock_suppliers (is_active);

alter table public.raw_stock_suppliers enable row level security;

create policy "Users with raw-stock-status can view suppliers"
  on public.raw_stock_suppliers for select to authenticated
  using (public.user_has_module('raw-stock-status'));

create policy "Users with raw-stock-status can insert suppliers"
  on public.raw_stock_suppliers for insert to authenticated
  with check (public.user_has_module('raw-stock-status'));

create policy "Users with raw-stock-status can update suppliers"
  on public.raw_stock_suppliers for update to authenticated
  using (public.user_has_module('raw-stock-status'))
  with check (public.user_has_module('raw-stock-status'));

create trigger raw_stock_suppliers_updated_at
  before update on public.raw_stock_suppliers
  for each row execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Movements (append-only ledger)
-- ---------------------------------------------------------------------------
create table public.raw_stock_movements (
  id uuid primary key default gen_random_uuid(),
  movement_type public.raw_stock_movement_type not null,
  count_label text not null,
  quantity_kg numeric(12, 3) not null check (quantity_kg > 0),
  movement_date date not null default (timezone('utc', now()))::date,
  supplier_id uuid references public.raw_stock_suppliers (id) on delete restrict,
  price_per_kg numeric(12, 2) check (price_per_kg is null or price_per_kg >= 0),
  shade_id uuid references public.item_shades (id) on delete set null,
  shade_code_text text,
  color_label text,
  customer_id text references public.salesmen (id) on delete set null,
  related_movement_id uuid references public.raw_stock_movements (id) on delete restrict,
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint raw_stock_movements_count_not_blank check (length(trim(count_label)) > 0),
  constraint raw_stock_purchase_requires_supplier check (
    movement_type <> 'purchase' or supplier_id is not null
  ),
  constraint raw_stock_receive_requires_related check (
    movement_type <> 'receive_from_narela' or related_movement_id is not null
  )
);

create index raw_stock_movements_date_idx
  on public.raw_stock_movements (movement_date desc, created_at desc);
create index raw_stock_movements_type_idx
  on public.raw_stock_movements (movement_type);
create index raw_stock_movements_count_idx
  on public.raw_stock_movements (count_label);
create index raw_stock_movements_supplier_idx
  on public.raw_stock_movements (supplier_id);
create index raw_stock_movements_related_idx
  on public.raw_stock_movements (related_movement_id);
create index raw_stock_movements_customer_idx
  on public.raw_stock_movements (customer_id);

alter table public.raw_stock_movements enable row level security;

create policy "Users with raw-stock-status can view movements"
  on public.raw_stock_movements for select to authenticated
  using (public.user_has_module('raw-stock-status'));

create policy "Users with raw-stock-status can insert movements"
  on public.raw_stock_movements for insert to authenticated
  with check (public.user_has_module('raw-stock-status'));

-- No update/delete policies — append-only ledger

-- ---------------------------------------------------------------------------
-- Module + RBAC
-- ---------------------------------------------------------------------------
update public.modules set sort_order = 6 where id = 'picker-queue';
update public.modules set sort_order = 7 where id = 'dyeing-jobs';

insert into public.modules (id, name, section, href, sort_order) values
  ('raw-stock-status', 'Raw Stock Status', 'overview', '/raw-stock-status', 5)
on conflict (id) do update set
  name = excluded.name,
  section = excluded.section,
  href = excluded.href,
  sort_order = excluded.sort_order;

insert into public.role_module_access (role, module_id) values
  ('admin', 'raw-stock-status'),
  ('accountant', 'raw-stock-status')
on conflict do nothing;

-- Allow raw-stock module to read customers + shades for dyeing forms
drop policy if exists "Users with salesmen modules can view salesmen" on public.salesmen;
create policy "Users with salesmen modules can view salesmen"
  on public.salesmen for select to authenticated
  using (
    public.user_has_module('entity-salesmen')
    or public.user_has_module('order-salesmen')
    or public.user_has_module('order-customers')
    or public.user_has_module('entity-customers')
    or public.user_has_module('raw-stock-status')
  );

drop policy if exists "Users with order-customers or price-list can view shades" on public.item_shades;
create policy "Users with order-customers or price-list can view shades"
  on public.item_shades for select to authenticated
  using (
    public.user_has_module('order-customers')
    or public.user_has_module('price-list')
    or public.user_has_module('order-salesmen')
    or public.user_has_module('entity-salesmen')
    or public.user_has_module('raw-stock-status')
  );
