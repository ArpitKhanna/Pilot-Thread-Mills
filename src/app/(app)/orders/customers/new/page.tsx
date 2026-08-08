import { redirect } from "next/navigation";
import { getAppContext } from "@/app/(app)/layout";
import { OrderCaptureClient } from "@/components/customer-orders/OrderCaptureClient";
import type { PriceListItem } from "@/lib/auth/types";
import { listCustomers } from "@/lib/salesmen/queries";
import { createClient } from "@/lib/supabase/server";

export default async function NewCustomerOrderCapturePage() {
  const context = await getAppContext();
  if (!context) redirect("/login");

  const hasAccess = context.modules.some((m) => m.id === "order-customers");
  if (!hasAccess) redirect("/dashboard");

  const supabase = await createClient();
  const [customers, priceListResult] = await Promise.all([
    listCustomers(supabase),
    supabase
      .from("price_list_items")
      .select("*")
      .eq("status", "approved")
      .order("item_name"),
  ]);

  return (
    <OrderCaptureClient
      customers={customers}
      priceList={(priceListResult.data ?? []) as PriceListItem[]}
    />
  );
}
