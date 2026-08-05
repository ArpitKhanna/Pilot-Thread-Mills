import type { SupabaseClient } from "@supabase/supabase-js";
import { countPendingPriceListApprovals } from "./price-list";

/** Pending invoice, advance, return, and price-list verifications for Approvals. */
export async function countPendingApprovals(
  supabase: SupabaseClient,
): Promise<number> {
  const [invoices, advances, returns, priceList] = await Promise.all([
    supabase
      .from("salesmen_invoices")
      .select("*", { count: "exact", head: true })
      .eq("verification_status", "pending_verification"),
    supabase
      .from("salesmen_advances")
      .select("*", { count: "exact", head: true })
      .eq("verification_status", "pending_verification")
      .eq("status", "active"),
    supabase
      .from("salesmen_returns")
      .select("*", { count: "exact", head: true })
      .eq("verification_status", "pending_verification")
      .eq("status", "active"),
    countPendingPriceListApprovals(supabase),
  ]);

  if (invoices.error) throw invoices.error;
  if (advances.error) throw advances.error;
  if (returns.error) throw returns.error;

  return (
    (invoices.count ?? 0) +
    (advances.count ?? 0) +
    (returns.count ?? 0) +
    priceList
  );
}
