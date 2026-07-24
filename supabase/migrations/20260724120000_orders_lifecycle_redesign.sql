-- Orders lifecycle redesign: ready/packed statuses, urgent flags, delivery runs,
-- customer pending items, dyeing jobs, cloth patches on customer profile.

-- ---------------------------------------------------------------------------
-- Status enum: replace confirmed/picking with ready/packed
-- ---------------------------------------------------------------------------
-- Policy references status = 'draft'; drop before altering type
drop policy if exists "Users with order-customers can delete draft customer orders"
  on public.customer_orders;

alter table public.customer_orders
  alter column status drop default;

alter table public.customer_orders
  alter column status type text using status::text;

update public.customer_orders
set status = 'ready'
where status = 'confirmed';

update public.customer_orders
set status = 'invoiced'
where status = 'picking' and invoice_id is not null;

update public.customer_orders
set status = 'packed'
where status = 'picking' and invoice_id is null;

drop type public.customer_order_status;

create type public.customer_order_status as enum (
  'draft',
  'ready',
  'packed',
  'invoiced',
  'cancelled'
);

alter table public.customer_orders
  alter column status type public.customer_order_status
  using status::public.customer_order_status;

alter table public.customer_orders
  alter column status set default 'draft'::public.customer_order_status;

create policy "Users with order-customers can delete draft customer orders"
  on public.customer_orders for delete to authenticated
  using (
    public.user_has_module('order-customers')
    and status = 'draft'
  );

-- ---------------------------------------------------------------------------
-- Order + line urgency / area snapshot
-- ---------------------------------------------------------------------------
alter table public.customer_orders
  add column if not exists is_urgent boolean not null default false;

alter table public.customer_orders
  add column if not exists area_snapshot text;

alter table public.customer_order_lines
  add column if not exists is_urgent boolean not null default false;

create index if not exists customer_orders_is_urgent_idx
  on public.customer_orders (is_urgent)
  where is_urgent = true;

create index if not exists customer_orders_area_snapshot_idx
  on public.customer_orders (area_snapshot);

-- ---------------------------------------------------------------------------
-- Delivery runs (batch invoice + delivery assignment)
-- ---------------------------------------------------------------------------
create type public.delivery_run_status as enum (
  'open',
  'dispatched',
  'done'
);

create table public.delivery_runs (
  id uuid primary key default gen_random_uuid(),
  run_date date not null default (timezone('utc', now()))::date,
  area text,
  delivery_by uuid references public.profiles (id) on delete set null,
  delivery_by_name text,
  status public.delivery_run_status not null default 'open',
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index delivery_runs_run_date_idx
  on public.delivery_runs (run_date desc);
create index delivery_runs_delivery_by_idx
  on public.delivery_runs (delivery_by);
create index delivery_runs_status_idx
  on public.delivery_runs (status);

create table public.delivery_run_orders (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.delivery_runs (id) on delete cascade,
  order_id uuid not null references public.customer_orders (id) on delete cascade,
  invoice_id uuid references public.salesmen_invoices (id) on delete set null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint delivery_run_orders_order_unique unique (order_id)
);

create index delivery_run_orders_run_id_idx
  on public.delivery_run_orders (run_id);

alter table public.delivery_runs enable row level security;
alter table public.delivery_run_orders enable row level security;

create policy "Users with order-customers can view delivery runs"
  on public.delivery_runs for select to authenticated
  using (public.user_has_module('order-customers'));

create policy "Users with order-customers can insert delivery runs"
  on public.delivery_runs for insert to authenticated
  with check (public.user_has_module('order-customers'));

create policy "Users with order-customers can update delivery runs"
  on public.delivery_runs for update to authenticated
  using (public.user_has_module('order-customers'))
  with check (public.user_has_module('order-customers'));

create policy "Users with order-customers can delete delivery runs"
  on public.delivery_runs for delete to authenticated
  using (public.user_has_module('order-customers'));

create policy "Users with order-customers can view delivery run orders"
  on public.delivery_run_orders for select to authenticated
  using (public.user_has_module('order-customers'));

create policy "Users with order-customers can insert delivery run orders"
  on public.delivery_run_orders for insert to authenticated
  with check (public.user_has_module('order-customers'));

create policy "Users with order-customers can update delivery run orders"
  on public.delivery_run_orders for update to authenticated
  using (public.user_has_module('order-customers'))
  with check (public.user_has_module('order-customers'));

create policy "Users with order-customers can delete delivery run orders"
  on public.delivery_run_orders for delete to authenticated
  using (public.user_has_module('order-customers'));

create trigger delivery_runs_updated_at
  before update on public.delivery_runs
  for each row execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Customer pending / missing items (EOD upload)
-- ---------------------------------------------------------------------------
create type public.customer_pending_item_status as enum (
  'open',
  'in_dyeing',
  'ready',
  'fulfilled',
  'cancelled'
);

create type public.customer_pending_item_unit as enum (
  'box',
  'dibbi',
  'cone',
  'unit'
);

create table public.customer_pending_items (
  id uuid primary key default gen_random_uuid(),
  customer_id text not null references public.salesmen (id) on delete cascade,
  invoice_id uuid references public.salesmen_invoices (id) on delete set null,
  invoice_date date,
  order_id uuid references public.customer_orders (id) on delete set null,
  price_list_item_id uuid references public.price_list_items (id) on delete set null,
  shade_id uuid references public.item_shades (id) on delete set null,
  shade_code text not null default '',
  qty numeric(12, 3) not null check (qty > 0),
  unit public.customer_pending_item_unit not null default 'box',
  status public.customer_pending_item_status not null default 'open',
  is_urgent boolean not null default false,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customer_pending_items_customer_id_idx
  on public.customer_pending_items (customer_id);
create index customer_pending_items_status_idx
  on public.customer_pending_items (status);
create index customer_pending_items_invoice_date_idx
  on public.customer_pending_items (invoice_date desc);

alter table public.customer_pending_items enable row level security;

create policy "Users with order or entity customers can view pending items"
  on public.customer_pending_items for select to authenticated
  using (
    public.user_has_module('order-customers')
    or public.user_has_module('entity-customers')
    or public.user_has_module('dyeing-jobs')
  );

create policy "Users with order-customers can insert pending items"
  on public.customer_pending_items for insert to authenticated
  with check (public.user_has_module('order-customers'));

create policy "Users with order-customers can update pending items"
  on public.customer_pending_items for update to authenticated
  using (
    public.user_has_module('order-customers')
    or public.user_has_module('dyeing-jobs')
  )
  with check (
    public.user_has_module('order-customers')
    or public.user_has_module('dyeing-jobs')
  );

create policy "Users with order-customers can delete pending items"
  on public.customer_pending_items for delete to authenticated
  using (public.user_has_module('order-customers'));

create trigger customer_pending_items_updated_at
  before update on public.customer_pending_items
  for each row execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Customer cloth patches library (before dyeing_jobs FK)
-- ---------------------------------------------------------------------------
create type public.customer_cloth_patch_status as enum (
  'awaiting_shade',
  'assigned'
);

create table public.customer_cloth_patches (
  id uuid primary key default gen_random_uuid(),
  customer_id text not null references public.salesmen (id) on delete cascade,
  storage_path text not null,
  file_name text,
  content_type text,
  price_list_item_id uuid references public.price_list_items (id) on delete set null,
  shade_id uuid references public.item_shades (id) on delete set null,
  shade_code text,
  status public.customer_cloth_patch_status not null default 'awaiting_shade',
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customer_cloth_patches_customer_id_idx
  on public.customer_cloth_patches (customer_id);
create index customer_cloth_patches_status_idx
  on public.customer_cloth_patches (status);

alter table public.customer_cloth_patches enable row level security;

create policy "Users with entity or order customers can view cloth patches"
  on public.customer_cloth_patches for select to authenticated
  using (
    public.user_has_module('entity-customers')
    or public.user_has_module('order-customers')
    or public.user_has_module('dyeing-jobs')
  );

create policy "Users with entity or order customers can insert cloth patches"
  on public.customer_cloth_patches for insert to authenticated
  with check (
    public.user_has_module('entity-customers')
    or public.user_has_module('order-customers')
  );

create policy "Users with entity or order customers can update cloth patches"
  on public.customer_cloth_patches for update to authenticated
  using (
    public.user_has_module('entity-customers')
    or public.user_has_module('order-customers')
  )
  with check (
    public.user_has_module('entity-customers')
    or public.user_has_module('order-customers')
  );

create policy "Users with entity or order customers can delete cloth patches"
  on public.customer_cloth_patches for delete to authenticated
  using (
    public.user_has_module('entity-customers')
    or public.user_has_module('order-customers')
  );

create trigger customer_cloth_patches_updated_at
  before update on public.customer_cloth_patches
  for each row execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Dyeing jobs queue
-- ---------------------------------------------------------------------------
create type public.dyeing_job_status as enum (
  'queued',
  'dyeing',
  'done',
  'cancelled'
);

create table public.dyeing_jobs (
  id uuid primary key default gen_random_uuid(),
  customer_id text references public.salesmen (id) on delete set null,
  pending_item_id uuid references public.customer_pending_items (id) on delete set null,
  cloth_patch_id uuid references public.customer_cloth_patches (id) on delete set null,
  price_list_item_id uuid references public.price_list_items (id) on delete set null,
  shade_id uuid references public.item_shades (id) on delete set null,
  shade_code text not null default '',
  qty numeric(12, 3) not null default 1 check (qty > 0),
  unit public.customer_pending_item_unit not null default 'box',
  status public.dyeing_job_status not null default 'queued',
  is_urgent boolean not null default false,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index dyeing_jobs_status_idx on public.dyeing_jobs (status);
create index dyeing_jobs_customer_id_idx on public.dyeing_jobs (customer_id);
create index dyeing_jobs_pending_item_id_idx on public.dyeing_jobs (pending_item_id);
create index dyeing_jobs_is_urgent_idx
  on public.dyeing_jobs (is_urgent)
  where is_urgent = true;

alter table public.dyeing_jobs enable row level security;

create policy "Users with dyeing or order modules can view dyeing jobs"
  on public.dyeing_jobs for select to authenticated
  using (
    public.user_has_module('dyeing-jobs')
    or public.user_has_module('order-customers')
  );

create policy "Users with dyeing or order modules can insert dyeing jobs"
  on public.dyeing_jobs for insert to authenticated
  with check (
    public.user_has_module('dyeing-jobs')
    or public.user_has_module('order-customers')
  );

create policy "Users with dyeing or order modules can update dyeing jobs"
  on public.dyeing_jobs for update to authenticated
  using (
    public.user_has_module('dyeing-jobs')
    or public.user_has_module('order-customers')
  )
  with check (
    public.user_has_module('dyeing-jobs')
    or public.user_has_module('order-customers')
  );

create policy "Users with dyeing or order modules can delete dyeing jobs"
  on public.dyeing_jobs for delete to authenticated
  using (
    public.user_has_module('dyeing-jobs')
    or public.user_has_module('order-customers')
  );

create trigger dyeing_jobs_updated_at
  before update on public.dyeing_jobs
  for each row execute function public.handle_updated_at();

-- Storage: widen customer-order-files access for entity-customers + dyeing
drop policy if exists "order-customers can upload customer order files" on storage.objects;
create policy "order-customers can upload customer order files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'customer-order-files'
    and (
      public.user_has_module('order-customers')
      or public.user_has_module('entity-customers')
    )
  );

drop policy if exists "order-customers can read customer order files" on storage.objects;
create policy "order-customers can read customer order files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'customer-order-files'
    and (
      public.user_has_module('order-customers')
      or public.user_has_module('entity-customers')
      or public.user_has_module('dyeing-jobs')
    )
  );

drop policy if exists "order-customers can update customer order files" on storage.objects;
create policy "order-customers can update customer order files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'customer-order-files'
    and (
      public.user_has_module('order-customers')
      or public.user_has_module('entity-customers')
    )
  )
  with check (
    bucket_id = 'customer-order-files'
    and (
      public.user_has_module('order-customers')
      or public.user_has_module('entity-customers')
    )
  );

drop policy if exists "order-customers can delete customer order files" on storage.objects;
create policy "order-customers can delete customer order files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'customer-order-files'
    and (
      public.user_has_module('order-customers')
      or public.user_has_module('entity-customers')
    )
  );

-- ---------------------------------------------------------------------------
-- Accountant access to order + dyeing modules (primary operators)
-- ---------------------------------------------------------------------------
insert into public.role_module_access (role, module_id)
values
  ('accountant', 'order-customers'),
  ('accountant', 'entity-customers'),
  ('accountant', 'dyeing-jobs'),
  ('accountant', 'order-salesmen'),
  ('accountant', 'entity-salesmen')
on conflict do nothing;

update public.modules
set section = 'orders',
    sort_order = 8,
    href = '/dyeing-jobs',
    label = 'Dyeing Jobs'
where id = 'dyeing-jobs';

update public.modules
set sort_order = 9
where id = 'order-customers';

update public.modules
set sort_order = 10
where id = 'order-salesmen';
