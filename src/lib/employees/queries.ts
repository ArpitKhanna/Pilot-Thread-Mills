import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppModule, EmployeeRole } from "@/lib/auth/types";
import { mapEmployeeRow, type DbEmployeeRow } from "./mappers";
import type { Employee, RoleAccessGrant, RoleAccessPayload } from "./types";

export async function listEmployees(
  supabase: SupabaseClient,
): Promise<Employee[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone, role, pin, is_active, created_at")
    .eq("account_type", "employee")
    .order("full_name");

  if (error) throw error;

  return ((data ?? []) as DbEmployeeRow[])
    .filter((row) => row.role != null)
    .map(mapEmployeeRow);
}

export async function countActiveAdmins(
  supabase: SupabaseClient,
  excludeId?: string,
): Promise<number> {
  let query = supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("account_type", "employee")
    .eq("role", "admin")
    .eq("is_active", true);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function getRoleAccessPayload(
  supabase: SupabaseClient,
): Promise<RoleAccessPayload> {
  const [{ data: modules, error: modulesError }, { data: grants, error: grantsError }] =
    await Promise.all([
      supabase.from("modules").select("*").order("sort_order"),
      supabase.from("role_module_access").select("role, module_id"),
    ]);

  if (modulesError) throw modulesError;
  if (grantsError) throw grantsError;

  return {
    modules: (modules ?? []) as AppModule[],
    grants: ((grants ?? []) as { role: EmployeeRole; module_id: string }[]).map(
      (row) => ({
        role: row.role,
        moduleId: row.module_id,
      }),
    ),
  };
}

export type { RoleAccessGrant };
