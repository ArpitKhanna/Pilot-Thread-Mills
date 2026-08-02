import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createAdvance,
  validateAdvancePayload,
} from "@/lib/salesmen/advances";
import { getInvoiceById, refreshSalesmanTotals } from "@/lib/salesmen/queries";
import type { InvoicePaymentMethod, SalesmanAdvance } from "@/lib/salesmen/types";
import {
  paymentVerificationFields,
  verificationForCreator,
  type VerificationInsert,
} from "@/lib/salesmen/verification";
import type { Profile } from "@/lib/auth/types";
import type { ReceiptWriteInput } from "./types";

const METHODS: InvoicePaymentMethod[] = ["cash", "cheque", "upi", "imps"];
const MISC_SOURCES = new Set(["chitfund", "mutual_fund", "other"]);

export function validateReceiptPayload(
  body: Record<string, unknown>,
): { data: ReceiptWriteInput } | { error: string } {
  const mode = body.mode === "invoice" ? "invoice" : "advance";
  const sourceCategory =
    body.sourceCategory === "chitfund" ||
    body.sourceCategory === "mutual_fund" ||
    body.sourceCategory === "other"
      ? body.sourceCategory
      : "party_payment";

  if (MISC_SOURCES.has(sourceCategory)) {
    const advanceValidated = validateAdvancePayload(body);
    if ("error" in advanceValidated) return advanceValidated;
    return {
      data: {
        mode: "advance",
        sourceCategory,
        method: advanceValidated.data.method,
        amount: advanceValidated.data.amount,
        chequeNumber: advanceValidated.data.chequeNumber,
        depositAccountId: advanceValidated.data.depositAccountId,
        senderName: advanceValidated.data.senderName,
        notes: advanceValidated.data.notes,
        receivedAt: advanceValidated.data.receivedAt,
      },
    };
  }

  const partyId = String(body.partyId ?? "").trim();
  if (!partyId) return { error: "Party is required" };

  if (mode === "invoice") {
    const invoiceId = String(body.invoiceId ?? "").trim();
    if (!invoiceId) return { error: "Invoice is required" };
    const method = body.method as InvoicePaymentMethod;
    const amount = Number(body.amount);
    if (!METHODS.includes(method)) return { error: "Invalid payment method" };
    if (!Number.isFinite(amount) || !(amount > 0)) {
      return { error: "Amount must be greater than 0" };
    }
    return {
      data: {
        mode: "invoice",
        partyId,
        invoiceId,
        sourceCategory: "party_payment",
        method,
        amount,
        chequeNumber: body.chequeNumber ? String(body.chequeNumber) : undefined,
        depositAccountId: body.depositAccountId
          ? String(body.depositAccountId)
          : undefined,
        senderName: body.senderName ? String(body.senderName) : undefined,
        notes: body.notes ? String(body.notes) : undefined,
        receivedAt: body.receivedAt ? String(body.receivedAt) : undefined,
      },
    };
  }

  const advanceValidated = validateAdvancePayload(body);
  if ("error" in advanceValidated) return advanceValidated;
  return {
    data: {
      mode: "advance",
      partyId,
      sourceCategory: "party_payment",
      ...advanceValidated.data,
    },
  };
}

export async function createLedgerReceipt(
  supabase: SupabaseClient,
  profile: Profile,
  input: ReceiptWriteInput,
): Promise<{ advance?: SalesmanAdvance; invoiceId?: string; paymentId?: string }> {
  const verification = verificationForCreator({
    id: profile.id,
    full_name: profile.full_name,
    role: profile.role,
  });

  if (input.mode === "invoice" && input.invoiceId && input.partyId) {
    return createInvoicePaymentFromLedger(
      supabase,
      input.partyId,
      input.invoiceId,
      input,
      verification,
    );
  }

  const isMisc = input.sourceCategory && MISC_SOURCES.has(input.sourceCategory);
  const partyId = isMisc ? null : input.partyId;
  if (!isMisc && !partyId) {
    throw new Error("Party is required");
  }

  const advanceInput = {
    method: input.method,
    amount: input.amount,
    chequeNumber: input.chequeNumber,
    depositAccountId: input.depositAccountId,
    senderName: input.senderName,
    notes: input.notes,
    receivedAt: input.receivedAt,
  };

  if (isMisc) {
    const { data, error } = await supabase
      .from("salesmen_advances")
      .insert({
        salesman_id: null,
        source_category: input.sourceCategory,
        method: advanceInput.method,
        amount: advanceInput.amount,
        remaining_amount: advanceInput.amount,
        cheque_number: advanceInput.chequeNumber ?? null,
        deposit_account_id: advanceInput.depositAccountId ?? null,
        sender_name: advanceInput.senderName ?? null,
        notes: advanceInput.notes ?? null,
        received_at: advanceInput.receivedAt ?? new Date().toISOString(),
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
      throw new Error(error?.message ?? "Failed to record receipt");
    }
    const { mapAdvanceRow } = await import("@/lib/salesmen/mappers");
    return { advance: mapAdvanceRow(data) };
  }

  const advance = await createAdvance(
    supabase,
    partyId!,
    advanceInput,
    verification,
  );
  return { advance };
}

async function createInvoicePaymentFromLedger(
  supabase: SupabaseClient,
  partyId: string,
  invoiceId: string,
  input: ReceiptWriteInput,
  verification: VerificationInsert,
): Promise<{ invoiceId: string; paymentId: string }> {
  const invoice = await getInvoiceById(supabase, invoiceId);
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.salesmanId !== partyId) {
    throw new Error("Invoice does not belong to this party");
  }

  const balanceDue = Math.max(
    0,
    Math.round((invoice.totalAmount - invoice.amountPaid) * 100) / 100,
  );
  if (input.amount > balanceDue + 0.001) {
    throw new Error(`Payment exceeds invoice balance (${balanceDue})`);
  }

  if (input.method === "cheque") {
    if (!input.chequeNumber?.trim()) throw new Error("Cheque number is required");
    if (!input.depositAccountId?.trim()) {
      throw new Error("Deposit account is required for cheque");
    }
  }
  if (
    (input.method === "upi" || input.method === "imps") &&
    !input.depositAccountId?.trim()
  ) {
    throw new Error("Deposit account is required for UPI / IMPS");
  }

  const receivedAt =
    input.method === "cash"
      ? new Date().toISOString()
      : input.receivedAt ?? new Date().toISOString();

  const { data: payment, error: payError } = await supabase
    .from("salesmen_invoice_payments")
    .insert({
      invoice_id: invoiceId,
      method: input.method,
      amount: input.amount,
      cheque_number: input.chequeNumber ?? null,
      deposit_account_id: input.depositAccountId ?? null,
      sender_name: input.senderName ?? null,
      sort_order: (invoice.paymentEntries?.length ?? 0),
      status: "active",
      received_at: receivedAt,
      ...paymentVerificationFields(verification),
    })
    .select("id")
    .single();

  if (payError || !payment) {
    throw new Error(payError?.message ?? "Failed to save payment");
  }

  const newAmountPaid = Math.round((invoice.amountPaid + input.amount) * 100) / 100;
  const { error: updError } = await supabase
    .from("salesmen_invoices")
    .update({ amount_paid: newAmountPaid })
    .eq("id", invoiceId);
  if (updError) throw new Error(updError.message);

  await refreshSalesmanTotals(supabase, partyId);
  return { invoiceId, paymentId: payment.id as string };
}

export async function listOpenInvoicesForParty(
  supabase: SupabaseClient,
  partyId: string,
): Promise<
  Array<{
    id: string;
    number: string;
    totalAmount: number;
    amountPaid: number;
    balanceDue: number;
    issuedAt: string;
  }>
> {
  const { data, error } = await supabase
    .from("salesmen_invoices")
    .select("id, number, total_amount, amount_paid, issued_at")
    .eq("salesman_id", partyId)
    .order("issued_at", { ascending: false });
  if (error) throw error;

  return (data ?? [])
    .map((row) => {
      const totalAmount = Number(row.total_amount);
      const amountPaid = Number(row.amount_paid);
      const balanceDue = Math.max(
        0,
        Math.round((totalAmount - amountPaid) * 100) / 100,
      );
      return {
        id: row.id as string,
        number: row.number as string,
        totalAmount,
        amountPaid,
        balanceDue,
        issuedAt: row.issued_at as string,
      };
    })
    .filter((inv) => inv.balanceDue > 0);
}
