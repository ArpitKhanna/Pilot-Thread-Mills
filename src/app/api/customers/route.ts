import { NextResponse } from "next/server";
import { getAuthedProfile } from "@/lib/price-list/api-helpers";
import { createCustomer } from "@/lib/salesmen/queries";
import { MARKET_DAYS } from "@/lib/salesmen/types";

async function hasEntityCustomersAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  role: string | null,
) {
  if (role === "admin") return true;
  const { data } = await supabase
    .from("role_module_access")
    .select("module_id")
    .eq("role", role ?? "picker")
    .eq("module_id", "entity-customers")
    .maybeSingle();
  return Boolean(data);
}

export async function POST(request: Request) {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase, profile } = auth;

  if (!(await hasEntityCustomersAccess(supabase, profile.role))) {
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
    return NextResponse.json(
      { error: "Shop name is required" },
      { status: 400 },
    );
  }

  const phone = String(body.phone ?? "").trim();
  if (!phone) {
    return NextResponse.json(
      { error: "Phone number is required" },
      { status: 400 },
    );
  }

  const alternatePhone = String(body.alternatePhone ?? "").trim();
  const area = String(body.area ?? "").trim();

  const marketDayRaw = String(body.marketDay ?? "").trim().toLowerCase();
  if (
    marketDayRaw &&
    !(MARKET_DAYS as readonly string[]).includes(marketDayRaw)
  ) {
    return NextResponse.json(
      { error: "Invalid market day" },
      { status: 400 },
    );
  }

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

  const isDefaulter = Boolean(body.isDefaulter);

  try {
    const customer = await createCustomer(supabase, {
      name,
      phone,
      alternatePhone: alternatePhone || undefined,
      pendingBalance,
      marketDay: marketDayRaw,
      area,
      isDefaulter,
    });
    return NextResponse.json({ customer }, { status: 201 });
  } catch (err) {
    console.error("create customer", err);
    return NextResponse.json(
      { error: "Failed to create customer" },
      { status: 500 },
    );
  }
}
