import { NextResponse } from "next/server";
import { mapAdvanceRow, type DbAdvanceRow } from "@/lib/salesmen/mappers";
import { refreshSalesmanTotals } from "@/lib/salesmen/queries";
import { actorDisplayName } from "@/lib/salesmen/verification";
import { getAuthedProfile } from "@/lib/price-list/api-helpers";

type RouteContext = { params: Promise<{ advanceId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase, profile } = auth;

  if (profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { advanceId } = await context.params;
  const { data: row, error } = await supabase
    .from("salesmen_advances")
    .select("*")
    .eq("id", advanceId)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Advance not found" }, { status: 404 });
  }

  if (row.verification_status !== "pending_verification") {
    return NextResponse.json(
      { error: "Only advances pending verification can be reviewed" },
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
    .from("salesmen_advances")
    .update(patch)
    .eq("id", advanceId)
    .select("*")
    .single();
  if (updError || !updated) {
    return NextResponse.json(
      { error: updError?.message ?? "Failed to update advance" },
      { status: 500 },
    );
  }

  try {
    await refreshSalesmanTotals(supabase, updated.salesman_id as string);
  } catch (e) {
    console.error(e);
  }

  return NextResponse.json({
    advance: mapAdvanceRow(updated as DbAdvanceRow),
  });
}
