import { NextResponse } from "next/server";
import {
  isInventoryAuthError,
  requireInventoryAccess,
} from "@/lib/inventory/access";
import { updateShadeThresholds } from "@/lib/inventory/queries";

export async function PATCH(request: Request) {
  const auth = await requireInventoryAccess();
  if (isInventoryAuthError(auth)) return auth.error;
  const { supabase } = auth;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawUpdates = Array.isArray(body.updates) ? body.updates : null;
  if (!rawUpdates || rawUpdates.length === 0) {
    return NextResponse.json({ error: "updates array is required" }, { status: 400 });
  }

  const updates = rawUpdates.map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      shadeId: String(row.shadeId ?? "").trim(),
      minStockThreshold:
        row.minStockThreshold === null || row.minStockThreshold === undefined
          ? undefined
          : Number(row.minStockThreshold),
      targetStockLevel:
        row.targetStockLevel === null || row.targetStockLevel === undefined
          ? undefined
          : Number(row.targetStockLevel),
    };
  });

  if (updates.some((u) => !u.shadeId)) {
    return NextResponse.json({ error: "Each update needs shadeId" }, { status: 400 });
  }

  try {
    await updateShadeThresholds(supabase, updates);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update thresholds" },
      { status: 500 },
    );
  }
}
