import { NextResponse } from "next/server";
import { normalizePhone, phoneToAuthEmail } from "@/lib/auth/phone";
import type { EmployeeRole } from "@/lib/auth/types";
import {
  isValidEmployeeRole,
  isValidPin,
  requireAdmin,
} from "@/lib/employees/admin";
import { mapEmployeeRow, type DbEmployeeRow } from "@/lib/employees/mappers";
import { listEmployees } from "@/lib/employees/queries";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const employees = await listEmployees(auth.supabase);
    return NextResponse.json({ employees });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list employees" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const phone = String(body.phone ?? "").trim();
    const pin = String(body.pin ?? "").trim();
    const fullName = String(body.full_name ?? body.fullName ?? "").trim();
    const role = body.role as EmployeeRole;

    if (!phone || !pin || !fullName) {
      return NextResponse.json(
        { error: "Phone, PIN, and full name are required" },
        { status: 400 },
      );
    }

    if (!isValidEmployeeRole(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    if (!isValidPin(pin)) {
      return NextResponse.json(
        { error: "PIN must be 4–6 digits" },
        { status: 400 },
      );
    }

    const normalizedPhone = normalizePhone(phone);
    const email = phoneToAuthEmail(phone);
    const admin = createAdminClient();

    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password: pin,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          phone: normalizedPhone,
          account_type: "employee",
          auth_method: "pin",
          role,
        },
      });

    if (createError || !created.user) {
      const message = createError?.message.includes("already been registered")
        ? "An employee with this phone number already exists"
        : (createError?.message ?? "Failed to create employee");
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // Trigger may have created the profile; upsert ensures pin/role are set.
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .upsert(
        {
          id: created.user.id,
          phone: normalizedPhone,
          full_name: fullName,
          account_type: "employee",
          auth_method: "pin",
          role,
          pin,
          is_active: true,
        },
        { onConflict: "id" },
      )
      .select("id, full_name, phone, role, pin, is_active, created_at")
      .single();

    if (profileError || !profile) {
      await admin.auth.admin.deleteUser(created.user.id);
      return NextResponse.json(
        { error: profileError?.message ?? "Failed to create profile" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      employee: mapEmployeeRow(profile as DbEmployeeRow),
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid phone number format" },
      { status: 400 },
    );
  }
}
