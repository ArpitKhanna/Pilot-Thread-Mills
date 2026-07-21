import { NextResponse } from "next/server";
import { deriveBalances } from "@/lib/raw-stock/balance";
import { requireRawStockAccess } from "@/lib/raw-stock/api-helpers";
import {
  listCountOptions,
  listCustomerOptions,
  listMovements,
  listShadeOptions,
  listSuppliers,
} from "@/lib/raw-stock/queries";

export async function GET() {
  const auth = await requireRawStockAccess();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase } = auth;

  try {
    const [movements, suppliers, counts, customers, shades] = await Promise.all([
      listMovements(supabase),
      listSuppliers(supabase),
      listCountOptions(supabase),
      listCustomerOptions(supabase),
      listShadeOptions(supabase),
    ]);

    const balances = deriveBalances(movements);

    return NextResponse.json({
      movements,
      suppliers,
      counts,
      customers,
      shades,
      balances,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load raw stock data" },
      { status: 500 },
    );
  }
}
