import { NextResponse } from "next/server";
import {
  isAuthError,
  requireOrderCustomersAccess,
} from "@/lib/customer-orders/access";
import {
  createDeliveryRunAndInvoice,
  listDeliveryRuns,
  type DeliveryRunInvoiceOptions,
} from "@/lib/customer-orders/delivery-runs";
import type {
  InvoicePaymentEntry,
  InvoicePaymentMethod,
} from "@/lib/salesmen/types";

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

function parseInvoicesByOrder(
  raw: unknown,
): Record<string, DeliveryRunInvoiceOptions> | { error: string } {
  if (raw == null) return {};
  if (!raw || typeof raw !== "object") {
    return { error: "invoicesByOrder must be an object" };
  }

  const out: Record<string, DeliveryRunInvoiceOptions> = {};
  for (const [orderId, value] of Object.entries(
    raw as Record<string, unknown>,
  )) {
    if (!value || typeof value !== "object") {
      return { error: `Invalid invoice options for order ${orderId}` };
    }
    const row = value as Record<string, unknown>;
    const payments = parsePayments(row.paymentEntries);
    if ("error" in payments) return payments;

    const lineQtyOverrides =
      row.lineQtyOverrides && typeof row.lineQtyOverrides === "object"
        ? Object.fromEntries(
            Object.entries(row.lineQtyOverrides as Record<string, unknown>).map(
              ([lineId, qty]) => [lineId, Number(qty)],
            ),
          )
        : undefined;
    const lineUnitPriceOverrides =
      row.lineUnitPriceOverrides &&
      typeof row.lineUnitPriceOverrides === "object"
        ? Object.fromEntries(
            Object.entries(
              row.lineUnitPriceOverrides as Record<string, unknown>,
            ).map(([lineId, price]) => [lineId, Number(price)]),
          )
        : undefined;

    out[orderId] = {
      discountAmount:
        row.discountAmount != null ? Number(row.discountAmount) : 0,
      paymentEntries: payments,
      lineQtyOverrides,
      lineUnitPriceOverrides,
      notes: row.notes != null ? String(row.notes) : undefined,
    };
  }
  return out;
}

export async function GET() {
  const auth = await requireOrderCustomersAccess();
  if (isAuthError(auth)) return auth.error;
  const { supabase } = auth;

  try {
    const runs = await listDeliveryRuns(supabase);
    return NextResponse.json({ runs });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list delivery runs" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireOrderCustomersAccess();
  if (isAuthError(auth)) return auth.error;
  const { supabase, profile } = auth;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderIds = Array.isArray(body.orderIds)
    ? body.orderIds.map((id) => String(id))
    : [];
  const deliveryBy = String(body.deliveryBy ?? "").trim();
  if (!deliveryBy) {
    return NextResponse.json(
      { error: "Delivery person is required" },
      { status: 400 },
    );
  }

  const lineQtyOverridesByOrder =
    body.lineQtyOverridesByOrder &&
    typeof body.lineQtyOverridesByOrder === "object"
      ? (body.lineQtyOverridesByOrder as Record<string, Record<string, number>>)
      : undefined;

  const invoicesByOrder = parseInvoicesByOrder(body.invoicesByOrder);
  if ("error" in invoicesByOrder) {
    return NextResponse.json({ error: invoicesByOrder.error }, { status: 400 });
  }

  try {
    const run = await createDeliveryRunAndInvoice(supabase, {
      orderIds,
      deliveryBy,
      area: body.area != null ? String(body.area) : null,
      runDate: body.runDate ? String(body.runDate) : undefined,
      notes: body.notes != null ? String(body.notes) : null,
      createdBy: profile.id,
      lineQtyOverridesByOrder,
      invoicesByOrder,
    });
    return NextResponse.json({ run }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Failed to create delivery run",
      },
      { status: 400 },
    );
  }
}
