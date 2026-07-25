-- Persist free-text / manual item names on order lines so they can
-- populate invoices even without a price-list link.
alter table public.customer_order_lines
  add column if not exists item_name text not null default '';

update public.customer_order_lines as col
set item_name = pli.item_name
from public.price_list_items as pli
where col.price_list_item_id = pli.id
  and col.item_name = '';
