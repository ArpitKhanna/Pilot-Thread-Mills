import { redirect } from "next/navigation";
import { getAppContext } from "@/app/(app)/layout";
import { SalesmenInvoiceCreateClient } from "@/components/salesmen/SalesmenInvoiceCreateClient";
import type { PriceListItem } from "@/lib/auth/types";
import { MOCK_SALESMEN } from "@/lib/salesmen/mock-data";
import { createClient } from "@/lib/supabase/server";

type SalesmenOrdersPageProps = {
  searchParams: Promise<{ salesmanId?: string }>;
};

export default async function SalesmenOrdersPage({
  searchParams,
}: SalesmenOrdersPageProps) {
  const context = await getAppContext();
  if (!context) redirect("/login");

  const hasAccess = context.modules.some((m) => m.id === "order-salesmen");
  if (!hasAccess) redirect("/dashboard");

  const { salesmanId } = await searchParams;

  const supabase = await createClient();
  const { data: items } = await supabase
    .from("price_list_items")
    .select("*")
    .eq("status", "approved")
    .order("item_name");

  const salesmenForForm = MOCK_SALESMEN.filter(
    (s) => s.isActive || (salesmanId != null && s.id === salesmanId),
  );

  return (
    <SalesmenInvoiceCreateClient
      context={context}
      salesmen={salesmenForForm}
      priceList={(items ?? []) as PriceListItem[]}
      initialSalesmanId={salesmanId}
    />
  );
}
