import { redirect } from "next/navigation";
import { getAppContext } from "@/app/(app)/layout";
import { BankAccountsClient } from "@/components/bank-accounts/BankAccountsClient";
import { listBankAccounts } from "@/lib/bank-accounts/queries";
import { createClient } from "@/lib/supabase/server";

export default async function BankAccountsPage() {
  const context = await getAppContext();
  if (!context) redirect("/login");

  const hasAccess = context.modules.some((m) => m.id === "bank-accounts");
  if (!hasAccess) redirect("/dashboard");

  const supabase = await createClient();
  const accounts = await listBankAccounts(supabase);

  return (
    <BankAccountsClient context={context} initialAccounts={accounts} />
  );
}