-- Overpayment on an invoice creates credit (negative pending balance) that
-- carries forward to the next invoice as Prev. balance.

alter table public.salesmen
  drop constraint if exists salesmen_pending_balance_check;
