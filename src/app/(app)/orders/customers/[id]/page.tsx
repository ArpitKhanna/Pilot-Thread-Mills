import { notFound, redirect } from "next/navigation";
import { getAppContext } from "@/app/(app)/layout";
import { CustomerOrderDetailClient } from "@/components/customer-orders/CustomerOrderDetailClient";
import type { PriceListItem } from "@/lib/auth/types";
import { listActiveBankAccounts } from "@/lib/bank-accounts/queries";
import {
  getCustomerOrder,
  listDeliveryStaff,
} from "@/lib/customer-orders/queries";
import { createClient } from "@/lib/supabase/server";

type CustomerOrderDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CustomerOrderDetailPage({
  params,
}: CustomerOrderDetailPageProps) {
  const context = await getAppContext();
  if (!context) redirect("/login");

  const hasAccess = context.modules.some((m) => m.id === "order-customers");
  if (!hasAccess) redirect("/dashboard");

  const { id } = await params;
  const supabase = await createClient();

  const [order, priceListResult, bankAccounts, deliveryStaff] =
    await Promise.all([
      getCustomerOrder(supabase, id),
      supabase
        .from("price_list_items")
        .select("*")
        .eq("status", "approved")
        .order("item_name"),
      listActiveBankAccounts(supabase),
      listDeliveryStaff(supabase),
    ]);

  if (!order) notFound();

  return (
    <CustomerOrderDetailClient
      context={context}
      initialOrder={order}
      priceList={(priceListResult.data ?? []) as PriceListItem[]}
      bankAccounts={bankAccounts}
      deliveryStaff={deliveryStaff}
    />
  );
}
