-- Roles, module access, and price list with approval workflow

-- Replace employee roles
alter type public.employee_role rename to employee_role_old;

create type public.employee_role as enum (
  'admin',
  'accountant',
  'picker',
  'delivery',
  'dyeing_user'
);

alter table public.profiles
  alter column role type public.employee_role
  using (
    case role::text
      when 'admin' then 'admin'::public.employee_role
      when 'manager' then 'accountant'::public.employee_role
      when 'operator' then 'picker'::public.employee_role
      else null
    end
  );

drop type public.employee_role_old;

-- Modules registry
create table public.modules (
  id text primary key,
  name text not null,
  section text not null check (section in ('overview', 'orders', 'entities')),
  href text not null,
  sort_order int not null default 0
);

alter table public.modules enable row level security;

create policy "Authenticated users can view modules"
  on public.modules for select to authenticated using (true);

-- Role ↔ module access (admin manages via future UI; seeded below)
create table public.role_module_access (
  role public.employee_role not null,
  module_id text not null references public.modules (id) on delete cascade,
  primary key (role, module_id)
);

alter table public.role_module_access enable row level security;

create policy "Authenticated users can view role module access"
  on public.role_module_access for select to authenticated using (true);

create policy "Admins can manage role module access"
  on public.role_module_access for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Price list
create type public.item_type as enum ('dibbi', 'box', 'cone', 'zip', 'elastic');

create type public.price_item_status as enum (
  'approved',
  'pending_approval',
  'rejected'
);

create table public.price_list_items (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  item_type public.item_type not null,
  count_label text,
  salesmen_price numeric(10, 2) not null check (salesmen_price >= 0),
  customer_price numeric(10, 2) not null check (customer_price >= 0),
  status public.price_item_status not null default 'pending_approval',
  created_by uuid not null references public.profiles (id),
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index price_list_items_status_idx on public.price_list_items (status);
create index price_list_items_item_type_idx on public.price_list_items (item_type);
create index price_list_items_item_name_idx on public.price_list_items (item_name);

alter table public.price_list_items enable row level security;

create or replace function public.user_has_module(module_slug text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    join public.role_module_access rma on rma.role = p.role
    where p.id = auth.uid()
      and p.is_active = true
      and rma.module_id = module_slug
  );
$$;

create policy "Users with price-list access can view approved items"
  on public.price_list_items for select to authenticated
  using (
    public.user_has_module('price-list')
    and (
      status = 'approved'
      or public.is_admin()
      or created_by = auth.uid()
    )
  );

create policy "Users with price-list access can insert items"
  on public.price_list_items for insert to authenticated
  with check (public.user_has_module('price-list'));

create policy "Users can update own pending or admins update any"
  on public.price_list_items for update to authenticated
  using (
    public.user_has_module('price-list')
    and (
      public.is_admin()
      or (created_by = auth.uid() and status = 'pending_approval')
    )
  )
  with check (public.user_has_module('price-list'));

create policy "Admins can delete price list items"
  on public.price_list_items for delete to authenticated
  using (public.is_admin() and public.user_has_module('price-list'));

create trigger price_list_items_updated_at
  before update on public.price_list_items
  for each row execute function public.handle_updated_at();

-- Seed modules
insert into public.modules (id, name, section, href, sort_order) values
  ('dashboard', 'Dashboard', 'overview', '/dashboard', 1),
  ('payments', 'Payments', 'overview', '/payments', 2),
  ('expenses', 'Expenses', 'overview', '/expenses', 3),
  ('inventory', 'Inventory', 'overview', '/inventory', 4),
  ('picker-queue', 'Picker Queue', 'overview', '/picker-queue', 5),
  ('dyeing-jobs', 'Dyeing Jobs', 'overview', '/dyeing-jobs', 6),
  ('order-customers', 'Customers', 'orders', '/orders/customers', 7),
  ('order-salesmen', 'Salesmen', 'orders', '/orders/salesmen', 8),
  ('entity-customers', 'Customers', 'entities', '/entities/customers', 9),
  ('entity-salesmen', 'Salesmen', 'entities', '/entities/salesmen', 10),
  ('bank-accounts', 'Bank Accounts', 'entities', '/entities/bank-accounts', 11),
  ('price-list', 'Price List', 'entities', '/entities/price-list', 12),
  ('employees-roles', 'Employees & Roles', 'entities', '/entities/employees', 13);

-- Default role access
insert into public.role_module_access (role, module_id)
select 'admin', id from public.modules;

insert into public.role_module_access (role, module_id) values
  ('accountant', 'dashboard'),
  ('accountant', 'payments'),
  ('accountant', 'expenses'),
  ('accountant', 'inventory'),
  ('accountant', 'price-list'),
  ('accountant', 'bank-accounts'),
  ('picker', 'dashboard'),
  ('picker', 'inventory'),
  ('picker', 'picker-queue'),
  ('delivery', 'dashboard'),
  ('delivery', 'order-customers'),
  ('delivery', 'order-salesmen'),
  ('dyeing_user', 'dashboard'),
  ('dyeing_user', 'dyeing-jobs');

-- Sample approved price list items
insert into public.price_list_items (
  item_name, item_type, count_label, salesmen_price, customer_price,
  status, created_by, approved_by, approved_at
)
select
  v.item_name,
  v.item_type::public.item_type,
  v.count_label,
  v.salesmen_price,
  v.customer_price,
  'approved'::public.price_item_status,
  p.id,
  p.id,
  now()
from public.profiles p
cross join (values
  ('Army 300 Mtr.', 'box', '3/16', 330, 315),
  ('Ellfa 150 Mtr.', 'dibbi', '1/4', 420, 420),
  ('Needle Poly 185 Mtr.', 'cone', '3/32', 510, 510),
  ('Pen Poly 135 Mtr.', 'zip', '1/8', 290, 290),
  ('Selfy 300 Mtr.', 'elastic', '1/16', 800, 800),
  ('Optima 300 Mtr.', 'box', '3/58', 300, 300),
  ('Kohinoor 1000 Mtr.', 'cone', '3/64', 300, 300),
  ('Hunter 300 Mtr.', 'dibbi', '1/8', 300, 300),
  ('Target 400 Mtr.', 'box', '1/16', 300, 300)
) as v(item_name, item_type, count_label, salesmen_price, customer_price)
where p.role = 'admin'
limit 9;
