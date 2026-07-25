import { NextResponse } from "next/server";
import type { EmployeeRole } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";
import { EMPLOYEE_ROLES } from "./types";

export function isValidEmployeeRole(role: unknown): role is EmployeeRole {
  return (
    typeof role === "string" &&
    (EMPLOYEE_ROLES as string[]).includes(role)
  );
}

export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      supabase: null,
      user: null,
    } as const;
  }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", user.id)
    .single();

  if (
    !callerProfile?.is_active ||
    callerProfile.role !== "admin"
  ) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      supabase: null,
      user: null,
    } as const;
  }

  return {
    error: null,
    supabase,
    user,
    callerProfile,
  } as const;
}
