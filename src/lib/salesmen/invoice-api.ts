import type {
  Invoice,
  InvoiceLineItem,
  InvoicePaymentEntry,
  InvoicePaymentMethod,
} from "./types";
import { parseBusinessReceivedAt } from "./record-window";

/** Invoices can only be edited within this window after generation */
export const INVOICE_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

const METHODS: InvoicePaymentMethod[] = ["cash", "cheque", "upi", "imps"];

export type InvoiceWritePayload = {
  salesmanId: string;
  number?: string;
  issuedAt?: string;
  totalAmount: number;
  amountPaid: number;
  discountAmount?: number;
  additionalAmount?: number;
  notes?: string;
  lineItems: InvoiceLineItem[];
  returnItems?: InvoiceLineItem[];
  paymentEntries?: InvoicePaymentEntry[];
};

export function canEditIssuedAt(
  issuedAt: string,
  now: number = Date.now(),
): boolean {
  const created = new Date(issuedAt).getTime();
  if (Number.isNaN(created)) return false;
  return now - created < INVOICE_EDIT_WINDOW_MS && now >= created;
}

export function canEditInvoice(
  invoice: Pick<Invoice, "issuedAt" | "verificationStatus">,
  now: number = Date.now(),
): boolean {
  if (
    invoice.verificationStatus === "needs_edit" ||
    invoice.verificationStatus === "pending_verification"
  ) {
    return true;
  }
  return canEditIssuedAt(invoice.issuedAt, now);
}

export function getInvoiceEditRemainingMs(
  invoice: Pick<Invoice, "issuedAt">,
  now: number = Date.now(),
): number {
  const created = new Date(invoice.issuedAt).getTime();
  if (Number.isNaN(created)) return 0;
  return Math.max(0, created + INVOICE_EDIT_WINDOW_MS - now);
}

export function formatEditCountdown(remainingMs: number): string {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function validateInvoicePayload(
  body: Record<string, unknown>,
): { data: InvoiceWritePayload } | { error: string } {
  const salesmanId = String(body.salesmanId ?? "").trim();
  if (!salesmanId) return { error: "Salesman is required" };

  const totalAmount = Number(body.totalAmount);
  const amountPaid = Number(body.amountPaid);
  const discountAmount = Number(body.discountAmount ?? 0);
  const additionalAmount = Number(body.additionalAmount ?? 0);

  if (!Number.isFinite(totalAmount) || totalAmount < 0) {
    return { error: "Invalid total amount" };
  }
  if (!Number.isFinite(amountPaid) || amountPaid < 0) {
    return { error: "Invalid amount paid" };
  }
  if (!Number.isFinite(discountAmount) || discountAmount < 0) {
    return { error: "Invalid discount amount" };
  }
  if (!Number.isFinite(additionalAmount) || additionalAmount < 0) {
    return { error: "Invalid additional amount" };
  }

  const rawLines = Array.isArray(body.lineItems) ? body.lineItems : [];
  if (rawLines.length === 0) {
    return { error: "At least one line item is required" };
  }

  const lineItems: InvoiceLineItem[] = [];
  for (const raw of rawLines) {
    if (!raw || typeof raw !== "object") {
      return { error: "Invalid line item" };
    }
    const row = raw as Record<string, unknown>;
    const name = String(row.name ?? "").trim();
    const qty = Number(row.qty);
    const unitPrice = Number(row.unitPrice);
    const amount = Number(row.amount);
    if (!name || !(qty > 0) || !(unitPrice >= 0) || !(amount >= 0)) {
      return { error: "Each line item needs name, qty, and price" };
    }
    lineItems.push({
      id: String(row.id ?? crypto.randomUUID()),
      name,
      qty,
      unitPrice,
      amount,
      priceListItemId: row.priceListItemId
        ? String(row.priceListItemId)
        : undefined,
    });
  }

  const returnItems: InvoiceLineItem[] = [];
  const rawReturns = Array.isArray(body.returnItems) ? body.returnItems : [];
  for (const raw of rawReturns) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const name = String(row.name ?? "").trim();
    const qty = Number(row.qty);
    const unitPrice = Number(row.unitPrice);
    const amount = Number(row.amount);
    if (!name || !(qty > 0)) continue;
    returnItems.push({
      id: String(row.id ?? crypto.randomUUID()),
      name,
      qty,
      unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
      amount: Number.isFinite(amount) ? amount : 0,
      priceListItemId: row.priceListItemId
        ? String(row.priceListItemId)
        : undefined,
      standAloneReturnId: row.standAloneReturnId
        ? String(row.standAloneReturnId)
        : undefined,
    });
  }

  const paymentEntries: InvoicePaymentEntry[] = [];
  const rawPayments = Array.isArray(body.paymentEntries)
    ? body.paymentEntries
    : [];
  for (const raw of rawPayments) {
    if (!raw || typeof raw !== "object") {
      return { error: "Invalid payment entry" };
    }
    const row = raw as Record<string, unknown>;
    const method = row.method as InvoicePaymentMethod;
    const amount = Number(row.amount);
    if (!METHODS.includes(method) || !(amount > 0)) {
      return { error: "Each payment needs a valid method and amount" };
    }
    if (method === "cheque") {
      if (!String(row.chequeNumber ?? "").trim()) {
        return { error: "Cheque payments need a cheque number" };
      }
      const depositAccountId = String(row.depositAccountId ?? "").trim();
      const depositAccountOther = String(row.depositAccountOther ?? "").trim();
      if (!depositAccountId && !depositAccountOther) {
        return { error: "Cheque payments need a deposit account" };
      }
    }
    if (method === "upi" || method === "imps") {
      const depositAccountId = String(row.depositAccountId ?? "").trim();
      const depositAccountOther = String(row.depositAccountOther ?? "").trim();
      if (!depositAccountId && !depositAccountOther) {
        return { error: "UPI / IMPS payments need a deposit account" };
      }
    }

    let receivedAt: string | undefined;
    if (method === "cash") {
      receivedAt = new Date().toISOString();
    } else if (row.receivedAt != null && String(row.receivedAt).trim()) {
      const parsed = parseBusinessReceivedAt(row.receivedAt);
      if ("error" in parsed) return parsed;
      receivedAt = parsed.iso;
    } else {
      receivedAt = new Date().toISOString();
    }

    paymentEntries.push({
      id: String(row.id ?? crypto.randomUUID()),
      method,
      amount,
      chequeNumber: row.chequeNumber
        ? String(row.chequeNumber)
        : undefined,
      depositAccountId: row.depositAccountId
        ? String(row.depositAccountId)
        : undefined,
      depositAccountOther: row.depositAccountOther
        ? String(row.depositAccountOther)
        : undefined,
      senderName: row.senderName ? String(row.senderName) : undefined,
      advanceId: row.advanceId ? String(row.advanceId) : undefined,
      receivedAt,
      status: row.status === "cancelled" ? "cancelled" : "active",
    });
  }

  return {
    data: {
      salesmanId,
      number: body.number ? String(body.number) : undefined,
      issuedAt: body.issuedAt ? String(body.issuedAt) : undefined,
      totalAmount,
      amountPaid,
      discountAmount,
      additionalAmount,
      notes: body.notes ? String(body.notes) : undefined,
      lineItems,
      returnItems: returnItems.length > 0 ? returnItems : undefined,
      paymentEntries:
        paymentEntries.length > 0 ? paymentEntries : undefined,
    },
  };
}

export function lineInserts(
  invoiceId: string,
  payload: InvoiceWritePayload,
) {
  const purchase = payload.lineItems.map((line, index) => ({
    invoice_id: invoiceId,
    name: line.name,
    qty: line.qty,
    unit_price: line.unitPrice,
    amount: line.amount,
    price_list_item_id: line.priceListItemId ?? null,
    is_return: false,
    sort_order: index,
  }));
  const returns = (payload.returnItems ?? []).map((line, index) => ({
    invoice_id: invoiceId,
    name: line.name,
    qty: line.qty,
    unit_price: line.unitPrice,
    amount: line.amount,
    price_list_item_id: line.priceListItemId ?? null,
    is_return: true,
    sort_order: index,
    stand_alone_return_id: line.standAloneReturnId ?? null,
  }));
  return [...purchase, ...returns];
}

export function paymentInserts(
  invoiceId: string,
  payload: InvoiceWritePayload,
  verification?: {
    verification_status: string;
    created_by: string | null;
    created_by_name: string | null;
    verified_by: string | null;
    verified_by_name: string | null;
    verified_at: string | null;
  },
) {
  return (payload.paymentEntries ?? []).map((payment, index) => ({
    invoice_id: invoiceId,
    method: payment.method,
    amount: payment.amount,
    cheque_number: payment.chequeNumber ?? null,
    deposit_account_id: payment.depositAccountId ?? null,
    deposit_account_other: payment.depositAccountOther?.trim()
      ? payment.depositAccountOther.trim()
      : null,
    sender_name: payment.senderName ?? null,
    sort_order: index,
    status: payment.status === "cancelled" ? "cancelled" : "active",
    advance_id: payment.advanceId ?? null,
    received_at: payment.receivedAt ?? new Date().toISOString(),
    ...(verification
      ? {
          verification_status: verification.verification_status,
          created_by: verification.created_by,
          created_by_name: verification.created_by_name,
          verified_by: verification.verified_by,
          verified_by_name: verification.verified_by_name,
          verified_at: verification.verified_at,
        }
      : {}),
  }));
}
