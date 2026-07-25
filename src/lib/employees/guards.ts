import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmployeeRole } from "@/lib/auth/types";
import { countActiveAdmins } from "./queries";

/**
 * Returns an error message if the update would leave the system with zero
 * active admins; otherwise null.
 */
export async function getLastAdminViolation(
  supabase: SupabaseClient,
  target: {
    id: string;
    currentRole: EmployeeRole;
    currentIsActive: boolean;
  },
  next: {
    role?: EmployeeRole;
    isActive?: boolean;
  },
): Promise<string | null> {
  const nextRole = next.role ?? target.currentRole;
  const nextIsActive = next.isActive ?? target.currentIsActive;

  const wasActiveAdmin = target.currentRole === "admin" && target.currentIsActive;
  const willBeActiveAdmin = nextRole === "admin" && nextIsActive;

  if (!wasActiveAdmin || willBeActiveAdmin) {
    return null;
  }

  const otherActiveAdmins = await countActiveAdmins(supabase, target.id);
  if (otherActiveAdmins === 0) {
    return "Cannot deactivate or demote the last active admin";
  }

  return null;
}
