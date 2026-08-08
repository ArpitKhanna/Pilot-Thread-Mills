import { NextResponse } from "next/server";
import {
  isInventoryAuthError,
  requireInventoryAccess,
} from "@/lib/inventory/access";
import { runEllfa270ReplenishmentCheck } from "@/lib/inventory/dyeing-suggestions";
import {
  getEllfa270ItemId,
  saveOpeningBalances,
} from "@/lib/inventory/queries";

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

  const rawEntries = Array.isArray(body.entries) ? body.entries : null;
  if (!rawEntries) {
    return NextResponse.json({ error: "entries array is required" }, { status: 400 });
  }

  const replaceExisting = Boolean(body.replaceExisting);
  const entries: Array<{ shadeId: string; shadeCode: string; quantity: number }> = [];

  for (const raw of rawEntries) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const shadeId = String(row.shadeId ?? "").trim();
    const shadeCode = String(row.shadeCode ?? "").trim();
    const quantity = Number(row.quantity);
    if (!shadeId || !shadeCode || quantity < 0 || Number.isNaN(quantity)) continue;
    entries.push({ shadeId, shadeCode, quantity });
  }

  try {
    const itemId = await getEllfa270ItemId(supabase);
    const saved = await saveOpeningBalances(
      supabase,
      itemId,
      entries,
      profile.id,
      replaceExisting,
    );
    const autoDyeingJobs = await runEllfa270ReplenishmentCheck(
      supabase,
      profile.id,
    );
    return NextResponse.json({ saved, autoDyeingJobs });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to save opening balances" },
      { status: 500 },
    );
  }
}
