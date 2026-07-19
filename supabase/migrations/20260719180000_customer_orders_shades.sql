-- Customer orders: shades, order slips, OCR drafts, convert to invoice

-- ---------------------------------------------------------------------------
-- item_shades (price by item, fulfill by shade)
-- ---------------------------------------------------------------------------
create table public.item_shades (
  id uuid primary key default gen_random_uuid(),
  price_list_item_id uuid not null references public.price_list_items (id) on delete cascade,
  shade_code text not null,
  color_label text,
  color_hex text,
  patch_storage_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint item_shades_code_not_blank check (length(trim(shade_code)) > 0),
  constraint item_shades_item_code_unique unique (price_list_item_id, shade_code)
);

create index item_shades_price_list_item_id_idx
  on public.item_shades (price_list_item_id);
create index item_shades_shade_code_idx
  on public.item_shades (shade_code);

alter table public.item_shades enable row level security;

create policy "Users with order-customers or price-list can view shades"
  on public.item_shades for select to authenticated
  using (
    public.user_has_module('order-customers')
    or public.user_has_module('price-list')
    or public.user_has_module('order-salesmen')
    or public.user_has_module('entity-salesmen')
  );

create policy "Users with order-customers can insert shades"
  on public.item_shades for insert to authenticated
  with check (public.user_has_module('order-customers'));

create policy "Users with order-customers can update shades"
  on public.item_shades for update to authenticated
  using (public.user_has_module('order-customers'))
  with check (public.user_has_module('order-customers'));

create trigger item_shades_updated_at
  before update on public.item_shades
  for each row execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- customer_orders
-- ---------------------------------------------------------------------------
create type public.customer_order_status as enum (
  'draft',
  'confirmed',
  'picking',
  'invoiced',
  'cancelled'
);

create table public.customer_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id text not null references public.salesmen (id),
  status public.customer_order_status not null default 'draft',
  order_date date not null default (timezone('utc', now()))::date,
  notes text,
  invoice_id uuid references public.salesmen_invoices (id) on delete set null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customer_orders_customer_id_idx
  on public.customer_orders (customer_id);
create index customer_orders_status_idx
  on public.customer_orders (status);
create index customer_orders_order_date_idx
  on public.customer_orders (order_date desc);

alter table public.customer_orders enable row level security;

create policy "Users with order-customers can view customer orders"
  on public.customer_orders for select to authenticated
  using (public.user_has_module('order-customers'));

create policy "Users with order-customers can insert customer orders"
  on public.customer_orders for insert to authenticated
  with check (public.user_has_module('order-customers'));

create policy "Users with order-customers can update customer orders"
  on public.customer_orders for update to authenticated
  using (public.user_has_module('order-customers'))
  with check (public.user_has_module('order-customers'));

create policy "Users with order-customers can delete draft customer orders"
  on public.customer_orders for delete to authenticated
  using (
    public.user_has_module('order-customers')
    and status = 'draft'
  );

create trigger customer_orders_updated_at
  before update on public.customer_orders
  for each row execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- attachments (order slips + cloth patches at order level)
-- ---------------------------------------------------------------------------
create type public.customer_order_attachment_kind as enum (
  'order_slip',
  'cloth_patch'
);

create table public.customer_order_attachments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.customer_orders (id) on delete cascade,
  kind public.customer_order_attachment_kind not null default 'order_slip',
  storage_path text not null,
  file_name text,
  content_type text,
  ocr_raw_json jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index customer_order_attachments_order_id_idx
  on public.customer_order_attachments (order_id);

alter table public.customer_order_attachments enable row level security;

create policy "Users with order-customers can view attachments"
  on public.customer_order_attachments for select to authenticated
  using (public.user_has_module('order-customers'));

create policy "Users with order-customers can insert attachments"
  on public.customer_order_attachments for insert to authenticated
  with check (public.user_has_module('order-customers'));

create policy "Users with order-customers can update attachments"
  on public.customer_order_attachments for update to authenticated
  using (public.user_has_module('order-customers'))
  with check (public.user_has_module('order-customers'));

create policy "Users with order-customers can delete attachments"
  on public.customer_order_attachments for delete to authenticated
  using (public.user_has_module('order-customers'));

-- ---------------------------------------------------------------------------
-- order lines
-- ---------------------------------------------------------------------------
create type public.customer_order_line_source as enum ('ocr', 'manual');
create type public.customer_order_line_unit as enum ('box', 'dibbi', 'cone', 'unit');

create table public.customer_order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.customer_orders (id) on delete cascade,
  price_list_item_id uuid references public.price_list_items (id) on delete set null,
  shade_id uuid references public.item_shades (id) on delete set null,
  shade_code text not null default '',
  qty numeric(12, 3) not null check (qty > 0),
  unit public.customer_order_line_unit not null default 'box',
  source public.customer_order_line_source not null default 'manual',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index customer_order_lines_order_id_idx
  on public.customer_order_lines (order_id);

alter table public.customer_order_lines enable row level security;

create policy "Users with order-customers can view order lines"
  on public.customer_order_lines for select to authenticated
  using (public.user_has_module('order-customers'));

create policy "Users with order-customers can insert order lines"
  on public.customer_order_lines for insert to authenticated
  with check (public.user_has_module('order-customers'));

create policy "Users with order-customers can update order lines"
  on public.customer_order_lines for update to authenticated
  using (public.user_has_module('order-customers'))
  with check (public.user_has_module('order-customers'));

create policy "Users with order-customers can delete order lines"
  on public.customer_order_lines for delete to authenticated
  using (public.user_has_module('order-customers'));

-- ---------------------------------------------------------------------------
-- Invoice line shade traceability + convert access for order-customers
-- ---------------------------------------------------------------------------
alter table public.salesmen_invoice_lines
  add column if not exists shade_id uuid references public.item_shades (id) on delete set null;

alter table public.salesmen_invoice_lines
  add column if not exists shade_code text;

-- Allow order-customers module to read customer parties
drop policy if exists "Users with salesmen modules can view salesmen" on public.salesmen;
create policy "Users with salesmen modules can view salesmen"
  on public.salesmen for select to authenticated
  using (
    public.user_has_module('entity-salesmen')
    or public.user_has_module('order-salesmen')
    or public.user_has_module('order-customers')
    or public.user_has_module('entity-customers')
  );

-- Allow order-customers to create customers (quick create)
drop policy if exists "Users with entity-salesmen can insert salesmen" on public.salesmen;
create policy "Users with entity modules can insert salesmen"
  on public.salesmen for insert to authenticated
  with check (
    public.user_has_module('entity-salesmen')
    or public.user_has_module('entity-customers')
    or public.user_has_module('order-customers')
  );

-- Invoice write access for converting customer orders
drop policy if exists "Users with salesmen modules can view invoices" on public.salesmen_invoices;
create policy "Users with salesmen modules can view invoices"
  on public.salesmen_invoices for select to authenticated
  using (
    public.user_has_module('entity-salesmen')
    or public.user_has_module('order-salesmen')
    or public.user_has_module('order-customers')
  );

drop policy if exists "Users with order-salesmen can insert invoices" on public.salesmen_invoices;
create policy "Users with order modules can insert invoices"
  on public.salesmen_invoices for insert to authenticated
  with check (
    public.user_has_module('order-salesmen')
    or public.user_has_module('order-customers')
  );

drop policy if exists "Users with order-salesmen can update invoices" on public.salesmen_invoices;
create policy "Users with order modules can update invoices"
  on public.salesmen_invoices for update to authenticated
  using (
    public.user_has_module('order-salesmen')
    or public.user_has_module('order-customers')
  )
  with check (
    public.user_has_module('order-salesmen')
    or public.user_has_module('order-customers')
  );

drop policy if exists "Users with salesmen modules can view invoice lines" on public.salesmen_invoice_lines;
create policy "Users with salesmen modules can view invoice lines"
  on public.salesmen_invoice_lines for select to authenticated
  using (
    public.user_has_module('entity-salesmen')
    or public.user_has_module('order-salesmen')
    or public.user_has_module('order-customers')
  );

drop policy if exists "Users with order-salesmen can insert invoice lines" on public.salesmen_invoice_lines;
create policy "Users with order modules can insert invoice lines"
  on public.salesmen_invoice_lines for insert to authenticated
  with check (
    public.user_has_module('order-salesmen')
    or public.user_has_module('order-customers')
  );

drop policy if exists "Users with order-salesmen can update invoice lines" on public.salesmen_invoice_lines;
create policy "Users with order modules can update invoice lines"
  on public.salesmen_invoice_lines for update to authenticated
  using (
    public.user_has_module('order-salesmen')
    or public.user_has_module('order-customers')
  )
  with check (
    public.user_has_module('order-salesmen')
    or public.user_has_module('order-customers')
  );

drop policy if exists "Users with order-salesmen can delete invoice lines" on public.salesmen_invoice_lines;
create policy "Users with order modules can delete invoice lines"
  on public.salesmen_invoice_lines for delete to authenticated
  using (
    public.user_has_module('order-salesmen')
    or public.user_has_module('order-customers')
  );

drop policy if exists "Users with salesmen modules can view invoice payments" on public.salesmen_invoice_payments;
create policy "Users with salesmen modules can view invoice payments"
  on public.salesmen_invoice_payments for select to authenticated
  using (
    public.user_has_module('entity-salesmen')
    or public.user_has_module('order-salesmen')
    or public.user_has_module('order-customers')
  );

drop policy if exists "Users with order-salesmen can insert invoice payments" on public.salesmen_invoice_payments;
create policy "Users with order modules can insert invoice payments"
  on public.salesmen_invoice_payments for insert to authenticated
  with check (
    public.user_has_module('order-salesmen')
    or public.user_has_module('order-customers')
  );

drop policy if exists "Users with order-salesmen can update invoice payments" on public.salesmen_invoice_payments;
create policy "Users with order modules can update invoice payments"
  on public.salesmen_invoice_payments for update to authenticated
  using (
    public.user_has_module('order-salesmen')
    or public.user_has_module('order-customers')
  )
  with check (
    public.user_has_module('order-salesmen')
    or public.user_has_module('order-customers')
  );

drop policy if exists "Users with order-salesmen can delete invoice payments" on public.salesmen_invoice_payments;
create policy "Users with order modules can delete invoice payments"
  on public.salesmen_invoice_payments for delete to authenticated
  using (
    public.user_has_module('order-salesmen')
    or public.user_has_module('order-customers')
  );

-- Bank accounts readable for convert-invoice payments
drop policy if exists "Authenticated users with bank or order access can view bank accounts"
  on public.bank_accounts;
create policy "Authenticated users with bank or order access can view bank accounts"
  on public.bank_accounts for select to authenticated
  using (
    public.user_has_module('bank-accounts')
    or public.user_has_module('order-salesmen')
    or public.user_has_module('order-customers')
    or public.user_has_module('entity-salesmen')
  );

-- Approved price list readable for customer/salesmen order flows
create policy "Users with order modules can view approved price list"
  on public.price_list_items for select to authenticated
  using (
    (
      public.user_has_module('order-customers')
      or public.user_has_module('order-salesmen')
    )
    and status = 'approved'
  );

-- ---------------------------------------------------------------------------
-- Storage bucket for order slips + shade patches
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'customer-order-files',
  'customer-order-files',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do nothing;

create policy "order-customers can upload customer order files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'customer-order-files'
    and public.user_has_module('order-customers')
  );

create policy "order-customers can read customer order files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'customer-order-files'
    and public.user_has_module('order-customers')
  );

create policy "order-customers can update customer order files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'customer-order-files'
    and public.user_has_module('order-customers')
  )
  with check (
    bucket_id = 'customer-order-files'
    and public.user_has_module('order-customers')
  );

create policy "order-customers can delete customer order files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'customer-order-files'
    and public.user_has_module('order-customers')
  );
