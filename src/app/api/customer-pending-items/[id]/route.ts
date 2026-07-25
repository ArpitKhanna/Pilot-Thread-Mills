import { NextResponse } from "next/server";
import {
  isAuthError,
  requireEntityOrOrderCustomersAccess,
} from "@/lib/customer-orders/access";
import {
  deletePendingItem,
  updatePendingItem,
} from "@/lib/customer-orders/pending-dyeing";
import type {
  CustomerOrderLineUnit,
  CustomerPendingItemStatus,
} from "@/lib/customer-orders/types";

type RouteContext = { params: Promise<{ id: string }> };

const UNITS: CustomerOrderLineUnit[] = ["box", "dibbi", "cone", "unit"];
const STATUSES: CustomerPendingItemStatus[] = [
  "open",
  "in_dyeing",
  "ready",
  "fulfilled",
  "cancelled",
];

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireEntityOrOrderCustomersAccess();
  if (isAuthError(auth)) return auth.error;
  const { supabase } = auth;
  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    if (body.unit !== undefined) {
      const unit = String(body.unit) as CustomerOrderLineUnit;
      if (!UNITS.includes(unit)) {
        return NextResponse.json({ error: "Invalid unit" }, { status: 400 });
      }
    }
    if (body.status !== undefined) {
      const status = String(body.status) as CustomerPendingItemStatus;
      if (!STATUSES.includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
    }

    const pending = await updatePendingItem(supabase, id, {
      ...(body.priceListItemId !== undefined
        ? {
            priceListItemId:
              body.priceListItemId == null || body.priceListItemId === ""
                ? null
                : String(body.priceListItemId),
          }
        : {}),
      ...(body.shadeCode !== undefined
        ? { shadeCode: String(body.shadeCode) }
        : {}),
      ...(body.qty !== undefined ? { qty: Number(body.qty) } : {}),
      ...(body.unit !== undefined
        ? { unit: String(body.unit) as CustomerOrderLineUnit }
        : {}),
      ...(body.isUrgent !== undefined
        ? { isUrgent: Boolean(body.isUrgent) }
        : {}),
      ...(body.notes !== undefined
        ? {
            notes:
              body.notes == null || body.notes === ""
                ? null
                : String(body.notes),
          }
        : {}),
      ...(body.status !== undefined
        ? { status: String(body.status) as CustomerPendingItemStatus }
        : {}),
    });

    return NextResponse.json({ pending });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Failed to update missing item",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireEntityOrOrderCustomersAccess();
  if (isAuthError(auth)) return auth.error;
  const { supabase } = auth;
  const { id } = await context.params;

  try {
    await deletePendingItem(supabase, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Failed to delete missing item",
      },
      { status: 400 },
    );
  }
}
