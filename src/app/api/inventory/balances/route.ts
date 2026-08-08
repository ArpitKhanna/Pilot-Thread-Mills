import { NextResponse } from "next/server";
import {
  isInventoryAuthError,
  requireInventoryAccess,
} from "@/lib/inventory/access";
import {
  getEllfa270ItemId,
  getShadeBalancesForItem,
} from "@/lib/inventory/queries";

export async function GET() {
  const auth = await requireInventoryAccess();
  if (isInventoryAuthError(auth)) return auth.error;
  const { supabase } = auth;

  try {
    const itemId = await getEllfa270ItemId(supabase);
    const balances = await getShadeBalancesForItem(supabase, itemId);
    const summary = {
      totalSkus: balances.length,
      outOfStock: balances.filter((b) => b.outOfStock).length,
      belowThreshold: balances.filter((b) => b.belowThreshold).length,
      fastMovers: balances.filter((b) => b.velocityTier === "fast").length,
      totalOnHand: balances.reduce((sum, b) => sum + b.onHand, 0),
    };
    return NextResponse.json({ itemId, balances, summary });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load balances" },
      { status: 500 },
    );
  }
}
