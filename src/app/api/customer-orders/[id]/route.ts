import { NextResponse } from "next/server";
import {
  isAuthError,
  requireOrderCustomersAccess,
} from "@/lib/customer-orders/access";
import {
  getCustomerOrder,
  updateCustomerOrder,
  type UpdateCustomerOrderInput,
} from "@/lib/customer-orders/queries";
import type { CustomerOrderStatus } from "@/lib/customer-orders/types";

type RouteContext = { params: Promise<{ id: string }> };

const STATUSES: CustomerOrderStatus[] = [
  "draft",
  "confirmed",
  "picking",
  "invoiced",
  "cancelled",
];

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireOrderCustomersAccess();
  if (isAuthError(auth)) return auth.error;
  const { supabase } = auth;
  const { id } = await context.params;

  try {
    const order = await getCustomerOrder(supabase, id);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    return NextResponse.json({ order });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load order" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireOrderCustomersAccess();
  if (isAuthError(auth)) return auth.error;
  const { supabase } = auth;
  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const input: UpdateCustomerOrderInput = {};
  if (body.status !== undefined) {
    const status = String(body.status) as CustomerOrderStatus;
    if (!STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    input.status = status;
  }
  if (body.notes !== undefined) {
    input.notes = body.notes == null ? null : String(body.notes);
  }
  if (body.orderDate !== undefined) {
    input.orderDate = String(body.orderDate);
  }

  try {
    const order = await updateCustomerOrder(supabase, id, input);
    return NextResponse.json({ order });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update order" },
      { status: 400 },
    );
  }
}
