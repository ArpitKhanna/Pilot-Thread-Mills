import { NextResponse } from "next/server";
import { normalizePhone, phoneToAuthEmail } from "@/lib/auth/phone";
import type { EmployeeRole } from "@/lib/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const VALID_ROLES: EmployeeRole[] = ["admin", "manager", "operator"];

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (callerProfile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const phone = String(body.phone ?? "").trim();
    const pin = String(body.pin ?? "").trim();
    const fullName = String(body.full_name ?? "").trim();
    const role = body.role as EmployeeRole;

    if (!phone || !pin || !fullName) {
      return NextResponse.json(
        { error: "Phone, PIN, and full name are required" },
        { status: 400 },
      );
    }

    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    if (!/^\d{4,6}$/.test(pin)) {
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
        user_metadata: { full_name: fullName, phone: normalizedPhone },
      });

    if (createError || !created.user) {
      const message =
        createError?.message.includes("already been registered")
          ? "An employee with this phone number already exists"
          : (createError?.message ?? "Failed to create employee");
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { error: profileError } = await admin.from("profiles").insert({
      id: created.user.id,
      phone: normalizedPhone,
      full_name: fullName,
      account_type: "employee",
      auth_method: "pin",
      role,
      is_active: true,
    });

    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      employee: {
        id: created.user.id,
        phone: normalizedPhone,
        full_name: fullName,
        role,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid phone number format" },
      { status: 400 },
    );
  }
}
