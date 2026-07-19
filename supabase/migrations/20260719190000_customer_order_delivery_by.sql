-- Delivery person on customer orders + allow order staff to see delivery employees

alter table public.customer_orders
  add column if not exists delivery_by uuid references public.profiles (id) on delete set null;

alter table public.customer_orders
  add column if not exists delivery_by_name text;

create index if not exists customer_orders_delivery_by_idx
  on public.customer_orders (delivery_by);

-- Let order-customers users list active delivery staff for assignment
create policy "Order-customers can view delivery staff"
  on public.profiles for select to authenticated
  using (
    public.user_has_module('order-customers')
    and account_type = 'employee'
    and is_active = true
    and role = 'delivery'
  );
