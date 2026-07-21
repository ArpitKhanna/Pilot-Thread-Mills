import { NextResponse } from "next/server";
import { getAuthedProfile } from "@/lib/price-list/api-helpers";
import { getSalesman } from "@/lib/salesmen/queries";
import { MARKET_DAYS } from "@/lib/salesmen/types";

type RouteContext = { params: Promise<{ id: string }> };

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

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase, profile } = auth;

  if (!(await hasEntityCustomersAccess(supabase, profile.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await getSalesman(supabase, id);
  if (!existing || existing.entityType !== "customer") {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = String(body.name ?? existing.name).trim();
  if (!name) {
    return NextResponse.json(
      { error: "Shop name is required" },
      { status: 400 },
    );
  }

  const phone = String(body.phone ?? existing.phone).trim();
  if (!phone) {
    return NextResponse.json(
      { error: "Phone number is required" },
      { status: 400 },
    );
  }

  const alternatePhone =
    body.alternatePhone !== undefined
      ? String(body.alternatePhone ?? "").trim()
      : existing.alternatePhone;

  const area =
    body.area !== undefined
      ? String(body.area ?? "").trim()
      : existing.area;

  let marketDay = existing.marketDay;
  if (body.marketDay !== undefined) {
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
    marketDay = marketDayRaw as typeof marketDay;
  }

  const updates: Record<string, unknown> = {
    name,
    phone,
    alternate_phone: alternatePhone,
    entity_type: "customer",
    category: "Customer",
    market_day: marketDay,
    area,
  };

  if (typeof body.isActive === "boolean") {
    updates.is_active = body.isActive;
  }

  if (typeof body.isDefaulter === "boolean") {
    updates.is_defaulter = body.isDefaulter;
  }

  if (body.pendingBalance !== undefined) {
    const pendingBalance = Number(body.pendingBalance);
    if (!Number.isFinite(pendingBalance) || pendingBalance < 0) {
      return NextResponse.json(
        { error: "Last balance must be a valid non-negative amount" },
        { status: 400 },
      );
    }
    updates.pending_balance = Math.round(pendingBalance * 100) / 100;
  }

  const { error: updateError } = await supabase
    .from("salesmen")
    .update(updates)
    .eq("id", id);

  if (updateError) {
    console.error(updateError);
    return NextResponse.json(
      { error: updateError.message || "Failed to save customer" },
      { status: 500 },
    );
  }

  const customer = await getSalesman(supabase, id);
  return NextResponse.json({ customer });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase, profile } = auth;

  if (!(await hasEntityCustomersAccess(supabase, profile.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await getSalesman(supabase, id);
  if (!existing || existing.entityType !== "customer") {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const [
    { count: orderCount, error: orderCountError },
    { count: invoiceCount, error: invoiceCountError },
  ] = await Promise.all([
    supabase
      .from("customer_orders")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", id),
    supabase
      .from("salesmen_invoices")
      .select("id", { count: "exact", head: true })
      .eq("salesman_id", id),
  ]);

  if (orderCountError || invoiceCountError) {
    console.error(orderCountError ?? invoiceCountError);
    return NextResponse.json(
      { error: "Failed to check customer records" },
      { status: 500 },
    );
  }

  if ((orderCount ?? 0) > 0 || (invoiceCount ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          "This customer has orders or invoices and cannot be deleted. Mark them inactive instead.",
      },
      { status: 409 },
    );
  }

  const { error: deleteError } = await supabase
    .from("salesmen")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error(deleteError);
    return NextResponse.json(
      { error: deleteError.message || "Failed to delete customer" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
