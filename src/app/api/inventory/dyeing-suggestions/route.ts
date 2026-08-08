import { NextResponse } from "next/server";
import {
  isInventoryAuthError,
  requireInventoryAccess,
} from "@/lib/inventory/access";
import {
  approveDyeingSuggestions,
  listDyeingSuggestions,
} from "@/lib/inventory/dyeing-suggestions";
import { getEllfa270ItemId } from "@/lib/inventory/queries";

export async function GET() {
  const auth = await requireInventoryAccess();
  if (isInventoryAuthError(auth)) return auth.error;
  const { supabase } = auth;

  try {
    const itemId = await getEllfa270ItemId(supabase);
    const suggestions = await listDyeingSuggestions(supabase, itemId);
    return NextResponse.json({ suggestions });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load suggestions" },
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

  const shadeIds = Array.isArray(body.shadeIds)
    ? body.shadeIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  if (shadeIds.length === 0) {
    return NextResponse.json({ error: "shadeIds array is required" }, { status: 400 });
  }

  try {
    const itemId = await getEllfa270ItemId(supabase);
    const created = await approveDyeingSuggestions(
      supabase,
      itemId,
      shadeIds,
      profile.id,
    );
    return NextResponse.json({ created });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to approve suggestions" },
      { status: 500 },
    );
  }
}
