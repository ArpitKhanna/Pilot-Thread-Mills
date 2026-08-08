import { redirect } from "next/navigation";
import { getAppContext } from "@/app/(app)/layout";
import { InventoryClient } from "@/components/inventory/InventoryClient";
import { listDyeingSuggestions } from "@/lib/inventory/dyeing-suggestions";
import {
  getEllfa270ItemId,
  getShadeBalancesForItem,
  listMovementsForItem,
} from "@/lib/inventory/queries";
import { createClient } from "@/lib/supabase/server";

export default async function InventoryPage() {
  const context = await getAppContext();
  if (!context) redirect("/login");

  const hasAccess = context.modules.some((m) => m.id === "inventory");
  if (!hasAccess) redirect("/dashboard");

  const supabase = await createClient();
  const itemId = await getEllfa270ItemId(supabase);
  const [balances, movements, suggestions] = await Promise.all([
    getShadeBalancesForItem(supabase, itemId),
    listMovementsForItem(supabase, itemId),
    listDyeingSuggestions(supabase, itemId),
  ]);

  const summary = {
    totalSkus: balances.length,
    outOfStock: balances.filter((b) => b.outOfStock).length,
    belowThreshold: balances.filter((b) => b.belowThreshold).length,
    fastMovers: balances.filter((b) => b.velocityTier === "fast").length,
    totalOnHand: balances.reduce((sum, b) => sum + b.onHand, 0),
  };

  return (
    <InventoryClient
      context={context}
      initialBalances={balances}
      initialMovements={movements}
      initialSuggestions={suggestions}
      initialSummary={summary}
      itemId={itemId}
    />
  );
}
