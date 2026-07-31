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
import { listAdvancesForSalesman } from "@/lib/salesmen/advances";
import { listReturnsForSalesman } from "@/lib/salesmen/returns";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type DetailTab =
  | "invoices"
  | "payments"
  | "returns"
  | "requests"
  | "details";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

function parseTab(raw: string | undefined): DetailTab {
  if (raw === "overview") return "invoices";
  if (
    raw === "invoices" ||
    raw === "payments" ||
    raw === "returns" ||
    raw === "requests" ||
    raw === "details"
  ) {
    return raw;
  }
  return "invoices";
}

export default async function SalesmanDetailPage({
  params,
  searchParams,
}: PageProps) {
  const context = await getAppContext();
  if (!context) redirect("/login");

  const hasAccess = context.modules.some((m) => m.id === "entity-salesmen");
  if (!hasAccess) redirect("/dashboard");

  const { id } = await params;
  const { tab } = await searchParams;
  if (tab === "overview") {
    redirect(`/entities/salesmen/${id}?tab=invoices`);
  }
  const supabase = await createClient();
  const salesman = await getSalesman(supabase, id);
  if (!salesman) notFound();

  const [
    { data: items },
    invoices,
    bankAccounts,
    itemRequests,
    advances,
    returns,
  ] = await Promise.all([
    supabase
      .from("price_list_items")
      .select("*")
      .eq("status", "approved")
      .order("item_name"),
    listInvoicesForSalesman(supabase, id),
    listBankAccounts(supabase).catch(() => []),
    listItemRequestsForSalesman(supabase, id).catch(() => []),
    listAdvancesForSalesman(supabase, id).catch(() => []),
    listReturnsForSalesman(supabase, id).catch(() => []),
  ]);

  return (
    <SalesmanDetailClient
      context={context}
      initialSalesman={salesman}
      initialInvoices={invoices}
      initialItemRequests={itemRequests}
      initialAdvances={advances}
      initialReturns={returns}
      priceList={(items ?? []) as PriceListItem[]}
      bankAccounts={bankAccounts}
      initialTab={parseTab(tab)}
    />
  );
}
