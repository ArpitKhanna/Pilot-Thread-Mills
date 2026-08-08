import { NextResponse } from "next/server";
import {
  isInventoryAuthError,
  requireInventoryOrOrderAccess,
} from "@/lib/inventory/access";
import {
  getAvailableStockForLines,
  packOrderWithFulfillment,
  unpackOrder,
} from "@/lib/inventory/pack-order";
import type { PackOrderLineInput } from "@/lib/inventory/types";

export async function GET(request: Request) {
  const auth = await requireInventoryOrOrderAccess();
  if (isInventoryAuthError(auth)) return auth.error;
  const { supabase } = auth;

  const { searchParams } = new URL(request.url);
  const lineIds = searchParams.get("lineIds")?.split(",").filter(Boolean) ?? [];
  if (lineIds.length === 0) {
    return NextResponse.json({ error: "lineIds query param required" }, { status: 400 });
  }

  try {
    const available = await getAvailableStockForLines(supabase, lineIds);
    return NextResponse.json({
      available: Object.fromEntries(available),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load availability" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireInventoryOrOrderAccess();
  if (isInventoryAuthError(auth)) return auth.error;
  const { supabase, profile } = auth;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderId = String(body.orderId ?? "").trim();
  const action = String(body.action ?? "pack").trim();

  if (!orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }

  try {
    if (action === "unpack") {
      await unpackOrder(supabase, orderId, profile.id);
      return NextResponse.json({ ok: true });
    }

    const rawLines = Array.isArray(body.lines) ? body.lines : null;
    if (!rawLines) {
      return NextResponse.json({ error: "lines array is required" }, { status: 400 });
    }

    const lines: PackOrderLineInput[] = rawLines.map((raw) => {
      const row = raw as Record<string, unknown>;
      return {
        lineId: String(row.lineId ?? "").trim(),
        fulfilledQty: Number(row.fulfilledQty),
      };
    });

    if (lines.some((l) => !l.lineId || l.fulfilledQty < 0 || Number.isNaN(l.fulfilledQty))) {
      return NextResponse.json({ error: "Invalid line data" }, { status: 400 });
    }

    const result = await packOrderWithFulfillment(
      supabase,
      orderId,
      lines,
      profile.id,
    );
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to pack order" },
      { status: 500 },
    );
  }
}
