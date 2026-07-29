-- Invoice & payment verification (accountant → admin approve / send back)

create type public.invoice_verification_status as enum (
  'verified',
  'pending_verification',
  'needs_edit'
);

alter table public.salesmen_invoices
  add column if not exists verification_status public.invoice_verification_status
    not null default 'verified',
  add column if not exists created_by_name text,
  add column if not exists verified_by uuid references public.profiles (id) on delete set null,
  add column if not exists verified_by_name text,
  add column if not exists verified_at timestamptz,
  add column if not exists verification_note text;

alter table public.salesmen_invoice_payments
  add column if not exists verification_status public.invoice_verification_status
    not null default 'verified',
  add column if not exists created_by uuid references public.profiles (id) on delete set null,
  add column if not exists created_by_name text,
  add column if not exists verified_by uuid references public.profiles (id) on delete set null,
  add column if not exists verified_by_name text,
  add column if not exists verified_at timestamptz;

-- Backfill existing invoices as verified; copy creator name when available
update public.salesmen_invoices i
set
  verification_status = 'verified',
  created_by_name = coalesce(
    i.created_by_name,
    (select p.full_name from public.profiles p where p.id = i.created_by)
  ),
  verified_by = coalesce(i.verified_by, i.created_by),
  verified_by_name = coalesce(
    i.verified_by_name,
    (select p.full_name from public.profiles p where p.id = i.created_by)
  ),
  verified_at = coalesce(i.verified_at, i.created_at);

update public.salesmen_invoice_payments p
set
  verification_status = i.verification_status,
  created_by = coalesce(p.created_by, i.created_by),
  created_by_name = coalesce(p.created_by_name, i.created_by_name),
  verified_by = coalesce(p.verified_by, i.verified_by),
  verified_by_name = coalesce(p.verified_by_name, i.verified_by_name),
  verified_at = coalesce(p.verified_at, i.verified_at)
from public.salesmen_invoices i
where i.id = p.invoice_id;

create index if not exists salesmen_invoices_by_verification_status
  on public.salesmen_invoices (verification_status, issued_at desc);

-- Approvals module (admin only)
update public.modules
set sort_order = sort_order + 1
where section = 'overview' and sort_order >= 2;

insert into public.modules (id, name, section, href, sort_order)
values ('approvals', 'Approvals', 'overview', '/approvals', 2)
on conflict (id) do update
set name = excluded.name,
    section = excluded.section,
    href = excluded.href,
    sort_order = excluded.sort_order;

insert into public.role_module_access (role, module_id)
values ('admin', 'approvals')
on conflict do nothing;
