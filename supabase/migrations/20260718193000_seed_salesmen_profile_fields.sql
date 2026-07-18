-- Fill profile fields on seeded salesmen (alternate phone, entity type, sample balances)

update public.salesmen set
  entity_type = coalesce(nullif(entity_type, ''), 'salesman'),
  category = case
    when coalesce(entity_type, 'salesman') = 'customer' then 'Customer'
    else 'Salesmen'
  end,
  alternate_phone = case id
    when 'sm-nandkishore' then '919900112233'
    when 'sm-ramesh' then '919911223344'
    when 'sm-suresh' then '919922334455'
    when 'sm-anil' then ''
    when 'sm-vijay' then '919944556677'
    when 'sm-prakash' then '919955667788'
    else alternate_phone
  end,
  pending_balance = case id
    when 'sm-nandkishore' then case when pending_balance = 0 then 2450 else pending_balance end
    when 'sm-ramesh' then case when pending_balance = 0 then 1200 else pending_balance end
    when 'sm-suresh' then case when pending_balance = 0 then 875.5 else pending_balance end
    when 'sm-vijay' then case when pending_balance = 0 then 3100 else pending_balance end
    else pending_balance
  end,
  is_active = case id
    when 'sm-anil' then false
    else coalesce(is_active, true)
  end
where id in (
  'sm-nandkishore',
  'sm-ramesh',
  'sm-suresh',
  'sm-anil',
  'sm-vijay',
  'sm-prakash'
);
