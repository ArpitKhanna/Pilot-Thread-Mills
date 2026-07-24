-- Preserve carry-forward balance separately from invoice-driven pending

alter table public.salesmen
  add column if not exists opening_balance numeric(12, 2) not null default 0
  check (opening_balance >= 0);

-- Salesmen with no invoices: current pending_balance is the opening carry-forward
update public.salesmen s
set opening_balance = s.pending_balance
where not exists (
  select 1 from public.salesmen_invoices i where i.salesman_id = s.id
)
and s.pending_balance > 0
and s.opening_balance = 0;

-- Recompute pending = opening + invoice net dues (credits from overpayment allowed)
update public.salesmen s
set pending_balance = greatest(
  0,
  round(
    (
      s.opening_balance
      + coalesce((
          select sum(i.total_amount - i.amount_paid)
          from public.salesmen_invoices i
          where i.salesman_id = s.id
        ), 0)
    )::numeric,
    2
  )
),
last_invoice_at = (
  select max(i.issued_at)
  from public.salesmen_invoices i
  where i.salesman_id = s.id
);
