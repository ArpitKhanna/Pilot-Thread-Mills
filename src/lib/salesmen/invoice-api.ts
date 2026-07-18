import type {
  Invoice,
  InvoiceLineItem,
  InvoicePaymentEntry,
  InvoicePaymentMethod,
} from "./types";

/** Invoices can only be edited within this window after generation */
export const INVOICE_EDIT_WINDOW_MS = 5 * 60 * 1000;

const METHODS: InvoicePaymentMethod[] = ["cash", "cheque", "upi", "imps"];

export type InvoiceWritePayload = {
  salesmanId: string;
  number?: string;
  issuedAt?: string;
  totalAmount: number;
  amountPaid: number;
  discountAmount?: number;
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
  invoice: Pick<Invoice, "issuedAt">,
  now: number = Date.now(),
): boolean {
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
  const totalSec = Math.ceil(remainingMs / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
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

  if (!Number.isFinite(totalAmount) || totalAmount < 0) {
    return { error: "Invalid total amount" };
  }
  if (!Number.isFinite(amountPaid) || amountPaid < 0) {
    return { error: "Invalid amount paid" };
  }
  if (!Number.isFinite(discountAmount) || discountAmount < 0) {
    return { error: "Invalid discount amount" };
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
      if (!String(row.depositAccountId ?? "").trim()) {
        return { error: "Cheque payments need a deposit account" };
      }
    }
    if (method === "upi" || method === "imps") {
      if (!String(row.senderName ?? "").trim()) {
        return { error: "UPI / IMPS payments need a sender name" };
      }
      if (!String(row.depositAccountId ?? "").trim()) {
        return { error: "UPI / IMPS payments need a deposit account" };
      }
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
      senderName: row.senderName ? String(row.senderName) : undefined,
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
  }));
  return [...purchase, ...returns];
}

export function paymentInserts(
  invoiceId: string,
  payload: InvoiceWritePayload,
) {
  return (payload.paymentEntries ?? []).map((payment, index) => ({
    invoice_id: invoiceId,
    method: payment.method,
    amount: payment.amount,
    cheque_number: payment.chequeNumber ?? null,
    deposit_account_id: payment.depositAccountId ?? null,
    sender_name: payment.senderName ?? null,
    sort_order: index,
  }));
}
