import { NextResponse } from "next/server";
import { getAuthedProfile } from "@/lib/price-list/api-helpers";
import { getSalesman } from "@/lib/salesmen/queries";
import type { SalesmanDiscountRule, SalesmanEntityType } from "@/lib/salesmen/types";

type RouteContext = { params: Promise<{ id: string }> };

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

function parseDiscountRules(raw: unknown): SalesmanDiscountRule[] | { error: string } {
  if (!Array.isArray(raw)) {
    return { error: "Discount rules must be an array" };
  }

  const rules: SalesmanDiscountRule[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      return { error: "Invalid discount rule" };
    }
    const row = entry as Record<string, unknown>;
    const itemName = String(row.itemName ?? "").trim();
    const amountPerUnit = Number(row.amountPerUnit);
    if (!itemName) {
      return { error: "Each discount rule needs an item name" };
    }
    if (!Number.isFinite(amountPerUnit) || amountPerUnit < 0) {
      return { error: "Each discount rule needs a valid rupee amount" };
    }
    rules.push({
      id: String(row.id ?? crypto.randomUUID()),
      itemName,
      priceListItemId: row.priceListItemId
        ? String(row.priceListItemId)
        : undefined,
      amountPerUnit,
      description:
        String(row.description ?? "").trim() ||
        `₹${amountPerUnit} per ${itemName}`,
    });
  }
  return rules;
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase, profile } = auth;

  if (!(await hasEntitySalesmenAccess(supabase, profile.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await getSalesman(supabase, id);
  if (!existing) {
    return NextResponse.json({ error: "Salesman not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = String(body.name ?? existing.name).trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const entityTypeRaw = String(body.entityType ?? existing.entityType);
  if (entityTypeRaw !== "salesman" && entityTypeRaw !== "customer") {
    return NextResponse.json({ error: "Invalid entity type" }, { status: 400 });
  }
  const entityType = entityTypeRaw as SalesmanEntityType;

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

  const updates: Record<string, unknown> = {
    name,
    phone,
    alternate_phone: alternatePhone,
    entity_type: entityType,
    category: entityType === "customer" ? "Customer" : "Salesmen",
  };

  if (body.discountRules !== undefined) {
    const parsedRules = parseDiscountRules(body.discountRules);
    if ("error" in parsedRules) {
      return NextResponse.json({ error: parsedRules.error }, { status: 400 });
    }
    updates.discount_rules = parsedRules;
  }

  if (typeof body.isActive === "boolean") {
    updates.is_active = body.isActive;
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

  if (body.marketDay !== undefined) {
    const marketDay = String(body.marketDay ?? "").trim().toLowerCase();
    const allowed = [
      "",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ];
    if (!allowed.includes(marketDay)) {
      return NextResponse.json(
        { error: "Invalid market day" },
        { status: 400 },
      );
    }
    updates.market_day = marketDay;
  }

  if (body.area !== undefined) {
    updates.area = String(body.area ?? "").trim();
  }

  if (typeof body.isDefaulter === "boolean") {
    updates.is_defaulter = body.isDefaulter;
  }

  const { error: updateError } = await supabase
    .from("salesmen")
    .update(updates)
    .eq("id", id);

  if (updateError) {
    console.error(updateError);
    return NextResponse.json(
      { error: updateError.message || "Failed to save details" },
      { status: 500 },
    );
  }

  const salesman = await getSalesman(supabase, id);
  return NextResponse.json({ salesman });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase, profile } = auth;

  if (!(await hasEntitySalesmenAccess(supabase, profile.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await getSalesman(supabase, id);
  if (!existing) {
    return NextResponse.json({ error: "Salesman not found" }, { status: 404 });
  }

  const { count, error: countError } = await supabase
    .from("salesmen_invoices")
    .select("id", { count: "exact", head: true })
    .eq("salesman_id", id);

  if (countError) {
    console.error(countError);
    return NextResponse.json(
      { error: "Failed to check salesman invoices" },
      { status: 500 },
    );
  }

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          "This salesman has invoices and cannot be deleted. Mark them inactive instead.",
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
      { error: deleteError.message || "Failed to delete salesman" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
