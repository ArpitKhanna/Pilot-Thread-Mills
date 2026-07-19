import { NextResponse } from "next/server";
import type { Profile } from "@/lib/auth/types";
import { getAuthedProfile } from "@/lib/price-list/api-helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

type AuthOk = {
  supabase: SupabaseClient;
  profile: Profile;
};

type AuthErr = {
  error: NextResponse;
};

export async function requireOrderCustomersAccess(): Promise<AuthOk | AuthErr> {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) {
    return { error: auth.error };
  }

  if (!("supabase" in auth) || !auth.supabase || !auth.profile) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { supabase, profile } = auth;
  if (profile.role === "admin") {
    return { supabase, profile };
  }

  const { data } = await supabase
    .from("role_module_access")
    .select("module_id")
    .eq("role", profile.role ?? "picker")
    .eq("module_id", "order-customers")
    .maybeSingle();

  if (!data) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { supabase, profile };
}

export function isAuthError(
  auth: AuthOk | AuthErr,
): auth is AuthErr {
  return "error" in auth;
}
