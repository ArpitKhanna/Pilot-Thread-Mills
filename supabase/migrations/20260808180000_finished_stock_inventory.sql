-- Finished goods inventory: Ellfa 270 Mtr dibbis ledger + shade card layout

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------
create type public.finished_stock_movement_type as enum (
  'opening_balance',
  'stock_in',
  'stock_out',
  'adjustment'
);

-- ---------------------------------------------------------------------------
-- Extend item_shades (grid layout + replenishment thresholds)
-- ---------------------------------------------------------------------------
alter table public.item_shades
  add column if not exists card_column smallint,
  add column if not exists card_row smallint,
  add column if not exists min_stock_threshold smallint,
  add column if not exists target_stock_level smallint;

alter table public.item_shades
  add constraint item_shades_card_column_positive
  check (card_column is null or card_column > 0);

alter table public.item_shades
  add constraint item_shades_card_row_positive
  check (card_row is null or (card_row >= 1 and card_row <= 24));

alter table public.item_shades
  add constraint item_shades_min_threshold_positive
  check (min_stock_threshold is null or min_stock_threshold >= 0);

alter table public.item_shades
  add constraint item_shades_target_level_positive
  check (target_stock_level is null or target_stock_level > 0);

-- ---------------------------------------------------------------------------
-- Extend customer_order_lines (fulfilled qty at packing)
-- ---------------------------------------------------------------------------
alter table public.customer_order_lines
  add column if not exists fulfilled_qty numeric(12, 3)
  check (fulfilled_qty is null or fulfilled_qty >= 0);

-- ---------------------------------------------------------------------------
-- Finished stock movements (append-only ledger)
-- ---------------------------------------------------------------------------
create table public.finished_stock_movements (
  id uuid primary key default gen_random_uuid(),
  movement_type public.finished_stock_movement_type not null,
  price_list_item_id uuid not null references public.price_list_items (id) on delete restrict,
  shade_id uuid not null references public.item_shades (id) on delete restrict,
  shade_code text not null,
  unit public.customer_pending_item_unit not null default 'dibbi',
  quantity numeric(12, 3) not null check (quantity > 0),
  movement_date date not null default (timezone('utc', now()))::date,
  order_id uuid references public.customer_orders (id) on delete set null,
  order_line_id uuid references public.customer_order_lines (id) on delete set null,
  dyeing_job_id uuid references public.dyeing_jobs (id) on delete set null,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint finished_stock_shade_code_not_blank check (length(trim(shade_code)) > 0)
);

create index finished_stock_movements_item_shade_idx
  on public.finished_stock_movements (price_list_item_id, shade_id);

create index finished_stock_movements_date_idx
  on public.finished_stock_movements (movement_date desc, created_at desc);

create index finished_stock_movements_type_idx
  on public.finished_stock_movements (movement_type);

create index finished_stock_movements_order_line_idx
  on public.finished_stock_movements (order_line_id)
  where order_line_id is not null;

create unique index finished_stock_movements_order_line_stock_out_unique
  on public.finished_stock_movements (order_line_id)
  where movement_type = 'stock_out' and order_line_id is not null;

create unique index finished_stock_movements_dyeing_job_stock_in_unique
  on public.finished_stock_movements (dyeing_job_id)
  where movement_type = 'stock_in' and dyeing_job_id is not null;

alter table public.finished_stock_movements enable row level security;

create policy "Users with inventory or order-customers can view finished stock"
  on public.finished_stock_movements for select to authenticated
  using (
    public.user_has_module('inventory')
    or public.user_has_module('order-customers')
  );

create policy "Users with inventory can insert finished stock"
  on public.finished_stock_movements for insert to authenticated
  with check (public.user_has_module('inventory'));

create policy "Users with inventory can update finished stock"
  on public.finished_stock_movements for update to authenticated
  using (public.user_has_module('inventory'))
  with check (public.user_has_module('inventory'));

create policy "Users with inventory can delete finished stock"
  on public.finished_stock_movements for delete to authenticated
  using (public.user_has_module('inventory'));

-- Inventory module users can update shade thresholds
create policy "Users with inventory can update shade thresholds"
  on public.item_shades for update to authenticated
  using (
    public.user_has_module('inventory')
    or public.user_has_module('order-customers')
  )
  with check (
    public.user_has_module('inventory')
    or public.user_has_module('order-customers')
  );

-- ---------------------------------------------------------------------------
-- Seed Ellfa 270 Mtr + 940 shades (1–936 + named)
-- ---------------------------------------------------------------------------
insert into public.price_list_items (
  item_name,
  item_type,
  count_label,
  salesmen_price,
  customer_price,
  status,
  created_by,
  approved_by,
  approved_at
)
select
  'Ellfa 270 Mtr.',
  'dibbi'::public.item_type,
  '1/4',
  420,
  420,
  'approved'::public.price_item_status,
  p.id,
  p.id,
  now()
from public.profiles p
where p.role = 'admin'
  and not exists (
    select 1 from public.price_list_items pli
    where lower(trim(pli.item_name)) = lower('Ellfa 270 Mtr.')
  )
limit 1;

do $$
declare
  v_item_id uuid;
  v_num int;
  v_col int;
  v_row int;
  v_named text[];
  v_code text;
  v_i int;
begin
  select id into v_item_id
  from public.price_list_items
  where lower(trim(item_name)) = lower('Ellfa 270 Mtr.')
  limit 1;

  if v_item_id is null then
    raise exception 'Ellfa 270 Mtr. price list item not found';
  end if;

  for v_num in 1..936 loop
    v_col := ((v_num - 1) / 24) + 1;
    v_row := ((v_num - 1) % 24) + 1;
    insert into public.item_shades (
      price_list_item_id,
      shade_code,
      card_column,
      card_row
    )
    values (v_item_id, v_num::text, v_col, v_row)
    on conflict (price_list_item_id, shade_code) do update
      set card_column = excluded.card_column,
          card_row = excluded.card_row;
  end loop;

  v_named := array['BLACK', 'WHITE', 'CREAM', 'HALFWHITE'];
  for v_i in 1..array_length(v_named, 1) loop
    v_code := v_named[v_i];
    insert into public.item_shades (
      price_list_item_id,
      shade_code,
      card_column,
      card_row
    )
    values (v_item_id, v_code, 40, v_i)
    on conflict (price_list_item_id, shade_code) do update
      set card_column = excluded.card_column,
          card_row = excluded.card_row;
  end loop;
end $$;
