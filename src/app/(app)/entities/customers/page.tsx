import { redirect } from "next/navigation";
import { CustomersListClient } from "@/components/customers/CustomersListClient";
import { getAppContext } from "@/app/(app)/layout";
import { listCustomers } from "@/lib/salesmen/queries";
import { createClient } from "@/lib/supabase/server";

export default async function CustomersPage() {
  const context = await getAppContext();
  if (!context) redirect("/login");

  const hasAccess = context.modules.some((m) => m.id === "entity-customers");
  if (!hasAccess) redirect("/dashboard");

  const supabase = await createClient();
  const customers = await listCustomers(supabase);

  return (
    <CustomersListClient context={context} initialCustomers={customers} />
  );
}
