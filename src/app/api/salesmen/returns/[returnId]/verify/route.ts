import { NextResponse } from "next/server";
import { mapReturnRow, type DbReturnLineRow, type DbReturnRow } from "@/lib/salesmen/mappers";
import { refreshSalesmanTotals } from "@/lib/salesmen/queries";
import { actorDisplayName } from "@/lib/salesmen/verification";
import { getAuthedProfile } from "@/lib/price-list/api-helpers";

type RouteContext = { params: Promise<{ returnId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase, profile } = auth;

  if (profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { returnId } = await context.params;
  const { data: row, error } = await supabase
    .from("salesmen_returns")
    .select("*")
    .eq("id", returnId)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Return not found" }, { status: 404 });
  }

  if (row.verification_status !== "pending_verification") {
    return NextResponse.json(
      { error: "Only returns pending verification can be reviewed" },
      { status: 400 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = String(body.action ?? "");
  if (action !== "approve" && action !== "send_back") {
    return NextResponse.json(
      { error: "action must be approve or send_back" },
      { status: 400 },
    );
  }

  const note =
    body.note != null && String(body.note).trim()
      ? String(body.note).trim()
      : null;
  const adminName = actorDisplayName({
    id: profile.id,
    full_name: profile.full_name,
    role: profile.role,
  });
  const now = new Date().toISOString();

  const patch =
    action === "approve"
      ? {
          verification_status: "verified" as const,
          verified_by: profile.id,
          verified_by_name: adminName,
          verified_at: now,
          verification_note: null,
        }
      : {
          verification_status: "needs_edit" as const,
          verified_by: null,
          verified_by_name: null,
          verified_at: null,
          verification_note: note,
        };

  const { data: updated, error: updError } = await supabase
    .from("salesmen_returns")
    .update(patch)
    .eq("id", returnId)
    .select("*")
    .single();
  if (updError || !updated) {
    return NextResponse.json(
      { error: updError?.message ?? "Failed to update return" },
      { status: 500 },
    );
  }

  const { data: lines } = await supabase
    .from("salesmen_return_lines")
    .select("*")
    .eq("return_id", returnId)
    .order("sort_order", { ascending: true });

  try {
    await refreshSalesmanTotals(supabase, updated.salesman_id as string);
  } catch (e) {
    console.error(e);
  }

  return NextResponse.json({
    return: mapReturnRow(
      updated as DbReturnRow,
      (lines ?? []) as DbReturnLineRow[],
    ),
  });
}
