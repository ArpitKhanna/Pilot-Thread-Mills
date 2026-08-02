import { redirect } from "next/navigation";
import { getAppContext } from "@/app/(app)/layout";
import { PaymentsLedgerClient } from "@/components/dashboard/PaymentsLedgerClient";
import { listBankAccounts } from "@/lib/bank-accounts/queries";
import { fetchLedgerDateRange } from "@/lib/ledger/daily-query";
import { todayDateString } from "@/lib/ledger/date-utils";
import { createClient } from "@/lib/supabase/server";

function hasModule(
  modules: { id: string }[],
  ids: string[],
): boolean {
  const set = new Set(modules.map((m) => m.id));
  return ids.some((id) => set.has(id));
}

export default async function PaymentsPage() {
  const context = await getAppContext();
  if (!context) redirect("/login");

  const supabase = await createClient();
  const today = todayDateString();

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

  const [summaries, bankAccounts] = await Promise.all([
    fetchLedgerDateRange(supabase, today, today),
    listBankAccounts(supabase),
  ]);

  return (
    <PaymentsLedgerClient
      context={context}
      initialSummaries={summaries}
      fromDate={today}
      toDate={today}
      bankAccounts={bankAccounts}
      canAddReceipt={canAddReceipt}
      canAddExpense={canAddExpense}
    />
  );
}
