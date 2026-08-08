import { redirect } from "next/navigation";
import { AppPage } from "@/components/layout/AppShell";import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { getAppContext } from "@/app/(app)/layout";
import type { PriceListItem } from "@/lib/auth/types";
import { listBankAccounts } from "@/lib/bank-accounts/queries";
import { fetchDailyLedger } from "@/lib/ledger/daily-query";
import { todayDateString } from "@/lib/ledger/date-utils";
import { fetchDyeingStats } from "@/lib/ledger/dyeing-stats";
import { fetchOrderStats } from "@/lib/ledger/order-stats";
import { listPendingInvoiceApprovals } from "@/lib/salesmen/queries";
import { createClient } from "@/lib/supabase/server";

function hasModule(
  modules: { id: string }[],
  ids: string[],
): boolean {
  const set = new Set(modules.map((m) => m.id));
  return ids.some((id) => set.has(id));
}

export default async function DashboardPage() {
  const context = await getAppContext();
  if (!context) redirect("/login");

  const supabase = await createClient();
  const today = todayDateString();
  const isAdmin = context.profile.role === "admin";

  const canAddReceipt = hasModule(context.modules, [
    "entity-salesmen",
    "order-salesmen",
    "entity-customers",
    "order-customers",
    "dashboard",
    "payments",
  ]);
  const canAddExpense = hasModule(context.modules, [
    "expenses",
    "dashboard",
    "payments",
  ]);

  const [
    ledger,
    orderStats,
    dyeingStats,
    bankAccounts,
    pendingInvoices,
    pendingPriceItemsRes,
  ] = await Promise.all([
    fetchDailyLedger(supabase, today),
    fetchOrderStats(supabase, today),
    fetchDyeingStats(supabase),
    listBankAccounts(supabase),
    isAdmin ? listPendingInvoiceApprovals(supabase) : Promise.resolve([]),
    isAdmin
      ? supabase
          .from("price_list_items")
          .select("*")
          .eq("status", "pending_approval")
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
  ]);

  const pendingPriceItems = (pendingPriceItemsRes.data ?? []) as PriceListItem[];
  const pendingInvoiceSummaries = pendingInvoices.slice(0, 10).map(
    ({ invoice, salesmanName, chargedTotal }) => ({
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      salesmanName,
      chargedTotal,
    }),
  );

  return (
    <AppPage
      context={context}
      animate={false}
      breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Dashboard" }]}
    >
      <DashboardClient          context={context}
          ledger={ledger}
          orderStats={orderStats}
          dyeingStats={dyeingStats}
          bankAccounts={bankAccounts}
          pendingInvoices={pendingInvoiceSummaries}
          pendingPriceItems={pendingPriceItems}
          canAddReceipt={canAddReceipt}
          canAddExpense={canAddExpense}
      />
    </AppPage>
  );
}