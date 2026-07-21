import { NextResponse } from "next/server";
import {
  assertSufficientBalance,
  requireRawStockAccess,
  validateMovementPayload,
} from "@/lib/raw-stock/api-helpers";
import { createMovement, listMovements } from "@/lib/raw-stock/queries";

export async function GET() {
  const auth = await requireRawStockAccess();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase } = auth;

  try {
    const movements = await listMovements(supabase);
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
  const auth = await requireRawStockAccess();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase, profile } = auth;

  const body = (await request.json()) as Record<string, unknown>;
  const validated = validateMovementPayload(body);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const balanceCheck = await assertSufficientBalance(supabase, validated.data);
  if ("error" in balanceCheck) {
    return NextResponse.json({ error: balanceCheck.error }, { status: 400 });
  }

  // For receive, copy shade/customer from the dyed lot when not provided
  let payload = validated.data;
  if (payload.movementType === "receive_from_narela" && payload.relatedMovementId) {
    const movements = await listMovements(supabase);
    const lot = movements.find((m) => m.id === payload.relatedMovementId);
    if (lot) {
      payload = {
        ...payload,
        shadeId: payload.shadeId ?? lot.shadeId,
        shadeCodeText: payload.shadeCodeText ?? lot.shadeCodeText,
        colorLabel: payload.colorLabel ?? lot.colorLabel,
        customerId: payload.customerId ?? lot.customerId,
      };
    }
  }

  try {
    const movement = await createMovement(supabase, {
      ...payload,
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
