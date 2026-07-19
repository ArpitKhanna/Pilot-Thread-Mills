import type { SupabaseClient } from "@supabase/supabase-js";
import type { PriceListItem } from "@/lib/auth/types";
import {
  paymentInserts,
  type InvoiceWritePayload,
} from "@/lib/salesmen/invoice-api";
import { getInvoiceById, refreshSalesmanTotals } from "@/lib/salesmen/queries";
import type { InvoicePaymentEntry } from "@/lib/salesmen/types";
import { getCustomerOrder, updateCustomerOrder } from "./queries";

export type ConvertOrderInput = {
  orderId: string;
  createdBy: string;
  paymentEntries?: InvoicePaymentEntry[];
  discountAmount?: number;
  notes?: string;
};

export async function convertOrderToInvoice(
  supabase: SupabaseClient,
  input: ConvertOrderInput,
) {
  const order = await getCustomerOrder(supabase, input.orderId);
  if (!order) throw new Error("Order not found");
  if (order.invoiceId) throw new Error("Order already converted to an invoice");
  if (order.status !== "picking" && order.status !== "confirmed") {
    throw new Error("Order must be confirmed or in picking before invoicing");
  }
  if (order.lines.length === 0) {
    throw new Error("Order has no lines to invoice");
  }

  const itemIds = [
    ...new Set(
      order.lines
        .map((l) => l.priceListItemId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const { data: priceRows, error: priceError } = await supabase
    .from("price_list_items")
    .select("*")
    .in("id", itemIds.length > 0 ? itemIds : ["00000000-0000-0000-0000-000000000000"]);
  if (priceError) throw priceError;

  const priceById = new Map(
    ((priceRows ?? []) as PriceListItem[]).map((item) => [item.id, item]),
  );

  const lineItems = order.lines.map((line, index) => {
    const catalog = line.priceListItemId
      ? priceById.get(line.priceListItemId)
      : undefined;
    const unitPrice = catalog ? Number(catalog.customer_price) : 0;
    const nameBase =
      catalog?.item_name ?? line.itemName ?? "Item";
    const name = line.shadeCode
      ? `${nameBase} — ${line.shadeCode}`
      : nameBase;
    const amount = Math.round(unitPrice * line.qty * 100) / 100;
    return {
      id: line.id,
      name,
      qty: line.qty,
      unitPrice,
      amount,
      priceListItemId: line.priceListItemId ?? undefined,
      shadeId: line.shadeId ?? undefined,
      shadeCode: line.shadeCode || undefined,
      sortOrder: index,
    };
  });

  const missingPrice = lineItems.some(
    (l) => !l.priceListItemId || l.unitPrice <= 0,
  );
  if (missingPrice) {
    throw new Error(
      "Every line needs a linked price-list item with a customer price before invoicing",
    );
  }

  const discountAmount = Number(input.discountAmount ?? 0);
  const subtotal = lineItems.reduce((sum, l) => sum + l.amount, 0);
  const totalAmount = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);
  const paymentEntries = input.paymentEntries ?? [];
  const amountPaid =
    Math.round(
      paymentEntries.reduce((sum, p) => sum + p.amount, 0) * 100,
    ) / 100;

  const number = `INV-CU-${Date.now()}`;
  const issuedAt = new Date().toISOString();

  const { data: invoiceRow, error: insertError } = await supabase
    .from("salesmen_invoices")
    .insert({
      number,
      salesman_id: order.customerId,
      issued_at: issuedAt,
      item_count: lineItems.length,
      total_amount: totalAmount,
      amount_paid: amountPaid,
      discount_amount: discountAmount,
      notes: input.notes ?? order.notes,
      created_by: input.createdBy,
    })
    .select("*")
    .single();

  if (insertError || !invoiceRow) {
    throw new Error(insertError?.message ?? "Failed to create invoice");
  }

  const invoiceId = invoiceRow.id as string;

  const lineInserts = lineItems.map((line) => ({
    invoice_id: invoiceId,
    name: line.name,
    qty: line.qty,
    unit_price: line.unitPrice,
    amount: line.amount,
    price_list_item_id: line.priceListItemId ?? null,
    shade_id: line.shadeId ?? null,
    shade_code: line.shadeCode ?? null,
    is_return: false,
    sort_order: line.sortOrder,
  }));

  const { error: linesError } = await supabase
    .from("salesmen_invoice_lines")
    .insert(lineInserts);
  if (linesError) {
    await supabase.from("salesmen_invoices").delete().eq("id", invoiceId);
    throw new Error("Failed to save invoice lines");
  }

  const payload: InvoiceWritePayload = {
    salesmanId: order.customerId,
    totalAmount,
    amountPaid,
    discountAmount,
    lineItems: lineItems.map((l) => ({
      id: l.id,
      name: l.name,
      qty: l.qty,
      unitPrice: l.unitPrice,
      amount: l.amount,
      priceListItemId: l.priceListItemId,
    })),
    paymentEntries,
  };

  const payments = paymentInserts(invoiceId, payload);
  if (payments.length > 0) {
    const { error: payError } = await supabase
      .from("salesmen_invoice_payments")
      .insert(payments);
    if (payError) {
      await supabase.from("salesmen_invoices").delete().eq("id", invoiceId);
      throw new Error("Failed to save payments");
    }
  }

  await updateCustomerOrder(supabase, order.id, {
    status: "invoiced",
    invoiceId,
  });

  try {
    await refreshSalesmanTotals(supabase, order.customerId);
  } catch (e) {
    console.error(e);
  }

  const invoice = await getInvoiceById(supabase, invoiceId);
  const refreshedOrder = await getCustomerOrder(supabase, order.id);
  return { invoice, order: refreshedOrder };
}
