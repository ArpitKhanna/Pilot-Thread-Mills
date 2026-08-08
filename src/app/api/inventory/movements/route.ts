import { NextResponse } from "next/server";
import {
  isInventoryAuthError,
  requireInventoryAccess,
} from "@/lib/inventory/access";
import type { FinishedStockMovementType } from "@/lib/inventory/types";
import {
  createMovement,
  getEllfa270ItemId,
  listMovementsForItem,
} from "@/lib/inventory/queries";

const MOVEMENT_TYPES: FinishedStockMovementType[] = [
  "opening_balance",
  "stock_in",
  "stock_out",
  "adjustment",
];

export async function GET() {
  const auth = await requireInventoryAccess();
  if (isInventoryAuthError(auth)) return auth.error;
  const { supabase } = auth;

  try {
    const itemId = await getEllfa270ItemId(supabase);
    const movements = await listMovementsForItem(supabase, itemId);
    return NextResponse.json({ movements });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list movements" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireInventoryAccess();
  if (isInventoryAuthError(auth)) return auth.error;
  const { supabase, profile } = auth;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const movementType = String(body.movementType ?? "") as FinishedStockMovementType;
  if (!MOVEMENT_TYPES.includes(movementType)) {
    return NextResponse.json({ error: "Invalid movement type" }, { status: 400 });
  }

  const shadeId = String(body.shadeId ?? "").trim();
  const shadeCode = String(body.shadeCode ?? "").trim();
  const quantity = Number(body.quantity);

  if (!shadeId || !shadeCode || !(quantity > 0)) {
    return NextResponse.json(
      { error: "shadeId, shadeCode, and quantity > 0 are required" },
      { status: 400 },
    );
  }

  try {
    const itemId = await getEllfa270ItemId(supabase);
    const movement = await createMovement(supabase, {
      movementType,
      priceListItemId: itemId,
      shadeId,
      shadeCode,
      quantity,
      movementDate: String(body.movementDate ?? "").trim() || undefined,
      notes: String(body.notes ?? "").trim() || null,
      createdBy: profile.id,
    });
    return NextResponse.json({ movement });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create movement" },
      { status: 500 },
    );
  }
}
