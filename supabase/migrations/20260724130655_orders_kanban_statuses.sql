-- Kanban statuses: rename ready → picking; add out_for_delivery + delivered.

drop policy if exists "Users with order-customers can delete draft customer orders"
  on public.customer_orders;

alter table public.customer_orders
  alter column status drop default;

alter table public.customer_orders
  alter column status type text using status::text;

update public.customer_orders
set status = 'picking'
where status = 'ready';

drop type public.customer_order_status;

create type public.customer_order_status as enum (
  'draft',
  'picking',
  'packed',
  'invoiced',
  'out_for_delivery',
  'delivered',
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
