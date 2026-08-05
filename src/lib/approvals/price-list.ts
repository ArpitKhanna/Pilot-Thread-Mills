import type { SupabaseClient } from "@supabase/supabase-js";
import type { PriceListItem } from "@/lib/auth/types";

export type PendingPriceListApproval = {
  item: PriceListItem;
  submittedByName: string;
};

/** Price list adds/edits awaiting admin approval (accountant workflow). */
export async function listPendingPriceListApprovals(
  supabase: SupabaseClient,
): Promise<PendingPriceListApproval[]> {
  const { data, error } = await supabase
    .from("price_list_items")
    .select("*")
    .eq("status", "pending_approval")
    .order("updated_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as PriceListItem[];
  if (rows.length === 0) return [];

  const creatorIds = [...new Set(rows.map((row) => row.created_by))];
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", creatorIds);
  if (profilesError) throw profilesError;

  const nameById = new Map(
    (profiles ?? []).map((profile) => [
      profile.id as string,
      profile.full_name as string,
    ]),
  );

  return rows.map((item) => ({
    item,
    submittedByName: nameById.get(item.created_by) ?? "Unknown",
  }));
}

export async function countPendingPriceListApprovals(
  supabase: SupabaseClient,
): Promise<number> {
  const { count, error } = await supabase
    .from("price_list_items")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending_approval");
  if (error) throw error;
  return count ?? 0;
}
