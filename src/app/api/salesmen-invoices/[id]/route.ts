import { NextResponse } from "next/server";
import {
  canEditIssuedAt,
  lineInserts,
  paymentInserts,
  validateInvoicePayload,
} from "@/lib/salesmen/invoice-api";
import { getInvoiceById, refreshSalesmanTotals } from "@/lib/salesmen/queries";
import { getAuthedProfile } from "@/lib/price-list/api-helpers";

type RouteContext = { params: Promise<{ id: string }> };

async function hasOrderSalesmenAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  role: string | null,
) {
  if (role === "admin") return true;
  const { data } = await supabase
    .from("role_module_access")
    .select("module_id")
    .eq("role", role ?? "picker")
    .eq("module_id", "order-salesmen")
    .maybeSingle();
  return Boolean(data);
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase, profile } = auth;

  const { data: modules } = await supabase
    .from("role_module_access")
    .select("module_id")
    .eq("role", profile.role ?? "picker");
  const allowed = new Set((modules ?? []).map((m) => m.module_id));
  if (
    profile.role !== "admin" &&
    !allowed.has("order-salesmen") &&
    !allowed.has("entity-salesmen")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const invoice = await getInvoiceById(supabase, id);
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  return NextResponse.json({ invoice });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase, profile } = auth;

  if (!(await hasOrderSalesmenAccess(supabase, profile.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await getInvoiceById(supabase, id);
  if (!existing) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (!canEditIssuedAt(existing.issuedAt)) {
    return NextResponse.json(
      {
        error:
          "This invoice can no longer be edited. Changes are only allowed within 5 minutes of generation.",
      },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validated = validateInvoicePayload(body);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const payload = validated.data;

  // Keep original salesman + issuedAt; number stays the same
  const salesmanId = existing.salesmanId;

  const { error: updateError } = await supabase
    .from("salesmen_invoices")
    .update({
      item_count: payload.lineItems.length,
      total_amount: payload.totalAmount,
      amount_paid: payload.amountPaid,
      discount_amount: payload.discountAmount ?? 0,
      notes: payload.notes ?? null,
    })
    .eq("id", id);

  if (updateError) {
    console.error(updateError);
    return NextResponse.json(
      { error: "Failed to update invoice" },
      { status: 500 },
    );
  }

  const { error: deleteLinesError } = await supabase
    .from("salesmen_invoice_lines")
    .delete()
    .eq("invoice_id", id);
  if (deleteLinesError) {
    console.error(deleteLinesError);
    return NextResponse.json(
      { error: "Failed to replace invoice lines" },
      { status: 500 },
    );
  }

  const { error: deletePayError } = await supabase
    .from("salesmen_invoice_payments")
    .delete()
    .eq("invoice_id", id);
  if (deletePayError) {
    console.error(deletePayError);
    return NextResponse.json(
      { error: "Failed to replace payments" },
      { status: 500 },
    );
  }

  const lines = lineInserts(id, { ...payload, salesmanId });
  if (lines.length > 0) {
    const { error: linesError } = await supabase
      .from("salesmen_invoice_lines")
      .insert(lines);
    if (linesError) {
      console.error(linesError);
      return NextResponse.json(
        { error: "Failed to save invoice lines" },
        { status: 500 },
      );
    }
  }

  const payments = paymentInserts(id, { ...payload, salesmanId });
  if (payments.length > 0) {
    const { error: payError } = await supabase
      .from("salesmen_invoice_payments")
      .insert(payments);
    if (payError) {
      console.error(payError);
      return NextResponse.json(
        { error: "Failed to save payments" },
        { status: 500 },
      );
    }
  }

  try {
    await refreshSalesmanTotals(supabase, salesmanId);
    if (payload.salesmanId !== salesmanId) {
      await refreshSalesmanTotals(supabase, payload.salesmanId);
    }
  } catch (e) {
    console.error(e);
  }

  const invoice = await getInvoiceById(supabase, id);
  return NextResponse.json({ invoice });
}
