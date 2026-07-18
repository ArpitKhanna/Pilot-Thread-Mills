import { redirect } from "next/navigation";
import { getAppContext } from "@/app/(app)/layout";
import { SalesmenInvoiceCreateClient } from "@/components/salesmen/SalesmenInvoiceCreateClient";
import type { PriceListItem } from "@/lib/auth/types";
import { listActiveBankAccounts } from "@/lib/bank-accounts/queries";
import { listSalesmen } from "@/lib/salesmen/queries";
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
  const [priceListResult, salesmen, bankAccounts] = await Promise.all([
    supabase
      .from("price_list_items")
      .select("*")
      .eq("status", "approved")
      .order("item_name"),
    listSalesmen(supabase),
    listActiveBankAccounts(supabase),
  ]);

  const salesmenForForm = salesmen.filter(
    (s) => s.isActive || (salesmanId != null && s.id === salesmanId),
  );

  return (
    <SalesmenInvoiceCreateClient
      context={context}
      salesmen={salesmenForForm}
      priceList={(priceListResult.data ?? []) as PriceListItem[]}
      bankAccounts={bankAccounts}
      initialSalesmanId={salesmanId}
      mode="create"
    />
  );
}
