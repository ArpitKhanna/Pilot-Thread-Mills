import { NextResponse } from "next/server";
import { getAuthedProfile } from "@/lib/price-list/api-helpers";
import {
  deleteItemRequest,
  fulfillItemRequest,
  unfulfillItemRequest,
  updateItemRequest,
} from "@/lib/salesmen/item-requests";
import { getSalesman } from "@/lib/salesmen/queries";
import type { ItemRequestUrgency } from "@/lib/salesmen/types";

type RouteContext = {
  params: Promise<{ id: string; requestId: string }>;
};

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

function parseUrgency(raw: unknown): ItemRequestUrgency | { error: string } {
  const value = String(raw ?? "medium");
  if (value === "high" || value === "medium" || value === "low") return value;
  return { error: "Invalid urgency" };
}

function parseRequestFields(body: Record<string, unknown>) {
  const itemName = String(body.itemName ?? "").trim();
  if (!itemName) return { error: "Item name is required" as const };

  const qty = Number(body.qty);
  if (!Number.isFinite(qty) || qty <= 0) {
    return { error: "Quantity must be greater than 0" as const };
  }

  const requestedAtRaw = String(body.requestedAt ?? "").trim();
  const requestedAt = requestedAtRaw
    ? new Date(requestedAtRaw).toISOString()
    : new Date().toISOString();
  if (Number.isNaN(new Date(requestedAt).getTime())) {
    return { error: "Invalid request date" as const };
  }

  const urgency = parseUrgency(body.urgency);
  if (typeof urgency === "object" && "error" in urgency) return urgency;

  const notes = String(body.notes ?? "").trim();
  const priceListItemId = body.priceListItemId
    ? String(body.priceListItemId)
    : undefined;
  const itemType = String(body.itemType ?? "").trim() || undefined;

  return {
    data: {
      itemName,
      itemType,
      priceListItemId,
      qty,
      urgency,
      requestedAt,
      notes: notes || undefined,
    },
  };
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase, profile } = auth;

  if (!(await hasEntitySalesmenAccess(supabase, profile.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, requestId } = await context.params;
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

  try {
    if (body.status === "fulfilled") {
      const updated = await fulfillItemRequest(supabase, id, requestId);
      if (!updated) {
        return NextResponse.json(
          { error: "Open request not found" },
          { status: 404 },
        );
      }
      return NextResponse.json({ request: updated });
    }

    if (body.status === "open") {
      const updated = await unfulfillItemRequest(supabase, id, requestId);
      if (!updated) {
        return NextResponse.json(
          { error: "Fulfilled request not found" },
          { status: 404 },
        );
      }
      return NextResponse.json({ request: updated });
    }

    const parsed = parseRequestFields(body);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const updated = await updateItemRequest(
      supabase,
      id,
      requestId,
      parsed.data,
    );
    if (!updated) {
      return NextResponse.json(
        { error: "Open request not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ request: updated });
  } catch (err) {
    console.error("update item request", err);
    return NextResponse.json(
      { error: "Failed to update item request" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase, profile } = auth;

  if (!(await hasEntitySalesmenAccess(supabase, profile.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, requestId } = await context.params;
  const salesman = await getSalesman(supabase, id);
  if (!salesman) {
    return NextResponse.json({ error: "Salesman not found" }, { status: 404 });
  }

  try {
    const deleted = await deleteItemRequest(supabase, id, requestId);
    if (!deleted) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("delete item request", err);
    return NextResponse.json(
      { error: "Failed to delete item request" },
      { status: 500 },
    );
  }
}
