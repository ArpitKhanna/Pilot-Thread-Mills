import { redirect } from "next/navigation";
import { getAppContext } from "@/app/(app)/layout";
import { EmployeesRolesClient } from "@/components/employees/EmployeesRolesClient";
import { getRoleAccessPayload, listEmployees } from "@/lib/employees/queries";
import { createClient } from "@/lib/supabase/server";

export default async function EmployeesPage() {
  const context = await getAppContext();
  if (!context) redirect("/login");

  const hasAccess = context.modules.some((m) => m.id === "employees-roles");
  if (!hasAccess) redirect("/dashboard");

  if (context.profile.role !== "admin") {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const [employees, roleAccess] = await Promise.all([
    listEmployees(supabase),
    getRoleAccessPayload(supabase),
  ]);

  return (
    <EmployeesRolesClient
      context={context}
      initialEmployees={employees}
      initialRoleAccess={roleAccess}
    />
  );
}
