-- Personal details: entity type, alternate phone, multi discount rules

alter table public.salesmen
  add column if not exists alternate_phone text not null default '';

alter table public.salesmen
  add column if not exists entity_type text not null default 'salesman';

alter table public.salesmen
  drop constraint if exists salesmen_entity_type_check;

alter table public.salesmen
  add constraint salesmen_entity_type_check
  check (entity_type in ('salesman', 'customer'));

alter table public.salesmen
  add column if not exists discount_rules jsonb not null default '[]'::jsonb;

-- Migrate single discount_rule → discount_rules array (item-name based)
update public.salesmen
set discount_rules = case
  when discount_rule is null then '[]'::jsonb
  else jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid()::text,
      'itemName', coalesce(
        nullif(discount_rule->>'itemNameIncludes', ''),
        nullif(discount_rule->>'itemName', ''),
        discount_rule->>'itemType',
        ''
      ),
      'amountPerUnit', coalesce((discount_rule->>'amountPerUnit')::numeric, 0),
      'description', coalesce(discount_rule->>'description', '')
    )
  )
end
where discount_rules = '[]'::jsonb
  and discount_rule is not null;

alter table public.salesmen
  drop column if exists discount_rule;

-- Keep category label in sync with entity_type for any legacy reads
update public.salesmen
set category = case entity_type
  when 'customer' then 'Customer'
  else 'Salesmen'
end;
