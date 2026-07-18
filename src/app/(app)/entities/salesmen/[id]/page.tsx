import { notFound, redirect } from "next/navigation";
import { SalesmanDetailClient } from "@/components/salesmen/SalesmanDetailClient";
import { getAppContext } from "@/app/(app)/layout";
import type { PriceListItem } from "@/lib/auth/types";
import { listBankAccounts } from "@/lib/bank-accounts/queries";
import { listItemRequestsForSalesman } from "@/lib/salesmen/item-requests";
import {
  getSalesman,
  listInvoicesForSalesman,
} from "@/lib/salesmen/queries";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SalesmanDetailPage({ params }: PageProps) {
  const context = await getAppContext();
  if (!context) redirect("/login");

  const hasAccess = context.modules.some((m) => m.id === "entity-salesmen");
  if (!hasAccess) redirect("/dashboard");

  const { id } = await params;
  const supabase = await createClient();
  const salesman = await getSalesman(supabase, id);
  if (!salesman) notFound();

  const [{ data: items }, invoices, bankAccounts, itemRequests] =
    await Promise.all([
      supabase
        .from("price_list_items")
        .select("*")
        .eq("status", "approved")
        .order("item_name"),
      listInvoicesForSalesman(supabase, id),
      listBankAccounts(supabase).catch(() => []),
      listItemRequestsForSalesman(supabase, id).catch(() => []),
    ]);

  return (
    <SalesmanDetailClient
      context={context}
      initialSalesman={salesman}
      initialInvoices={invoices}
      initialItemRequests={itemRequests}
      priceList={(items ?? []) as PriceListItem[]}
      bankAccounts={bankAccounts}
    />
  );
}
