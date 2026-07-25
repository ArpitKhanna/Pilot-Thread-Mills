import { NextResponse } from "next/server";
import { isValidPin, requireAdmin } from "@/lib/employees/admin";
import { mapEmployeeRow, type DbEmployeeRow } from "@/lib/employees/mappers";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await context.params;

  try {
    const body = await request.json();
    const pin = String(body.pin ?? "").trim();

    if (!isValidPin(pin)) {
      return NextResponse.json(
        { error: "PIN must be exactly 6 digits" },
        { status: 400 },
      );
    }

    const { data: existing, error: existingError } = await auth.supabase
      .from("profiles")
      .select("id")
      .eq("id", id)
      .eq("account_type", "employee")
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const admin = createAdminClient();

    const { error: authError } = await admin.auth.admin.updateUserById(id, {
      password: pin,
    });
    if (authError) {
      const raw = authError.message;
      const message = raw.toLowerCase().includes("password")
        ? "PIN was rejected by auth settings. Use a 6-digit PIN."
        : raw;
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { data: updated, error: updateError } = await admin
      .from("profiles")
      .update({ pin })
      .eq("id", id)
      .select("id, full_name, phone, role, pin, is_active, created_at")
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { error: updateError?.message ?? "Failed to update PIN" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      employee: mapEmployeeRow(updated as DbEmployeeRow),
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to reset PIN";
    const status = message.includes("Missing Supabase admin credentials")
      ? 500
      : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
