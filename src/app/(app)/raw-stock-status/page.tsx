import { redirect } from "next/navigation";
import { getAppContext } from "@/app/(app)/layout";
import { RawStockStatusClient } from "@/components/raw-stock/RawStockStatusClient";
import { deriveBalances } from "@/lib/raw-stock/balance";
import { listMovements, listSuppliers } from "@/lib/raw-stock/queries";
import { createClient } from "@/lib/supabase/server";

export default async function RawStockStatusPage() {
  const context = await getAppContext();
  if (!context) redirect("/login");

  const hasAccess = context.modules.some((m) => m.id === "raw-stock-status");
  if (!hasAccess) redirect("/dashboard");

  const supabase = await createClient();
  const [movements, suppliers] = await Promise.all([
    listMovements(supabase),
    listSuppliers(supabase),
  ]);

  return (
    <RawStockStatusClient
      context={context}
      initialMovements={movements}
      initialSuppliers={suppliers}
      initialBalances={deriveBalances(movements)}
    />
  );
}
