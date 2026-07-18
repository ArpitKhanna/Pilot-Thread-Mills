import { NextResponse } from "next/server";
import { getAuthedProfile } from "@/lib/price-list/api-helpers";
import { createSalesman } from "@/lib/salesmen/queries";

async function hasEntitySalesmenAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  role: string | null,
) {
  if (role === "admin") return true;
  const { data } = await supabase
    .from("role_module_access")
    .select("module_id")
    .eq("role", role ?? "picker")
    .eq("module_id", "entity-salesmen")
    .maybeSingle();
  return Boolean(data);
}

export async function POST(request: Request) {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase, profile } = auth;

  if (!(await hasEntitySalesmenAccess(supabase, profile.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const phone = String(body.phone ?? "").trim();
  if (!phone) {
    return NextResponse.json(
      { error: "Phone number is required" },
      { status: 400 },
    );
  }

  const alternatePhone = String(body.alternatePhone ?? "").trim();

  let pendingBalance = 0;
  if (
    body.pendingBalance !== undefined &&
    body.pendingBalance !== null &&
    String(body.pendingBalance).trim() !== ""
  ) {
    pendingBalance = Number(body.pendingBalance);
    if (!Number.isFinite(pendingBalance) || pendingBalance < 0) {
      return NextResponse.json(
        { error: "Last balance must be a valid non-negative amount" },
        { status: 400 },
      );
    }
    pendingBalance = Math.round(pendingBalance * 100) / 100;
  }

  try {
    const salesman = await createSalesman(supabase, {
      name,
      phone,
      alternatePhone: alternatePhone || undefined,
      pendingBalance,
    });
    return NextResponse.json({ salesman }, { status: 201 });
  } catch (err) {
    console.error("create salesman", err);
    return NextResponse.json(
      { error: "Failed to create salesman" },
      { status: 500 },
    );
  }
}
