import { NextResponse } from "next/server";
import {
  consumeAdvanceRemainingFromPayments,
} from "@/lib/salesmen/advances";
import {
  prepareInvoiceReturnItems,
} from "@/lib/salesmen/returns";
import {
  lineInserts,
  paymentInserts,
  validateInvoicePayload,
} from "@/lib/salesmen/invoice-api";
import { getInvoiceById, refreshSalesmanTotals } from "@/lib/salesmen/queries";
import {
  paymentVerificationFields,
  verificationForCreator,
} from "@/lib/salesmen/verification";
import { getAuthedProfile } from "@/lib/price-list/api-helpers";

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

export async function POST(request: Request) {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase, profile } = auth;

  if (!(await hasOrderSalesmenAccess(supabase, profile.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  const number = payload.number?.trim() || `INV-SM-${Date.now()}`;
  const issuedAt = payload.issuedAt ?? new Date().toISOString();
  const verification = verificationForCreator({
    id: profile.id,
    full_name: profile.full_name,
    role: profile.role,
  });

  const { data: invoiceRow, error: insertError } = await supabase
    .from("salesmen_invoices")
    .insert({
      number,
      salesman_id: payload.salesmanId,
      issued_at: issuedAt,
      item_count: payload.lineItems.length,
      total_amount: payload.totalAmount,
      amount_paid: payload.amountPaid,
      discount_amount: payload.discountAmount ?? 0,
      additional_amount: payload.additionalAmount ?? 0,
      notes: payload.notes ?? null,
      created_by: verification.created_by,
      created_by_name: verification.created_by_name,
      verification_status: verification.verification_status,
      verified_by: verification.verified_by,
      verified_by_name: verification.verified_by_name,
      verified_at: verification.verified_at,
      verification_note: verification.verification_note,
    })
    .select("*")
    .single();

  if (insertError || !invoiceRow) {
    console.error(insertError);
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create invoice" },
      { status: 500 },
    );
  }

  const preparedReturns = await prepareInvoiceReturnItems(
    supabase,
    payload.salesmanId,
    payload.returnItems,
    verification,
    issuedAt,
    number,
  );
  if (preparedReturns.error) {
    await supabase.from("salesmen_invoices").delete().eq("id", invoiceRow.id);
    return NextResponse.json({ error: preparedReturns.error }, { status: 400 });
  }
  payload.returnItems =
    preparedReturns.items.length > 0 ? preparedReturns.items : undefined;

  const lines = lineInserts(invoiceRow.id, payload);
  if (lines.length > 0) {
    const { error: linesError } = await supabase
      .from("salesmen_invoice_lines")
      .insert(lines);
    if (linesError) {
      console.error(linesError);
      await supabase.from("salesmen_invoices").delete().eq("id", invoiceRow.id);
      return NextResponse.json(
        { error: "Failed to save invoice lines" },
        { status: 500 },
      );
    }
  }

  const payments = paymentInserts(
    invoiceRow.id,
    payload,
    paymentVerificationFields(verification),
  );
  if (payments.length > 0) {
    const consume = await consumeAdvanceRemainingFromPayments(
      supabase,
      payload.paymentEntries ?? [],
    );
    if (consume.error) {
      await supabase.from("salesmen_invoices").delete().eq("id", invoiceRow.id);
      return NextResponse.json({ error: consume.error }, { status: 400 });
    }

    const { error: payError } = await supabase
      .from("salesmen_invoice_payments")
      .insert(payments);
    if (payError) {
      console.error(payError);
      await supabase.from("salesmen_invoices").delete().eq("id", invoiceRow.id);
      return NextResponse.json(
        { error: "Failed to save payments" },
        { status: 500 },
      );
    }
  }

  try {
    await refreshSalesmanTotals(supabase, payload.salesmanId);
  } catch (e) {
    console.error(e);
  }

  const invoice = await getInvoiceById(supabase, invoiceRow.id);
  return NextResponse.json({ invoice }, { status: 201 });
}
