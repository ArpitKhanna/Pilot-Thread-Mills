-- Store actor display name on events so timeline works under profiles RLS.

alter table public.customer_order_events
  add column if not exists actor_name text;

update public.customer_order_events e
set actor_name = p.full_name
from public.profiles p
where e.actor_id = p.id
  and (e.actor_name is null or e.actor_name = '');
