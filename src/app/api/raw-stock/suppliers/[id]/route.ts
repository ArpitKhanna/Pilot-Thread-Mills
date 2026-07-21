import { NextResponse } from "next/server";
import { requireRawStockAccess } from "@/lib/raw-stock/api-helpers";
import { updateSupplier } from "@/lib/raw-stock/queries";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireRawStockAccess();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase } = auth;
  const { id } = await params;

  const body = (await request.json()) as Record<string, unknown>;
  const patch: { name?: string; isActive?: boolean } = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) {
      return NextResponse.json(
        { error: "Supplier name is required" },
        { status: 400 },
      );
    }
    patch.name = name;
  }

  if (body.isActive !== undefined || body.is_active !== undefined) {
    patch.isActive = Boolean(body.isActive ?? body.is_active);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  try {
    const supplier = await updateSupplier(supabase, id, patch);
    return NextResponse.json({ supplier });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Failed to update supplier";
    const status = message.toLowerCase().includes("unique") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
