import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapAdvanceRow,
  type DbAdvanceRow,
} from "./mappers";
import type {
  InvoicePaymentEntry,
  InvoicePaymentMethod,
  SalesmanAdvance,
} from "./types";
import { refreshSalesmanTotals } from "./queries";
import { canMutateWithinWindow, parseBusinessReceivedAt } from "./record-window";
import type { VerificationInsert } from "./verification";

export { buildAutoAppliedAdvancePayments } from "./advance-apply";

const METHODS: InvoicePaymentMethod[] = ["cash", "cheque", "upi", "imps"];

export async function listAdvancesForSalesman(
  supabase: SupabaseClient,
  salesmanId: string,
): Promise<SalesmanAdvance[]> {
  const { data, error } = await supabase
    .from("salesmen_advances")
    .select("*")
    .eq("salesman_id", salesmanId)
    .order("received_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as DbAdvanceRow[]).map(mapAdvanceRow);
}

/** Verified, active advances with remaining credit available to apply */
export async function listOpenAdvancesForSalesman(
  supabase: SupabaseClient,
  salesmanId: string,
): Promise<SalesmanAdvance[]> {
  const { data, error } = await supabase
    .from("salesmen_advances")
    .select("*")
    .eq("salesman_id", salesmanId)
    .eq("status", "active")
    .eq("verification_status", "verified")
    .gt("remaining_amount", 0)
    .order("received_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as DbAdvanceRow[]).map(mapAdvanceRow);
}

export type PendingAdvanceApproval = {
  advance: SalesmanAdvance;
  salesmanName: string;
  salesmanId: string;
};

export async function listPendingAdvanceApprovals(
  supabase: SupabaseClient,
): Promise<PendingAdvanceApproval[]> {
  const { data, error } = await supabase
    .from("salesmen_advances")
    .select("*")
    .eq("verification_status", "pending_verification")
    .eq("status", "active")
    .order("received_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as DbAdvanceRow[];
  if (rows.length === 0) return [];

  const advances = rows.map(mapAdvanceRow);
  const salesmanIds = [...new Set(advances.map((a) => a.salesmanId))];
  const { data: salesmenRows, error: salesmenError } = await supabase
    .from("salesmen")
    .select("id, name")
    .in("id", salesmanIds);
  if (salesmenError) throw salesmenError;

  const nameById = new Map(
    (salesmenRows ?? []).map((s) => [s.id as string, s.name as string]),
  );

  return advances.map((advance) => ({
    advance,
    salesmanId: advance.salesmanId,
    salesmanName: nameById.get(advance.salesmanId) ?? "Unknown",
  }));
}

export type AdvanceWriteInput = {
  method: InvoicePaymentMethod;
  amount: number;
  chequeNumber?: string;
  depositAccountId?: string;
  senderName?: string;
  notes?: string;
  receivedAt?: string;
};

export function validateAdvancePayload(
  body: Record<string, unknown>,
): { data: AdvanceWriteInput } | { error: string } {
  const method = body.method as InvoicePaymentMethod;
  const amount = Number(body.amount);
  if (!METHODS.includes(method)) {
    return { error: "Invalid payment method" };
  }
  if (!Number.isFinite(amount) || !(amount > 0)) {
    return { error: "Amount must be greater than 0" };
  }
  if (method === "cheque") {
    if (!String(body.chequeNumber ?? "").trim()) {
      return { error: "Cheque number is required" };
    }
    if (!String(body.depositAccountId ?? "").trim()) {
      return { error: "Deposit account is required for cheque" };
    }
  }
  if (method === "upi" || method === "imps") {
    if (!String(body.depositAccountId ?? "").trim()) {
      return { error: "Deposit account is required for UPI / IMPS" };
    }
  }

  let receivedAt: string | undefined;
  if (method === "cash") {
    receivedAt = undefined; // server uses now()
  } else if (body.receivedAt != null && String(body.receivedAt).trim()) {
    const parsed = parseBusinessReceivedAt(body.receivedAt);
    if ("error" in parsed) return parsed;
    receivedAt = parsed.iso;
  }

  return {
    data: {
      method,
      amount,
      chequeNumber: body.chequeNumber
        ? String(body.chequeNumber)
        : undefined,
      depositAccountId: body.depositAccountId
        ? String(body.depositAccountId)
        : undefined,
      senderName: body.senderName ? String(body.senderName) : undefined,
      notes: body.notes ? String(body.notes) : undefined,
      receivedAt,
    },
  };
}

export async function createAdvance(
  supabase: SupabaseClient,
  salesmanId: string,
  input: AdvanceWriteInput,
  verification: VerificationInsert,
): Promise<SalesmanAdvance> {
  const { data, error } = await supabase
    .from("salesmen_advances")
    .insert({
      salesman_id: salesmanId,
      method: input.method,
      amount: input.amount,
      remaining_amount: input.amount,
      cheque_number: input.chequeNumber ?? null,
      deposit_account_id: input.depositAccountId ?? null,
      sender_name: input.senderName ?? null,
      notes: input.notes ?? null,
      received_at: input.receivedAt ?? new Date().toISOString(),
      status: "active",
      verification_status: verification.verification_status,
      created_by: verification.created_by,
      created_by_name: verification.created_by_name,
      verified_by: verification.verified_by,
      verified_by_name: verification.verified_by_name,
      verified_at: verification.verified_at,
      verification_note: verification.verification_note,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create advance");
  }
  if (salesmanId) {
    await refreshSalesmanTotals(supabase, salesmanId);
  }
  return mapAdvanceRow(data as DbAdvanceRow);
}

/**
 * Restore remaining on advances linked to payment rows, then delete-safe.
 * Call before replacing invoice payments on edit.
 */
export async function restoreAdvanceRemainingFromPayments(
  supabase: SupabaseClient,
  payments: Array<{ advance_id?: string | null; amount: number | string; status?: string | null }>,
): Promise<void> {
  const byAdvance = new Map<string, number>();
  for (const p of payments) {
    if (!p.advance_id) continue;
    if (p.status === "cancelled") continue;
    const amt = Number(p.amount);
    if (!(amt > 0)) continue;
    byAdvance.set(p.advance_id, (byAdvance.get(p.advance_id) ?? 0) + amt);
  }
  for (const [advanceId, amount] of byAdvance) {
    const { data, error } = await supabase
      .from("salesmen_advances")
      .select("remaining_amount, amount")
      .eq("id", advanceId)
      .maybeSingle();
    if (error) throw error;
    if (!data) continue;
    const next = Math.min(
      Number(data.amount),
      Math.round((Number(data.remaining_amount) + amount) * 100) / 100,
    );
    const { error: updError } = await supabase
      .from("salesmen_advances")
      .update({ remaining_amount: next })
      .eq("id", advanceId);
    if (updError) throw updError;
  }
}

/**
 * Decrement remaining on advances for newly applied payment entries.
 */
export async function consumeAdvanceRemainingFromPayments(
  supabase: SupabaseClient,
  payments: InvoicePaymentEntry[],
): Promise<{ error?: string }> {
  const byAdvance = new Map<string, number>();
  for (const p of payments) {
    if (!p.advanceId || p.status === "cancelled") continue;
    if (!(p.amount > 0)) continue;
    byAdvance.set(p.advanceId, (byAdvance.get(p.advanceId) ?? 0) + p.amount);
  }

  for (const [advanceId, amount] of byAdvance) {
    const { data, error } = await supabase
      .from("salesmen_advances")
      .select("remaining_amount, status, verification_status")
      .eq("id", advanceId)
      .maybeSingle();
    if (error) return { error: error.message };
    if (!data) return { error: "Advance not found" };
    if (data.status !== "active") {
      return { error: "Cannot apply a cancelled advance" };
    }
    if (data.verification_status !== "verified") {
      return { error: "Advance must be verified before applying" };
    }
    const remaining = Number(data.remaining_amount);
    if (amount > remaining + 0.001) {
      return {
        error: `Applied advance exceeds remaining credit (${remaining})`,
      };
    }
    const next = Math.max(
      0,
      Math.round((remaining - amount) * 100) / 100,
    );
    const { error: updError } = await supabase
      .from("salesmen_advances")
      .update({ remaining_amount: next })
      .eq("id", advanceId);
    if (updError) return { error: updError.message };
  }
  return {};
}

export async function cancelAdvanceCheque(
  supabase: SupabaseClient,
  advanceId: string,
  actor: { id: string; name: string },
  reason?: string,
): Promise<SalesmanAdvance> {
  const { data: row, error } = await supabase
    .from("salesmen_advances")
    .select("*")
    .eq("id", advanceId)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new Error("Advance not found");
  const advance = mapAdvanceRow(row as DbAdvanceRow);
  if (advance.method !== "cheque") {
    throw new Error("Only cheque advances can be cancelled this way");
  }
  if (advance.status === "cancelled") {
    throw new Error("Cheque is already cancelled");
  }

  const { data: updated, error: updError } = await supabase
    .from("salesmen_advances")
    .update({
      status: "cancelled",
      remaining_amount: 0,
      cancelled_at: new Date().toISOString(),
      cancelled_by: actor.id,
      cancelled_by_name: actor.name,
      cancel_reason: reason?.trim() || null,
    })
    .eq("id", advanceId)
    .select("*")
    .single();
  if (updError || !updated) {
    throw new Error(updError?.message ?? "Failed to cancel cheque");
  }
  if (advance.salesmanId) {
    await refreshSalesmanTotals(supabase, advance.salesmanId);
  }
  return mapAdvanceRow(updated as DbAdvanceRow);
}

export async function cancelInvoicePaymentCheque(
  supabase: SupabaseClient,
  paymentId: string,
  actor: { id: string; name: string },
  reason?: string,
): Promise<{ salesmanId: string; invoiceId: string }> {
  const { data: payment, error } = await supabase
    .from("salesmen_invoice_payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();
  if (error) throw error;
  if (!payment) throw new Error("Payment not found");
  if (payment.method !== "cheque") {
    throw new Error("Only cheque payments can be cancelled this way");
  }
  if (payment.status === "cancelled") {
    throw new Error("Cheque is already cancelled");
  }

  const invoiceId = payment.invoice_id as string;
  const { data: invoice, error: invError } = await supabase
    .from("salesmen_invoices")
    .select("id, salesman_id, amount_paid")
    .eq("id", invoiceId)
    .maybeSingle();
  if (invError) throw invError;
  if (!invoice) throw new Error("Invoice not found");

  const { error: cancelError } = await supabase
    .from("salesmen_invoice_payments")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: actor.id,
      cancelled_by_name: actor.name,
      cancel_reason: reason?.trim() || null,
    })
    .eq("id", paymentId);
  if (cancelError) throw cancelError;

  const { data: activePays, error: listError } = await supabase
    .from("salesmen_invoice_payments")
    .select("amount")
    .eq("invoice_id", invoiceId)
    .eq("status", "active");
  if (listError) throw listError;

  const amountPaid = Math.round(
    (activePays ?? []).reduce((s, p) => s + Number(p.amount), 0) * 100,
  ) / 100;

  const { error: updInvError } = await supabase
    .from("salesmen_invoices")
    .update({ amount_paid: amountPaid })
    .eq("id", invoiceId);
  if (updInvError) throw updInvError;

  const salesmanId = invoice.salesman_id as string;
  await refreshSalesmanTotals(supabase, salesmanId);
  return { salesmanId, invoiceId };
}

export async function deleteAdvance(
  supabase: SupabaseClient,
  advanceId: string,
): Promise<{ salesmanId: string }> {
  const { data: row, error } = await supabase
    .from("salesmen_advances")
    .select("*")
    .eq("id", advanceId)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new Error("Advance not found");

  const advance = mapAdvanceRow(row as DbAdvanceRow);
  if (!canMutateWithinWindow(advance.createdAt)) {
    throw new Error(
      "This payment can no longer be deleted. Changes are only allowed within 1 day of recording.",
    );
  }
  if (
    Math.round(advance.remainingAmount * 100) !==
    Math.round(advance.amount * 100)
  ) {
    throw new Error(
      "Cannot delete an advance that has already been applied to an invoice. Remove it from the invoice first.",
    );
  }
  if (advance.status === "cancelled") {
    throw new Error("Advance is already cancelled");
  }

  const { error: delError } = await supabase
    .from("salesmen_advances")
    .delete()
    .eq("id", advanceId);
  if (delError) throw delError;

  if (advance.salesmanId) {
    await refreshSalesmanTotals(supabase, advance.salesmanId);
  }
  return { salesmanId: advance.salesmanId };
}
