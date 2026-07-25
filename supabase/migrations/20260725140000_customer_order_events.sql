-- Activity log for customer orders (who did what, newest first in UI).

create table public.customer_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.customer_orders (id) on delete cascade,
  kind text not null,
  message text not null,
  from_status text,
  to_status text,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index customer_order_events_order_id_created_at_idx
  on public.customer_order_events (order_id, created_at desc);

alter table public.customer_order_events enable row level security;

create policy "Users with order-customers can view customer order events"
  on public.customer_order_events for select to authenticated
  using (public.user_has_module('order-customers'));

create policy "Users with order-customers can insert customer order events"
  on public.customer_order_events for insert to authenticated
  with check (public.user_has_module('order-customers'));

-- Backfill a created event for existing orders
insert into public.customer_order_events (
  order_id,
  kind,
  message,
  to_status,
  actor_id,
  created_at
)
select
  o.id,
  'created',
  'Order was created.',
  o.status::text,
  o.created_by,
  o.created_at
from public.customer_orders o;
