-- Allow deleting confirmed picking orders (drafts no longer used in the flow).

drop policy if exists "Users with order-customers can delete draft customer orders"
  on public.customer_orders;

create policy "Users with order-customers can delete picking customer orders"
  on public.customer_orders for delete to authenticated
  using (
    public.user_has_module('order-customers')
    and status in ('draft', 'picking')
  );
