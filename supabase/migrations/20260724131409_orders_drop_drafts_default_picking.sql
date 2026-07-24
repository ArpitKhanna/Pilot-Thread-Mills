-- New orders start confirmed (picking). Promote leftover drafts onto the board.

update public.customer_orders
set status = 'picking'
where status = 'draft';

alter table public.customer_orders
  alter column status set default 'picking'::public.customer_order_status;
