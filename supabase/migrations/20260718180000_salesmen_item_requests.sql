-- Urgent item requests from salesmen (open → fulfilled)

create type public.item_request_status as enum ('open', 'fulfilled');

create table public.salesmen_item_requests (
  id uuid primary key default gen_random_uuid(),
  salesman_id text not null references public.salesmen (id) on delete cascade,
  item_name text not null,
  price_list_item_id uuid references public.price_list_items (id) on delete set null,
  qty numeric(12, 2) not null default 1 check (qty > 0),
  requested_at timestamptz not null default now(),
  notes text,
  status public.item_request_status not null default 'open',
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint salesmen_item_requests_fulfilled_check check (
    (status = 'open' and fulfilled_at is null)
    or (status = 'fulfilled' and fulfilled_at is not null)
  )
);

create index salesmen_item_requests_salesman_status_idx
  on public.salesmen_item_requests (salesman_id, status);

create index salesmen_item_requests_salesman_requested_idx
  on public.salesmen_item_requests (salesman_id, requested_at desc);

alter table public.salesmen_item_requests enable row level security;

create policy "Users with salesmen modules can view item requests"
  on public.salesmen_item_requests for select to authenticated
  using (
    public.user_has_module('entity-salesmen')
    or public.user_has_module('order-salesmen')
  );

create policy "Users with entity-salesmen can insert item requests"
  on public.salesmen_item_requests for insert to authenticated
  with check (public.user_has_module('entity-salesmen'));

create policy "Users with entity-salesmen can update item requests"
  on public.salesmen_item_requests for update to authenticated
  using (public.user_has_module('entity-salesmen'))
  with check (public.user_has_module('entity-salesmen'));

create policy "Users with entity-salesmen can delete item requests"
  on public.salesmen_item_requests for delete to authenticated
  using (public.user_has_module('entity-salesmen'));

create trigger salesmen_item_requests_updated_at
  before update on public.salesmen_item_requests
  for each row execute function public.handle_updated_at();
