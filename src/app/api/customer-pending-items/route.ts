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

  const fallbackCustomerId = String(body.customerId ?? "").trim();
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
    const customerId =
      String(row.customerId ?? "").trim() || fallbackCustomerId;
    if (!customerId) {
      return NextResponse.json(
        { error: "Each item needs a customer" },
        { status: 400 },
      );
    }
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

    const byCustomer = new Map<
      string,
      {
        customerId: string;
        invoiceDate: string | null;
        items: Array<{
          itemName?: string | null;
          shadeCode: string;
          qty: number;
          unit: string;
        }>;
      }
    >();

    for (const pending of result.pending) {
      const group = byCustomer.get(pending.customerId) ?? {
        customerId: pending.customerId,
        invoiceDate: pending.invoiceDate,
        items: [],
      };
      group.items.push({
        itemName: pending.itemName,
        shadeCode: pending.shadeCode,
        qty: pending.qty,
        unit: pending.unit,
      });
      byCustomer.set(pending.customerId, group);
    }

    const whatsappUrls: Array<{ customerName: string; url: string }> = [];
    for (const group of byCustomer.values()) {
      const customer = await getSalesman(supabase, group.customerId);
      whatsappUrls.push({
        customerName: customer?.name ?? "Customer",
        url: buildMissingItemsWhatsAppUrl({
          customerName: customer?.name ?? "Customer",
          phone: customer?.phone,
          invoiceDate: group.invoiceDate,
          items: group.items,
        }),
      });
    }

    return NextResponse.json(
      {
        ...result,
        whatsappUrls,
        whatsappUrl: whatsappUrls[0]?.url ?? null,
      },
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
