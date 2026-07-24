import { NextResponse } from "next/server";
import {
  isAuthError,
  requireOrderCustomersAccess,
} from "@/lib/customer-orders/access";
import {
  buildMissingItemsWhatsAppUrl,
  createPendingItemsWithDyeingJobs,
  listOpenPendingItems,
  listPendingItemsForCustomer,
  type PendingItemInput,
} from "@/lib/customer-orders/pending-dyeing";
import type { CustomerOrderLineUnit } from "@/lib/customer-orders/types";
import { getSalesman } from "@/lib/salesmen/queries";

const UNITS: CustomerOrderLineUnit[] = ["box", "dibbi", "cone", "unit"];

export async function GET(request: Request) {
  const auth = await requireOrderCustomersAccess();
  if (isAuthError(auth)) return auth.error;
  const { supabase } = auth;

  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId");

  try {
    const pending = customerId
      ? await listPendingItemsForCustomer(supabase, customerId)
      : await listOpenPendingItems(supabase);
    return NextResponse.json({ pending });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list pending items" },
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

  const customerId = String(body.customerId ?? "").trim();
  if (!customerId) {
    return NextResponse.json(
      { error: "Customer is required" },
      { status: 400 },
    );
  }

  const rawItems = Array.isArray(body.items) ? body.items : null;
  if (!rawItems || rawItems.length === 0) {
    return NextResponse.json(
      { error: "items array is required" },
      { status: 400 },
    );
  }

  const items: PendingItemInput[] = [];
  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "Invalid item" }, { status: 400 });
    }
    const row = raw as Record<string, unknown>;
    const unit = String(row.unit ?? "box") as CustomerOrderLineUnit;
    if (!UNITS.includes(unit)) {
      return NextResponse.json({ error: "Invalid unit" }, { status: 400 });
    }
    items.push({
      customerId,
      invoiceId: row.invoiceId ? String(row.invoiceId) : null,
      invoiceDate: row.invoiceDate
        ? String(row.invoiceDate)
        : body.invoiceDate
          ? String(body.invoiceDate)
          : null,
      orderId: row.orderId ? String(row.orderId) : null,
      priceListItemId: row.priceListItemId
        ? String(row.priceListItemId)
        : null,
      shadeId: row.shadeId ? String(row.shadeId) : null,
      shadeCode: String(row.shadeCode ?? ""),
      qty: Number(row.qty),
      unit,
      isUrgent: Boolean(row.isUrgent ?? body.isUrgent),
      notes: row.notes != null ? String(row.notes) : null,
    });
  }

  try {
    const result = await createPendingItemsWithDyeingJobs(
      supabase,
      items,
      profile.id,
    );

    const customer = await getSalesman(supabase, customerId);
    const whatsappUrl = buildMissingItemsWhatsAppUrl({
      customerName: customer?.name ?? "Customer",
      phone: customer?.phone,
      invoiceDate:
        items[0]?.invoiceDate ??
        (body.invoiceDate ? String(body.invoiceDate) : null),
      items: result.pending.map((p) => ({
        itemName: p.itemName,
        shadeCode: p.shadeCode,
        qty: p.qty,
        unit: p.unit,
      })),
    });

    return NextResponse.json(
      { ...result, whatsappUrl },
      { status: 201 },
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Failed to save missing items",
      },
      { status: 400 },
    );
  }
}
