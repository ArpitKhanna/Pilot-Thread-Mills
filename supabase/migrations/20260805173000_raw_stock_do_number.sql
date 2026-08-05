alter table public.raw_stock_movements
  add column if not exists do_number text;

alter table public.raw_stock_movements
  add constraint raw_stock_do_number_only_on_stock_in
  check (do_number is null or movement_type = 'stock_in');
