import { redirect } from "next/navigation";
import { getAppContext } from "@/app/(app)/layout";
import { SalesmenInvoiceCreateClient } from "@/components/salesmen/SalesmenInvoiceCreateClient";
import type { PriceListItem } from "@/lib/auth/types";
import { MOCK_SALESMEN } from "@/lib/salesmen/mock-data";
import { createClient } from "@/lib/supabase/server";

export default async function SalesmenOrdersPage() {
  const context = await getAppContext();
  if (!context) redirect("/login");

  const hasAccess = context.modules.some((m) => m.id === "order-salesmen");
  if (!hasAccess) redirect("/dashboard");

  const supabase = await createClient();
  const { data: items } = await supabase
    .from("price_list_items")
    .select("*")
    .eq("status", "approved")
    .order("item_name");

  const activeSalesmen = MOCK_SALESMEN.filter((s) => s.isActive);

  return (
    <SalesmenInvoiceCreateClient
      context={context}
      salesmen={activeSalesmen}
      priceList={(items ?? []) as PriceListItem[]}
    />
  );
}
