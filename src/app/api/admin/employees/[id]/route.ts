import { NextResponse } from "next/server";
import { normalizePhone, phoneToAuthEmail } from "@/lib/auth/phone";
import type { EmployeeRole } from "@/lib/auth/types";
import {
  isValidEmployeeRole,
  requireAdmin,
} from "@/lib/employees/admin";
import { getLastAdminViolation } from "@/lib/employees/guards";
import { mapEmployeeRow, type DbEmployeeRow } from "@/lib/employees/mappers";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await context.params;

  try {
    const { data: existing, error: existingError } = await auth.supabase
      .from("profiles")
      .select("id, full_name, phone, role, pin, is_active, created_at, account_type")
      .eq("id", id)
      .eq("account_type", "employee")
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }
    if (!existing || !existing.role) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const body = await request.json();
    const updates: {
      full_name?: string;
      phone?: string;
      role?: EmployeeRole;
      is_active?: boolean;
    } = {};

    if (body.full_name != null || body.fullName != null) {
      const fullName = String(body.full_name ?? body.fullName ?? "").trim();
      if (!fullName) {
        return NextResponse.json(
          { error: "Full name is required" },
          { status: 400 },
        );
      }
      updates.full_name = fullName;
    }

    if (body.phone != null) {
      const phone = String(body.phone).trim();
      if (!phone) {
        return NextResponse.json(
          { error: "Phone is required" },
          { status: 400 },
        );
      }
      updates.phone = normalizePhone(phone);
    }

    if (body.role != null) {
      if (!isValidEmployeeRole(body.role)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      updates.role = body.role;
    }

    if (body.is_active != null || body.isActive != null) {
      updates.is_active = Boolean(
        body.is_active != null ? body.is_active : body.isActive,
      );
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const violation = await getLastAdminViolation(
      auth.supabase,
      {
        id: existing.id,
        currentRole: existing.role as EmployeeRole,
        currentIsActive: existing.is_active,
      },
      {
        role: updates.role,
        isActive: updates.is_active,
      },
    );
    if (violation) {
      return NextResponse.json({ error: violation }, { status: 400 });
    }

    const admin = createAdminClient();

    if (updates.phone && updates.phone !== existing.phone) {
      const email = phoneToAuthEmail(updates.phone);
      const { error: authError } = await admin.auth.admin.updateUserById(id, {
        email,
        user_metadata: {
          phone: updates.phone,
          full_name: updates.full_name ?? existing.full_name,
        },
      });
      if (authError) {
        const message = authError.message.includes("already")
          ? "An employee with this phone number already exists"
          : authError.message;
        return NextResponse.json({ error: message }, { status: 400 });
      }
    } else if (updates.full_name) {
      await admin.auth.admin.updateUserById(id, {
        user_metadata: {
          phone: existing.phone,
          full_name: updates.full_name,
        },
      });
    }

    const { data: updated, error: updateError } = await admin
      .from("profiles")
      .update(updates)
      .eq("id", id)
      .select("id, full_name, phone, role, pin, is_active, created_at")
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { error: updateError?.message ?? "Failed to update employee" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      employee: mapEmployeeRow(updated as DbEmployeeRow),
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to update employee";
    if (message.includes("Enter a valid") || message.includes("phone")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const status = message.includes("Missing Supabase admin credentials")
      ? 500
      : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
