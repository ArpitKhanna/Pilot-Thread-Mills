import { NextResponse } from "next/server";
import {
  isAuthError,
  requireOrderCustomersAccess,
} from "@/lib/customer-orders/access";
import {
  deleteCustomerOrder,
  getCustomerOrder,
  updateCustomerOrder,
  type UpdateCustomerOrderInput,
} from "@/lib/customer-orders/queries";
import { syncDeliveryRunsForOrderStatus } from "@/lib/customer-orders/delivery-runs";
import type { CustomerOrderStatus } from "@/lib/customer-orders/types";

type RouteContext = { params: Promise<{ id: string }> };

const STATUSES: CustomerOrderStatus[] = [
  "draft",
  "picking",
  "packed",
  "invoiced",
  "out_for_delivery",
  "delivered",
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
  if (body.isUrgent !== undefined) {
    input.isUrgent = Boolean(body.isUrgent);
  }
  if (body.areaSnapshot !== undefined) {
    input.areaSnapshot =
      body.areaSnapshot == null ? null : String(body.areaSnapshot);
  }
  if (body.deliveryBy !== undefined) {
    input.deliveryBy =
      body.deliveryBy == null || body.deliveryBy === ""
        ? null
        : String(body.deliveryBy);
  }

  try {
    const order = await updateCustomerOrder(supabase, id, input);
    if (input.status) {
      await syncDeliveryRunsForOrderStatus(supabase, id, input.status);
    }
    return NextResponse.json({ order });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update order" },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireOrderCustomersAccess();
  if (isAuthError(auth)) return auth.error;
  const { supabase } = auth;
  const { id } = await context.params;

  try {
    await deleteCustomerOrder(supabase, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to delete order" },
      { status: 400 },
    );
  }
}
