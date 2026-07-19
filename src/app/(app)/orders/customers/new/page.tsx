import { redirect } from "next/navigation";
import { getAppContext } from "@/app/(app)/layout";
import { CustomerOrderNewClient } from "@/components/customer-orders/CustomerOrderNewClient";
import { listSalesmen } from "@/lib/salesmen/queries";
import { createClient } from "@/lib/supabase/server";

export default async function NewCustomerOrderPage() {
  const context = await getAppContext();
  if (!context) redirect("/login");

  const hasAccess = context.modules.some((m) => m.id === "order-customers");
  if (!hasAccess) redirect("/dashboard");

  const supabase = await createClient();
  const parties = await listSalesmen(supabase);
  const customers = parties.filter((p) => p.entityType === "customer");

  return (
    <CustomerOrderNewClient context={context} customers={customers} />
  );
}
