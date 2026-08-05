import { NextResponse } from "next/server";
import {
  assertSufficientBalance,
  assertSufficientBalancesForBatch,
  requireRawStockAccess,
  validateBatchMovementPayload,
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

  if (Array.isArray(body.entries)) {
    const validated = validateBatchMovementPayload(body);
    if ("error" in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const balanceCheck = await assertSufficientBalancesForBatch(
      supabase,
      validated.data,
    );
    if ("error" in balanceCheck) {
      return NextResponse.json({ error: balanceCheck.error }, { status: 400 });
    }

    try {
      const movements = [];
      for (const entry of validated.data.entries) {
        const movement = await createMovement(supabase, {
          movementType: validated.data.movementType,
          category: entry.category,
          countLabel: entry.countLabel,
          quantityKg: entry.quantityKg,
          movementDate: validated.data.movementDate,
          supplierId: validated.data.supplierId,
          doNumber: validated.data.doNumber,
          notes: validated.data.notes,
          createdBy: profile.id,
        });
        movements.push(movement);
      }
      return NextResponse.json({ movements });
    } catch (e) {
      console.error(e);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Failed to create movements" },
        { status: 500 },
      );
    }
  }

  const validated = validateMovementPayload(body);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const balanceCheck = await assertSufficientBalance(supabase, validated.data);
  if ("error" in balanceCheck) {
    return NextResponse.json({ error: balanceCheck.error }, { status: 400 });
  }

  try {
    const movement = await createMovement(supabase, {
      ...validated.data,
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
