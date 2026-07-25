import { NextResponse } from "next/server";
import type { EmployeeRole } from "@/lib/auth/types";
import { requireAdmin } from "@/lib/employees/admin";
import { getRoleAccessPayload } from "@/lib/employees/queries";
import { EDITABLE_ROLES, EMPLOYEE_ROLES } from "@/lib/employees/types";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const payload = await getRoleAccessPayload(auth.supabase);
    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load role access" },
      { status: 500 },
    );
  }
}

type GrantInput = {
  role: EmployeeRole;
  moduleId: string;
};

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const grants = (body.grants ?? []) as GrantInput[];

    if (!Array.isArray(grants)) {
      return NextResponse.json(
        { error: "grants must be an array" },
        { status: 400 },
      );
    }

    const { data: modules, error: modulesError } = await auth.supabase
      .from("modules")
      .select("id");
    if (modulesError) {
      return NextResponse.json({ error: modulesError.message }, { status: 500 });
    }

    const moduleIds = new Set((modules ?? []).map((m) => m.id as string));
    const editableRoleSet = new Set<string>(EDITABLE_ROLES);

    const cleaned: { role: EmployeeRole; module_id: string }[] = [];
    for (const grant of grants) {
      if (!grant || typeof grant !== "object") continue;
      const role = grant.role;
      const moduleId = grant.moduleId ?? (grant as { module_id?: string }).module_id;

      if (!role || !moduleId) continue;
      if (!editableRoleSet.has(role)) {
        return NextResponse.json(
          { error: "Cannot modify admin role access" },
          { status: 400 },
        );
      }
      if (!moduleIds.has(moduleId)) {
        return NextResponse.json(
          { error: `Unknown module: ${moduleId}` },
          { status: 400 },
        );
      }
      cleaned.push({ role, module_id: moduleId });
    }

    const admin = createAdminClient();

    // Ensure admin always has every module
    const adminRows = [...moduleIds].map((module_id) => ({
      role: "admin" as EmployeeRole,
      module_id,
    }));

    const { error: deleteError } = await admin
      .from("role_module_access")
      .delete()
      .in("role", EDITABLE_ROLES);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    if (cleaned.length > 0) {
      const { error: insertError } = await admin
        .from("role_module_access")
        .insert(cleaned);
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    // Upsert admin grants (idempotent full set)
    const { error: adminUpsertError } = await admin
      .from("role_module_access")
      .upsert(adminRows, { onConflict: "role,module_id" });
    if (adminUpsertError) {
      return NextResponse.json(
        { error: adminUpsertError.message },
        { status: 500 },
      );
    }

    const payload = await getRoleAccessPayload(auth.supabase);
    // Filter response to known roles only
    payload.grants = payload.grants.filter((g) =>
      (EMPLOYEE_ROLES as string[]).includes(g.role),
    );

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
