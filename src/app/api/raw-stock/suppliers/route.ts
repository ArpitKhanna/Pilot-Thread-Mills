import { NextResponse } from "next/server";
import { requireRawStockAccess } from "@/lib/raw-stock/api-helpers";
import { createSupplier, listSuppliers } from "@/lib/raw-stock/queries";

export async function GET() {
  const auth = await requireRawStockAccess();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase } = auth;

  try {
    const suppliers = await listSuppliers(supabase);
    return NextResponse.json({ suppliers });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list suppliers" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireRawStockAccess();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase } = auth;

  const body = (await request.json()) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Supplier name is required" }, { status: 400 });
  }

  const isActive =
    body.isActive === undefined && body.is_active === undefined
      ? true
      : Boolean(body.isActive ?? body.is_active);

  try {
    const supplier = await createSupplier(supabase, { name, isActive });
    return NextResponse.json({ supplier });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Failed to create supplier";
    const status = message.toLowerCase().includes("unique") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
