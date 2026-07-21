import { notFound, redirect } from "next/navigation";
import { CustomerDetailClient } from "@/components/customers/CustomerDetailClient";
import { getAppContext } from "@/app/(app)/layout";
import type { PriceListItem } from "@/lib/auth/types";
import { listBankAccounts } from "@/lib/bank-accounts/queries";
import { listCustomerOrdersForCustomer } from "@/lib/customer-orders/queries";
import {
  getSalesman,
  listInvoicesForSalesman,
} from "@/lib/salesmen/queries";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CustomerDetailPage({ params }: PageProps) {
  const context = await getAppContext();
  if (!context) redirect("/login");

  const hasAccess = context.modules.some((m) => m.id === "entity-customers");
  if (!hasAccess) redirect("/dashboard");

  const { id } = await params;
  const supabase = await createClient();
  const customer = await getSalesman(supabase, id);
  if (!customer || customer.entityType !== "customer") notFound();

  const [orders, invoices, bankAccounts, priceListResult] = await Promise.all([
    listCustomerOrdersForCustomer(supabase, id),
    listInvoicesForSalesman(supabase, id),
    listBankAccounts(supabase).catch(() => []),
    supabase
      .from("price_list_items")
      .select("*")
      .eq("status", "approved")
      .order("item_name"),
  ]);

  return (
    <CustomerDetailClient
      context={context}
      initialCustomer={customer}
      initialOrders={orders}
      initialInvoices={invoices}
      bankAccounts={bankAccounts}
      priceList={(priceListResult.data ?? []) as PriceListItem[]}
    />
  );
}
