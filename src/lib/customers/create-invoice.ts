import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/auth/types";
import { consumeAdvanceRemainingFromPayments } from "@/lib/salesmen/advances";
import { consumeReturnRemainingFromInvoiceLines } from "@/lib/salesmen/returns";
import {
  lineInserts,
  paymentInserts,
  type InvoiceWritePayload,
} from "@/lib/salesmen/invoice-api";
import { getInvoiceById, getSalesman, refreshSalesmanTotals } from "@/lib/salesmen/queries";
import {
  paymentVerificationFields,
  verificationForCreator,
} from "@/lib/salesmen/verification";

export async function createDirectCustomerInvoice(
  supabase: SupabaseClient,
  profile: Profile,
  customerId: string,
  payload: InvoiceWritePayload,
) {
  const customer = await getSalesman(supabase, customerId);
  if (!customer || customer.entityType !== "customer") {
    throw new Error("Customer not found");
  }

  const number = payload.number?.trim() || `INV-CU-${Date.now()}`;
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
      salesman_id: customerId,
      issued_at: issuedAt,
      item_count: payload.lineItems.length,
      total_amount: payload.totalAmount,
      amount_paid: payload.amountPaid,
      discount_amount: payload.discountAmount ?? 0,
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
    throw new Error(insertError?.message ?? "Failed to create invoice");
  }

  const lines = lineInserts(invoiceRow.id, payload);
  if (lines.length > 0) {
    const consumeReturns = await consumeReturnRemainingFromInvoiceLines(
      supabase,
      payload.returnItems ?? [],
    );
    if (consumeReturns.error) {
      await supabase.from("salesmen_invoices").delete().eq("id", invoiceRow.id);
      throw new Error(consumeReturns.error);
    }

    const { error: linesError } = await supabase
      .from("salesmen_invoice_lines")
      .insert(lines);
    if (linesError) {
      await supabase.from("salesmen_invoices").delete().eq("id", invoiceRow.id);
      throw new Error("Failed to save invoice lines");
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
      throw new Error(consume.error);
    }

    const { error: payError } = await supabase
      .from("salesmen_invoice_payments")
      .insert(payments);
    if (payError) {
      await supabase.from("salesmen_invoices").delete().eq("id", invoiceRow.id);
      throw new Error("Failed to save payments");
    }
  }

  try {
    await refreshSalesmanTotals(supabase, customerId);
  } catch (e) {
    console.error(e);
  }

  const invoice = await getInvoiceById(supabase, invoiceRow.id);
  if (!invoice) {
    throw new Error("Invoice created but could not be loaded");
  }
  return invoice;
}
