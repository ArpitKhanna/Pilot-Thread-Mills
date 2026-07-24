import { NextResponse } from "next/server";
import {
  isAuthError,
  requireOrderCustomersAccess,
} from "@/lib/customer-orders/access";
import {
  createDeliveryRunAndInvoice,
  listDeliveryRuns,
} from "@/lib/customer-orders/delivery-runs";

export async function GET() {
  const auth = await requireOrderCustomersAccess();
  if (isAuthError(auth)) return auth.error;
  const { supabase } = auth;

  try {
    const runs = await listDeliveryRuns(supabase);
    return NextResponse.json({ runs });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list delivery runs" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireOrderCustomersAccess();
  if (isAuthError(auth)) return auth.error;
  const { supabase, profile } = auth;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderIds = Array.isArray(body.orderIds)
    ? body.orderIds.map((id) => String(id))
    : [];
  const deliveryBy = String(body.deliveryBy ?? "").trim();
  if (!deliveryBy) {
    return NextResponse.json(
      { error: "Delivery person is required" },
      { status: 400 },
    );
  }

  const lineQtyOverridesByOrder =
    body.lineQtyOverridesByOrder &&
    typeof body.lineQtyOverridesByOrder === "object"
      ? (body.lineQtyOverridesByOrder as Record<string, Record<string, number>>)
      : undefined;

  try {
    const run = await createDeliveryRunAndInvoice(supabase, {
      orderIds,
      deliveryBy,
      area: body.area != null ? String(body.area) : null,
      runDate: body.runDate ? String(body.runDate) : undefined,
      notes: body.notes != null ? String(body.notes) : null,
      createdBy: profile.id,
      lineQtyOverridesByOrder,
    });
    return NextResponse.json({ run }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Failed to create delivery run",
      },
      { status: 400 },
    );
  }
}
