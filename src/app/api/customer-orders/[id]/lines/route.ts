import { NextResponse } from "next/server";
import {
  isAuthError,
  requireOrderCustomersAccess,
} from "@/lib/customer-orders/access";
import {
  getCustomerOrder,
  replaceOrderLines,
  resolveShadesForLines,
  type OrderLineInput,
} from "@/lib/customer-orders/queries";
import type {
  CustomerOrderLineSource,
  CustomerOrderLineUnit,
} from "@/lib/customer-orders/types";

type RouteContext = { params: Promise<{ id: string }> };

const UNITS: CustomerOrderLineUnit[] = ["box", "dibbi", "cone", "unit"];
const SOURCES: CustomerOrderLineSource[] = ["ocr", "manual"];

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireOrderCustomersAccess();
  if (isAuthError(auth)) return auth.error;
  const { supabase } = auth;
  const { id } = await context.params;

  const order = await getCustomerOrder(supabase, id);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.status === "invoiced" || order.status === "cancelled") {
    return NextResponse.json(
      { error: "Cannot edit lines on this order" },
      { status: 400 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawLines = Array.isArray(body.lines) ? body.lines : null;
  if (!rawLines) {
    return NextResponse.json({ error: "lines array is required" }, { status: 400 });
  }

  const lines: OrderLineInput[] = [];
  for (const raw of rawLines) {
    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "Invalid line" }, { status: 400 });
    }
    const row = raw as Record<string, unknown>;
    const shadeCode = String(row.shadeCode ?? "").trim();
    const qty = Number(row.qty);
    if (!shadeCode || !(qty > 0)) {
      return NextResponse.json(
        { error: "Each line needs shadeCode and qty > 0" },
        { status: 400 },
      );
    }
    const unit = String(row.unit ?? "box") as CustomerOrderLineUnit;
    const source = String(row.source ?? "manual") as CustomerOrderLineSource;
    if (!UNITS.includes(unit) || !SOURCES.includes(source)) {
      return NextResponse.json({ error: "Invalid unit or source" }, { status: 400 });
    }
    lines.push({
      priceListItemId: row.priceListItemId
        ? String(row.priceListItemId)
        : null,
      shadeId: row.shadeId ? String(row.shadeId) : null,
      shadeCode,
      qty,
      unit,
      source,
    });
  }

  try {
    const createMissingShades = body.createMissingShades !== false;
    const resolved = createMissingShades
      ? await resolveShadesForLines(supabase, lines)
      : lines;
    const saved = await replaceOrderLines(supabase, id, resolved);
    const refreshed = await getCustomerOrder(supabase, id);
    return NextResponse.json({ lines: saved, order: refreshed });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to save lines" },
      { status: 500 },
    );
  }
}
