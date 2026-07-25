/** Tables watched for app-wide live refresh via Supabase Realtime. */
export const APP_REALTIME_TABLES = [
  "profiles",
  "modules",
  "role_module_access",
  "price_list_items",
  "salesmen",
  "bank_accounts",
  "salesmen_invoices",
  "salesmen_invoice_lines",
  "salesmen_invoice_payments",
  "salesmen_item_requests",
  "item_shades",
  "customer_orders",
  "customer_order_lines",
  "customer_order_attachments",
  "customer_order_events",
  "customer_pending_items",
  "customer_cloth_patches",
  "raw_stock_suppliers",
  "raw_stock_movements",
  "delivery_runs",
  "delivery_run_orders",
  "dyeing_jobs",
] as const;

export type AppRealtimeTable = (typeof APP_REALTIME_TABLES)[number];
