import { NextResponse } from "next/server";
import { getInvoiceById, refreshSalesmanTotals } from "@/lib/salesmen/queries";
import { getAuthedProfile } from "@/lib/price-list/api-helpers";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase, profile } = auth;

  if (profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await getInvoiceById(supabase, id);
  if (!existing) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (existing.verificationStatus !== "pending_verification") {
    return NextResponse.json(
      { error: "Only invoices pending verification can be reviewed" },
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
  const adminName = profile.full_name?.trim() || "Admin";
  const now = new Date().toISOString();

  const invoicePatch =
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

  const paymentPatch =
    action === "approve"
      ? {
          verification_status: "verified" as const,
          verified_by: profile.id,
          verified_by_name: adminName,
          verified_at: now,
        }
      : {
          verification_status: "needs_edit" as const,
          verified_by: null,
          verified_by_name: null,
          verified_at: null,
        };

  const { error: updateError } = await supabase
    .from("salesmen_invoices")
    .update(invoicePatch)
    .eq("id", id);

  if (updateError) {
    console.error(updateError);
    return NextResponse.json(
      { error: "Failed to update invoice verification" },
      { status: 500 },
    );
  }

  const { error: payError } = await supabase
    .from("salesmen_invoice_payments")
    .update(paymentPatch)
    .eq("invoice_id", id);

  if (payError) {
    console.error(payError);
    return NextResponse.json(
      { error: "Failed to update payment verification" },
      { status: 500 },
    );
  }

  try {
    await refreshSalesmanTotals(supabase, existing.salesmanId);
  } catch (e) {
    console.error(e);
  }

  const invoice = await getInvoiceById(supabase, id);
  return NextResponse.json({ invoice, action });
}
