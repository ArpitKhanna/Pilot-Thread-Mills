-- Rebuild Raw Stock Status as Narela-only Hank/Cone inventory ledger.
-- Clears existing movements (old Rama↔Narela dyeing pipeline).

-- ---------------------------------------------------------------------------
-- Clear old ledger data
-- ---------------------------------------------------------------------------
delete from public.raw_stock_movements;

-- ---------------------------------------------------------------------------
-- Drop old constraints / indexes on columns we remove
-- ---------------------------------------------------------------------------
alter table public.raw_stock_movements
  drop constraint if exists raw_stock_purchase_requires_supplier;

alter table public.raw_stock_movements
  drop constraint if exists raw_stock_receive_requires_related;

drop index if exists public.raw_stock_movements_related_idx;
drop index if exists public.raw_stock_movements_customer_idx;

-- ---------------------------------------------------------------------------
-- Drop unused dyeing / price / lot columns
-- ---------------------------------------------------------------------------
alter table public.raw_stock_movements
  drop column if exists price_per_kg,
  drop column if exists shade_id,
  drop column if exists shade_code_text,
  drop column if exists color_label,
  drop column if exists customer_id,
  drop column if exists related_movement_id;

-- ---------------------------------------------------------------------------
-- Replace movement_type enum: opening_balance | stock_in | stock_out
-- ---------------------------------------------------------------------------
alter table public.raw_stock_movements
  alter column movement_type type text
  using movement_type::text;

drop type public.raw_stock_movement_type;

create type public.raw_stock_movement_type as enum (
  'opening_balance',
  'stock_in',
  'stock_out'
);

alter table public.raw_stock_movements
  alter column movement_type type public.raw_stock_movement_type
  using movement_type::public.raw_stock_movement_type;

-- ---------------------------------------------------------------------------
-- Category (hank | cone) — inventory key with count_label
-- ---------------------------------------------------------------------------
alter table public.raw_stock_movements
  add column category text not null default 'hank';

alter table public.raw_stock_movements
  add constraint raw_stock_movements_category_check
  check (category in ('hank', 'cone'));

alter table public.raw_stock_movements
  alter column category drop default;

create index raw_stock_movements_category_count_idx
  on public.raw_stock_movements (category, count_label);

-- Supplier only allowed on stock_in (optional there; forbidden elsewhere)
alter table public.raw_stock_movements
  add constraint raw_stock_supplier_only_on_stock_in
  check (supplier_id is null or movement_type = 'stock_in');
