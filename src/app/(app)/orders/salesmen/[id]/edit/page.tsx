import { notFound, redirect } from "next/navigation";
import { getAppContext } from "@/app/(app)/layout";
import { SalesmenInvoiceCreateClient } from "@/components/salesmen/SalesmenInvoiceCreateClient";
import type { PriceListItem } from "@/lib/auth/types";
import { listBankAccounts } from "@/lib/bank-accounts/queries";
import { canEditInvoice } from "@/lib/salesmen/invoice-api";
import { getInvoiceById, listSalesmen } from "@/lib/salesmen/queries";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditSalesmenInvoicePage({ params }: PageProps) {
  const context = await getAppContext();
  if (!context) redirect("/login");

  const hasAccess = context.modules.some((m) => m.id === "order-salesmen");
  if (!hasAccess) redirect("/dashboard");

  const { id } = await params;
  const supabase = await createClient();

  const invoice = await getInvoiceById(supabase, id);
  if (!invoice) notFound();

  if (!canEditInvoice(invoice)) {
    redirect(`/entities/salesmen/${invoice.salesmanId}?tab=invoices`);
  }

  const [priceListResult, salesmen, allBankAccounts] = await Promise.all([
    supabase
      .from("price_list_items")
      .select("*")
      .eq("status", "approved")
      .order("item_name"),
    listSalesmen(supabase),
    listBankAccounts(supabase),
  ]);

  const usedAccountIds = new Set(
    (invoice.paymentEntries ?? [])
      .map((p) => p.depositAccountId)
      .filter((accountId): accountId is string => Boolean(accountId)),
  );
  const bankAccounts = allBankAccounts.filter(
    (a) => a.isActive || usedAccountIds.has(a.id),
  );

  const salesmenForForm = salesmen.filter(
    (s) => s.isActive || s.id === invoice.salesmanId,
  );

  return (
    <SalesmenInvoiceCreateClient
      context={context}
      salesmen={salesmenForForm}
      priceList={(priceListResult.data ?? []) as PriceListItem[]}
      bankAccounts={bankAccounts}
      mode="edit"
      initialInvoice={invoice}
      initialSalesmanId={invoice.salesmanId}
    />
  );
}
