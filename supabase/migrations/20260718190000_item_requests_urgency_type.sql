-- Item request urgency + optional catalog item type

create type public.item_request_urgency as enum ('high', 'medium', 'low');

alter table public.salesmen_item_requests
  add column if not exists item_type text,
  add column if not exists urgency public.item_request_urgency not null default 'medium';
