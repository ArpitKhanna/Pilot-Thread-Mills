import { redirect } from "next/navigation";
import { getAppContext } from "@/app/(app)/layout";
import { CustomerOrdersListClient } from "@/components/customer-orders/CustomerOrdersListClient";
import type { PriceListItem } from "@/lib/auth/types";
import { listCustomerOrders } from "@/lib/customer-orders/queries";
import { listSalesmen } from "@/lib/salesmen/queries";
import { createClient } from "@/lib/supabase/server";

export default async function CustomerOrdersPage() {
  const context = await getAppContext();
  if (!context) redirect("/login");

  const hasAccess = context.modules.some((m) => m.id === "order-customers");
  if (!hasAccess) redirect("/dashboard");

  const supabase = await createClient();
  const [orders, parties, priceListResult] = await Promise.all([
    listCustomerOrders(supabase),
    listSalesmen(supabase),
    supabase
      .from("price_list_items")
      .select("*")
      .eq("status", "approved")
      .order("item_name"),
  ]);
  const customers = parties.filter((p) => p.entityType === "customer");

  return (
    <CustomerOrdersListClient
      context={context}
      initialOrders={orders}
      customers={customers}
      priceList={(priceListResult.data ?? []) as PriceListItem[]}
    />
  );
}
