import type { InvoicePaymentMethod } from "@/lib/salesmen/types";

export type PaymentBucket = "cash" | "cheque" | "bank";

export const PAYMENT_BUCKET_LABELS: Record<PaymentBucket, string> = {
  cash: "Cash",
  cheque: "Cheque",
  bank: "Bank",
};

export function methodToBucket(method: InvoicePaymentMethod): PaymentBucket {
  if (method === "cash") return "cash";
  if (method === "cheque") return "cheque";
  return "bank";
}

export type DivisionMethod = "cash" | "upi" | "cheque";

export const DIVISION_LABELS: Record<DivisionMethod, string> = {
  cash: "Cash",
  upi: "UPI",
  cheque: "Cheque",
};

export function methodToDivision(method: InvoicePaymentMethod): DivisionMethod {
  if (method === "cash") return "cash";
  if (method === "cheque") return "cheque";
  return "upi";
}

export function computeDivisionBreakdown(
  receipts: Array<{ amount: number; method: InvoicePaymentMethod }>,
  expenses: Array<{ amount: number; method: InvoicePaymentMethod }>,
): Record<DivisionMethod, number> {
  const breakdown: Record<DivisionMethod, number> = {
    cash: 0,
    upi: 0,
    cheque: 0,
  };

  for (const item of receipts) {
    const division = methodToDivision(item.method);
    breakdown[division] =
      Math.round((breakdown[division] + item.amount) * 100) / 100;
  }

  for (const item of expenses) {
    const division = methodToDivision(item.method);
    breakdown[division] =
      Math.round((breakdown[division] - item.amount) * 100) / 100;
  }

  return breakdown;
}

export function computeBucketBreakdown(
  items: Array<{ amount: number; method: InvoicePaymentMethod }>,
  options?: { positiveOnly?: boolean },
): Record<PaymentBucket, number> {
  const breakdown: Record<PaymentBucket, number> = {
    cash: 0,
    cheque: 0,
    bank: 0,
  };

  for (const item of items) {
    if (options?.positiveOnly && item.amount <= 0) continue;
    const amount = Math.abs(item.amount);
    const bucket = methodToBucket(item.method);
    breakdown[bucket] = Math.round((breakdown[bucket] + amount) * 100) / 100;
  }

  return breakdown;
}
