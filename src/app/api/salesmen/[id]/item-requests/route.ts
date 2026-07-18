import { NextResponse } from "next/server";
import { getAuthedProfile } from "@/lib/price-list/api-helpers";
import {
  createItemRequest,
  listItemRequestsForSalesman,
} from "@/lib/salesmen/item-requests";
import { getSalesman } from "@/lib/salesmen/queries";

type RouteContext = { params: Promise<{ id: string }> };

async function hasModuleAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  role: string | null,
  moduleId: string,
) {
  if (role === "admin") return true;
  const { data } = await supabase
    .from("role_module_access")
    .select("module_id")
    .eq("role", role ?? "picker")
    .eq("module_id", moduleId)
    .maybeSingle();
  return Boolean(data);
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase, profile } = auth;

  const canRead =
    (await hasModuleAccess(supabase, profile.role, "entity-salesmen")) ||
    (await hasModuleAccess(supabase, profile.role, "order-salesmen"));
  if (!canRead) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const salesman = await getSalesman(supabase, id);
  if (!salesman) {
    return NextResponse.json({ error: "Salesman not found" }, { status: 404 });
  }

  try {
    const requests = await listItemRequestsForSalesman(supabase, id);
    return NextResponse.json({ requests });
  } catch (err) {
    console.error("list item requests", err);
    return NextResponse.json(
      { error: "Failed to load item requests" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase, profile } = auth;

  if (!(await hasModuleAccess(supabase, profile.role, "entity-salesmen"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const salesman = await getSalesman(supabase, id);
  if (!salesman) {
    return NextResponse.json({ error: "Salesman not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const itemName = String(body.itemName ?? "").trim();
  if (!itemName) {
    return NextResponse.json({ error: "Item name is required" }, { status: 400 });
  }

  const qty = Number(body.qty);
  if (!Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json({ error: "Quantity must be greater than 0" }, { status: 400 });
  }

  const requestedAtRaw = String(body.requestedAt ?? "").trim();
  const requestedAt = requestedAtRaw
    ? new Date(requestedAtRaw).toISOString()
    : new Date().toISOString();
  if (Number.isNaN(new Date(requestedAt).getTime())) {
    return NextResponse.json({ error: "Invalid request date" }, { status: 400 });
  }

  const notes = String(body.notes ?? "").trim();
  const priceListItemId = body.priceListItemId
    ? String(body.priceListItemId)
    : undefined;

  try {
    const created = await createItemRequest(supabase, id, {
      itemName,
      priceListItemId,
      qty,
      requestedAt,
      notes: notes || undefined,
    });
    return NextResponse.json({ request: created }, { status: 201 });
  } catch (err) {
    console.error("create item request", err);
    return NextResponse.json(
      { error: "Failed to create item request" },
      { status: 500 },
    );
  }
}
