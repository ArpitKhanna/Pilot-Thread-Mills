-- Remove unused customer contact person name (shop name is the primary identity)

alter table public.salesmen
  drop column if exists contact_name;
