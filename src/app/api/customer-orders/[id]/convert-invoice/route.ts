import { NextResponse } from "next/server";
import {
  isAuthError,
  requireOrderCustomersAccess,
} from "@/lib/customer-orders/access";
import { convertOrderToInvoice } from "@/lib/customer-orders/convert";
import type {
  InvoicePaymentEntry,
  InvoicePaymentMethod,
} from "@/lib/salesmen/types";

type RouteContext = { params: Promise<{ id: string }> };

const METHODS: InvoicePaymentMethod[] = ["cash", "cheque", "upi", "imps"];

function parsePayments(raw: unknown): InvoicePaymentEntry[] | { error: string } {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return { error: "paymentEntries must be an array" };

  const payments: InvoicePaymentEntry[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      return { error: "Invalid payment entry" };
    }
    const row = entry as Record<string, unknown>;
    const method = row.method as InvoicePaymentMethod;
    const amount = Number(row.amount);
    if (!METHODS.includes(method) || !(amount > 0)) {
      return { error: "Each payment needs a valid method and amount" };
    }
    payments.push({
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
  return payments;
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireOrderCustomersAccess();
  if (isAuthError(auth)) return auth.error;
  const { supabase, profile } = auth;
  const { id } = await context.params;

  let body: Record<string, unknown> = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payments = parsePayments(body.paymentEntries);
  if ("error" in payments) {
    return NextResponse.json({ error: payments.error }, { status: 400 });
  }

  try {
    const result = await convertOrderToInvoice(supabase, {
      orderId: id,
      createdBy: profile.id,
      paymentEntries: payments,
      discountAmount:
        body.discountAmount != null ? Number(body.discountAmount) : 0,
      notes: body.notes != null ? String(body.notes) : undefined,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to convert order" },
      { status: 400 },
    );
  }
}
