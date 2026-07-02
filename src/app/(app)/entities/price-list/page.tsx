import { redirect } from "next/navigation";
import { PriceListClient } from "@/components/price-list/PriceListClient";
import { getAppContext } from "@/app/(app)/layout";
import type { PriceListItem } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";

export default async function PriceListPage() {
  const context = await getAppContext();
  if (!context) redirect("/login");

  const hasAccess = context.modules.some((m) => m.id === "price-list");
  if (!hasAccess) redirect("/dashboard");

  const supabase = await createClient();
  const { data: items } = await supabase
    .from("price_list_items")
    .select("*")
    .order("item_name");

  const pendingCount = (items ?? []).filter(
    (i) => i.status === "pending_approval",
  ).length;

  return (
    <PriceListClient
      context={context}
      initialItems={(items ?? []) as PriceListItem[]}
      pendingCount={pendingCount}
    />
  );
}
