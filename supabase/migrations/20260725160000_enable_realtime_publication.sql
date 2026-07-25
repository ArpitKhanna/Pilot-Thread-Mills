-- Enable Supabase Realtime (postgres_changes) for app data tables.
-- Safe to re-run: skips tables already in the publication.

do $$
declare
  t text;
  tables text[] := array[
    'profiles',
    'modules',
    'role_module_access',
    'price_list_items',
    'salesmen',
    'bank_accounts',
    'salesmen_invoices',
    'salesmen_invoice_lines',
    'salesmen_invoice_payments',
    'salesmen_item_requests',
    'item_shades',
    'customer_orders',
    'customer_order_lines',
    'customer_order_attachments',
    'customer_order_events',
    'customer_pending_items',
    'customer_cloth_patches',
    'raw_stock_suppliers',
    'raw_stock_movements',
    'delivery_runs',
    'delivery_run_orders',
    'dyeing_jobs'
  ];
begin
  foreach t in array tables loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        t
      );
    end if;
  end loop;
end $$;
