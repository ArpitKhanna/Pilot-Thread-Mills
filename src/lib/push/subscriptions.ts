import { createAdminClient } from "@/lib/supabase/admin";
import type { PushSubscriptionRow } from "./types";

/** Active employees with the approvals module and a push subscription. */
export async function listApproverPushSubscriptions(
  excludeUserId: string,
): Promise<PushSubscriptionRow[]> {
  const admin = createAdminClient();

  const { data: accessRows, error: accessError } = await admin
    .from("role_module_access")
    .select("role")
    .eq("module_id", "approvals");
  if (accessError) throw accessError;

  const roles = [...new Set((accessRows ?? []).map((row) => row.role as string))];
  if (roles.length === 0) return [];

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id")
    .in("role", roles)
    .eq("is_active", true)
    .neq("id", excludeUserId);
  if (profilesError) throw profilesError;

  const userIds = (profiles ?? []).map((row) => row.id as string);
  if (userIds.length === 0) return [];

  const { data: subscriptions, error: subscriptionsError } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", userIds);
  if (subscriptionsError) throw subscriptionsError;

  return (subscriptions ?? []) as PushSubscriptionRow[];
}

export async function deletePushSubscriptionByEndpoint(
  endpoint: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);
  if (error) throw error;
}
