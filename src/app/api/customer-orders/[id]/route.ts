import { NextResponse } from "next/server";
import {
  isAuthError,
  requireOrderCustomersAccess,
} from "@/lib/customer-orders/access";
import {
  logCustomerOrderEvent,
  listCustomerOrderEvents,
  statusChangeMessage,
} from "@/lib/customer-orders/events";
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
    const events = await listCustomerOrderEvents(supabase, id);
    return NextResponse.json({ order, events });
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
  const { supabase, profile } = auth;
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
    const before = await getCustomerOrder(supabase, id);
    if (!before) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const order = await updateCustomerOrder(supabase, id, input);
    if (input.status) {
      await syncDeliveryRunsForOrderStatus(supabase, id, input.status);
    }

    if (input.status && input.status !== before.status) {
      await logCustomerOrderEvent(supabase, {
        orderId: id,
        kind: "status_changed",
        message: statusChangeMessage(before.status, input.status),
        actorId: profile.id,
        fromStatus: before.status,
        toStatus: input.status,
      });
    }

    if (
      input.isUrgent !== undefined &&
      input.isUrgent !== before.isUrgent
    ) {
      await logCustomerOrderEvent(supabase, {
        orderId: id,
        kind: input.isUrgent ? "urgent_set" : "urgent_cleared",
        message: input.isUrgent
          ? "Order was marked urgent."
          : "Urgent flag was cleared.",
        actorId: profile.id,
      });
    }

    if (
      input.deliveryBy !== undefined &&
      input.deliveryBy !== before.deliveryBy
    ) {
      const name = order.deliveryByName?.trim();
      await logCustomerOrderEvent(supabase, {
        orderId: id,
        kind: "delivery_assigned",
        message: name
          ? `Delivery assigned to ${name}.`
          : "Delivery assignment updated.",
        actorId: profile.id,
      });
    }

    const events = await listCustomerOrderEvents(supabase, id);
    return NextResponse.json({ order, events });
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
