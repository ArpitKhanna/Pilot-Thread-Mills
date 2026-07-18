import { redirect } from "next/navigation";
import { SalesmenListClient } from "@/components/salesmen/SalesmenListClient";
import { getAppContext } from "@/app/(app)/layout";
import { listSalesmen } from "@/lib/salesmen/queries";
import { createClient } from "@/lib/supabase/server";

export default async function SalesmenPage() {
  const context = await getAppContext();
  if (!context) redirect("/login");

  const hasAccess = context.modules.some((m) => m.id === "entity-salesmen");
  if (!hasAccess) redirect("/dashboard");

  const supabase = await createClient();
  const salesmen = await listSalesmen(supabase);

  return <SalesmenListClient context={context} initialSalesmen={salesmen} />;
}
