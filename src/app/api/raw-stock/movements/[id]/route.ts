import { NextResponse } from "next/server";
import {
  requireRawStockAccess,
  validateMovementUpdatePayload,
} from "@/lib/raw-stock/api-helpers";
import {
  deleteMovement,
  getMovementById,
  updateMovement,
} from "@/lib/raw-stock/queries";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireRawStockAccess();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase } = auth;
  const { id } = await params;

  const existing = await getMovementById(supabase, id);
  if (!existing) {
    return NextResponse.json({ error: "Movement not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validated = validateMovementUpdatePayload(body, existing.movementType);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  try {
    const movement = await updateMovement(supabase, id, {
      category: validated.data.category,
      countLabel: validated.data.countLabel,
      quantityKg: validated.data.quantityKg,
      movementDate: validated.data.movementDate,
      supplierId:
        existing.movementType === "stock_in"
          ? validated.data.supplierId
          : null,
      doNumber:
        existing.movementType === "stock_in"
          ? validated.data.doNumber
          : null,
      notes: validated.data.notes,
    });
    return NextResponse.json({ movement });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update movement" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireRawStockAccess();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase } = auth;
  const { id } = await params;

  const existing = await getMovementById(supabase, id);
  if (!existing) {
    return NextResponse.json({ error: "Movement not found" }, { status: 404 });
  }

  try {
    await deleteMovement(supabase, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to delete movement" },
      { status: 500 },
    );
  }
}
