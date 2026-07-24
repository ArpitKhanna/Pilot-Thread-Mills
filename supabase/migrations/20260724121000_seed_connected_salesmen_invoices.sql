-- Seed connected salesman invoices + lines + payments for list / overview / invoices / payments

-- Avoid re-seeding if already present
do $$
begin
  if exists (
    select 1 from public.salesmen_invoices where number like 'INV-SEED-%'
  ) then
    return;
  end if;

  -- Ramesh: purchase + partial payment
  insert into public.salesmen_invoices (
    id, number, salesman_id, issued_at, item_count, total_amount, amount_paid, discount_amount, notes
  ) values (
    'a1000000-0000-4000-8000-000000000001',
    'INV-SEED-RAM-001',
    'sm-ramesh',
    now() - interval '12 days',
    2,
    4100,
    2000,
    0,
    'Seed invoice'
  );

  insert into public.salesmen_invoice_lines (
    invoice_id, name, qty, unit_price, amount, price_list_item_id, is_return, sort_order
  ) values
    ('a1000000-0000-4000-8000-000000000001', '2 NO SILVER HORSE', 50, 41, 2050, 'f53bfd07-9c56-43ba-8267-43191393f078', false, 0),
    ('a1000000-0000-4000-8000-000000000001', '80 NO. (MED) COTTON', 40, 37.5, 1500, '20688c9f-b7ee-4672-b1c7-cb22edaa121f', false, 1),
    ('a1000000-0000-4000-8000-000000000001', 'ARMY COTTON', 14, 39, 546, '82501ac2-a436-4fce-a8e1-d331c4989a31', false, 2);

  -- fix total to match lines: 2050+1500+546 = 4096 → update
  update public.salesmen_invoices
  set total_amount = 4096, item_count = 3
  where id = 'a1000000-0000-4000-8000-000000000001';

  insert into public.salesmen_invoice_payments (
    invoice_id, method, amount, cheque_number, deposit_account_id, sender_name, sort_order
  ) values
    ('a1000000-0000-4000-8000-000000000001', 'cash', 1000, null, null, null, 0),
    ('a1000000-0000-4000-8000-000000000001', 'upi', 1000, null, 'ba-khanna-sales-kotak', 'Ramesh Kumar', 1);

  -- Suresh: fully paid + another open
  insert into public.salesmen_invoices (
    id, number, salesman_id, issued_at, item_count, total_amount, amount_paid, discount_amount, notes
  ) values
  (
    'a1000000-0000-4000-8000-000000000002',
    'INV-SEED-SUR-001',
    'sm-suresh',
    now() - interval '20 days',
    1,
    3150,
    3150,
    0,
    'Seed paid invoice'
  ),
  (
    'a1000000-0000-4000-8000-000000000003',
    'INV-SEED-SUR-002',
    'sm-suresh',
    now() - interval '5 days',
    2,
    2320,
    800,
    0,
    'Seed partial'
  );

  insert into public.salesmen_invoice_lines (
    invoice_id, name, qty, unit_price, amount, price_list_item_id, is_return, sort_order
  ) values
    ('a1000000-0000-4000-8000-000000000002', 'ARMY -300', 10, 315, 3150, '53c6ed02-5034-4123-b644-20846aa51956', false, 0),
    ('a1000000-0000-4000-8000-000000000003', 'APCO -10000 (B)', 20, 60, 1200, '365a439d-f9dd-4d74-a03e-ff27346c1ec5', false, 0),
    ('a1000000-0000-4000-8000-000000000003', 'APCO (H/W)- BIG', 20, 44, 880, 'd9b54418-a6a6-4bfd-b75c-253b76bc36ab', false, 1),
    ('a1000000-0000-4000-8000-000000000003', 'ATCO -5000', 4, 73, 292, 'ceac3e15-f39a-45ce-8e94-b641b4bb173f', false, 2);

  update public.salesmen_invoices
  set total_amount = 2372, item_count = 3
  where id = 'a1000000-0000-4000-8000-000000000003';

  insert into public.salesmen_invoice_payments (
    invoice_id, method, amount, cheque_number, deposit_account_id, sender_name, sort_order
  ) values
    ('a1000000-0000-4000-8000-000000000002', 'cheque', 3150, 'CHQ-7781', 'ba-mukesh-khanna-hdfc', null, 0),
    ('a1000000-0000-4000-8000-000000000003', 'cash', 500, null, null, null, 0),
    ('a1000000-0000-4000-8000-000000000003', 'imps', 300, null, 'ba-neeru-khanna-cbi', 'Suresh Patel', 1);

  -- Vijay: unpaid purchase
  insert into public.salesmen_invoices (
    id, number, salesman_id, issued_at, item_count, total_amount, amount_paid, discount_amount, notes
  ) values (
    'a1000000-0000-4000-8000-000000000004',
    'INV-SEED-VIJ-001',
    'sm-vijay',
    now() - interval '3 days',
    2,
    2500,
    0,
    0,
    'Seed unpaid'
  );

  insert into public.salesmen_invoice_lines (
    invoice_id, name, qty, unit_price, amount, price_list_item_id, is_return, sort_order
  ) values
    ('a1000000-0000-4000-8000-000000000004', '80 NO. BIG COTTON(B)', 20, 66, 1320, '70875ef6-b4b1-412c-bc40-667972e1ef3b', false, 0),
    ('a1000000-0000-4000-8000-000000000004', '80 NO. BIG C0TTON(W)', 18, 65, 1170, '40aacc64-d84c-43b1-a9a1-66a76a9afab6', false, 1);

  update public.salesmen_invoices
  set total_amount = 2490, item_count = 2
  where id = 'a1000000-0000-4000-8000-000000000004';

  -- Prakash (inactive) historical paid invoice
  insert into public.salesmen_invoices (
    id, number, salesman_id, issued_at, item_count, total_amount, amount_paid, discount_amount, notes
  ) values (
    'a1000000-0000-4000-8000-000000000005',
    'INV-SEED-PRA-001',
    'sm-prakash',
    now() - interval '40 days',
    1,
    740,
    740,
    0,
    'Seed historical'
  );

  insert into public.salesmen_invoice_lines (
    invoice_id, name, qty, unit_price, amount, price_list_item_id, is_return, sort_order
  ) values
    ('a1000000-0000-4000-8000-000000000005', 'APCO- 170gm (BLACK)', 10, 52, 520, '45a9c950-eaa3-432f-810b-382305004292', false, 0),
    ('a1000000-0000-4000-8000-000000000005', '80 NO. (SMALL) COTTON', 8, 25, 200, '8fe76988-dd35-4ec6-bbfa-4691b9191f47', false, 1);

  update public.salesmen_invoices
  set total_amount = 720, amount_paid = 720, item_count = 2
  where id = 'a1000000-0000-4000-8000-000000000005';

  insert into public.salesmen_invoice_payments (
    invoice_id, method, amount, cheque_number, deposit_account_id, sender_name, sort_order
  ) values
    ('a1000000-0000-4000-8000-000000000005', 'upi', 720, null, 'ba-khanna-sales-kotak', 'Prakash Joshi', 0);

end $$;

-- Ensure opening balances for seeded carry-forward, then recompute pending
update public.salesmen
set opening_balance = case id
  when 'sm-ramesh' then greatest(opening_balance, 1200)
  when 'sm-suresh' then greatest(opening_balance, 875.5)
  when 'sm-vijay' then greatest(opening_balance, 3100)
  else opening_balance
end
where id in ('sm-ramesh', 'sm-suresh', 'sm-vijay');

update public.salesmen s
set pending_balance = greatest(
  0,
  round(
    (
      coalesce(s.opening_balance, 0)
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
