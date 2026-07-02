import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import type { AppModule, EmployeeRole, Profile } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";

export type AppContext = {
  profile: Profile;
  modules: AppModule[];
  roleAccess: { role: EmployeeRole; module_id: string }[];
};

export async function getAppContext(): Promise<AppContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile?.is_active) return null;

  const { data: roleAccess } = await supabase
    .from("role_module_access")
    .select("role, module_id")
    .eq("role", profile.role ?? "picker");

  const accessibleIds = new Set(
    (roleAccess ?? []).map((row) => row.module_id),
  );

  const { data: allModules } = await supabase
    .from("modules")
    .select("*")
    .order("sort_order");

  const modules = (allModules ?? []).filter((m) =>
    accessibleIds.has(m.id),
  ) as AppModule[];

  return {
    profile,
    modules,
    roleAccess: (roleAccess ?? []) as {
      role: EmployeeRole;
      module_id: string;
    }[],
  };
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await getAppContext();

  if (!context) {
    redirect("/login");
  }

  return <AppShell context={context}>{children}</AppShell>;
}
