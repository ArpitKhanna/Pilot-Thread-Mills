import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapAttachmentRow,
  mapItemShadeRow,
  mapOrderLineRow,
  mapOrderRow,
  type DbAttachmentRow,
  type DbItemShadeRow,
  type DbOrderLineRow,
  type DbOrderRow,
} from "./mappers";
import type {
  CustomerOrder,
  CustomerOrderAttachmentKind,
  CustomerOrderLine,
  CustomerOrderLineSource,
  CustomerOrderLineUnit,
  CustomerOrderStatus,
  ItemShade,
} from "./types";

export const CUSTOMER_ORDER_FILES_BUCKET = "customer-order-files";

const ORDER_SELECT = `
  *,
  salesmen:customer_id ( name )
`;

const LINE_SELECT = `
  *,
  price_list_items:price_list_item_id ( item_name ),
  item_shades:shade_id ( * )
`;

export async function createSignedUrl(
  supabase: SupabaseClient,
  path: string,
  expiresIn = 60 * 60,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(CUSTOMER_ORDER_FILES_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) {
    console.error(error);
    return null;
  }
  return data.signedUrl;
}

async function loadAttachments(
  supabase: SupabaseClient,
  orderId: string,
): Promise<ReturnType<typeof mapAttachmentRow>[]> {
  const { data, error } = await supabase
    .from("customer_order_attachments")
    .select("*")
    .eq("order_id", orderId)
    .order("sort_order");
  if (error) throw error;

  const rows = (data ?? []) as DbAttachmentRow[];
  return Promise.all(
    rows.map(async (row) =>
      mapAttachmentRow(row, await createSignedUrl(supabase, row.storage_path)),
    ),
  );
}

async function loadLines(
  supabase: SupabaseClient,
  orderId: string,
): Promise<CustomerOrderLine[]> {
  const { data, error } = await supabase
    .from("customer_order_lines")
    .select(LINE_SELECT)
    .eq("order_id", orderId)
    .order("sort_order");
  if (error) throw error;
  return ((data ?? []) as DbOrderLineRow[]).map(mapOrderLineRow);
}

export async function listCustomerOrders(
  supabase: SupabaseClient,
): Promise<CustomerOrder[]> {
  const { data, error } = await supabase
    .from("customer_orders")
    .select(ORDER_SELECT)
    .order("order_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;

  const orders = (data ?? []) as DbOrderRow[];
  if (orders.length === 0) return [];

  const ids = orders.map((o) => o.id);
  const { data: lineRows, error: linesError } = await supabase
    .from("customer_order_lines")
    .select("order_id")
    .in("order_id", ids);
  if (linesError) throw linesError;

  const counts = new Map<string, number>();
  for (const row of lineRows ?? []) {
    const orderId = String((row as { order_id: string }).order_id);
    counts.set(orderId, (counts.get(orderId) ?? 0) + 1);
  }

  return orders.map((row) => {
    const mapped = mapOrderRow(row);
    mapped.lineCount = counts.get(row.id) ?? 0;
    return mapped;
  });
}

export async function getCustomerOrder(
  supabase: SupabaseClient,
  id: string,
): Promise<CustomerOrder | null> {
  const { data, error } = await supabase
    .from("customer_orders")
    .select(ORDER_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const [lines, attachments] = await Promise.all([
    loadLines(supabase, id),
    loadAttachments(supabase, id),
  ]);

  return mapOrderRow(data as DbOrderRow, lines, attachments);
}

export type CreateCustomerOrderInput = {
  customerId: string;
  orderDate?: string;
  notes?: string | null;
  createdBy?: string | null;
};

export async function createCustomerOrder(
  supabase: SupabaseClient,
  input: CreateCustomerOrderInput,
): Promise<CustomerOrder> {
  const { data, error } = await supabase
    .from("customer_orders")
    .insert({
      customer_id: input.customerId,
      order_date: input.orderDate ?? new Date().toISOString().slice(0, 10),
      notes: input.notes ?? null,
      status: "draft",
      created_by: input.createdBy ?? null,
    })
    .select(ORDER_SELECT)
    .single();
  if (error) throw error;
  return mapOrderRow(data as DbOrderRow, [], []);
}

export type UpdateCustomerOrderInput = {
  status?: CustomerOrderStatus;
  notes?: string | null;
  orderDate?: string;
  invoiceId?: string | null;
};

const STATUS_TRANSITIONS: Record<CustomerOrderStatus, CustomerOrderStatus[]> = {
  draft: ["confirmed", "cancelled"],
  confirmed: ["picking", "draft", "cancelled"],
  picking: ["invoiced", "confirmed", "cancelled"],
  invoiced: [],
  cancelled: ["draft"],
};

export function canTransitionStatus(
  from: CustomerOrderStatus,
  to: CustomerOrderStatus,
): boolean {
  if (from === to) return true;
  return STATUS_TRANSITIONS[from].includes(to);
}

export async function updateCustomerOrder(
  supabase: SupabaseClient,
  id: string,
  input: UpdateCustomerOrderInput,
): Promise<CustomerOrder> {
  const existing = await getCustomerOrder(supabase, id);
  if (!existing) throw new Error("Order not found");

  if (input.status && !canTransitionStatus(existing.status, input.status)) {
    throw new Error(
      `Cannot move order from ${existing.status} to ${input.status}`,
    );
  }

  const updates: Record<string, unknown> = {};
  if (input.status !== undefined) updates.status = input.status;
  if (input.notes !== undefined) updates.notes = input.notes;
  if (input.orderDate !== undefined) updates.order_date = input.orderDate;
  if (input.invoiceId !== undefined) updates.invoice_id = input.invoiceId;

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from("customer_orders")
      .update(updates)
      .eq("id", id);
    if (error) throw error;
  }

  const refreshed = await getCustomerOrder(supabase, id);
  if (!refreshed) throw new Error("Order not found");
  return refreshed;
}

export type OrderLineInput = {
  priceListItemId?: string | null;
  shadeId?: string | null;
  shadeCode: string;
  qty: number;
  unit?: CustomerOrderLineUnit;
  source?: CustomerOrderLineSource;
};

export async function replaceOrderLines(
  supabase: SupabaseClient,
  orderId: string,
  lines: OrderLineInput[],
): Promise<CustomerOrderLine[]> {
  const { error: deleteError } = await supabase
    .from("customer_order_lines")
    .delete()
    .eq("order_id", orderId);
  if (deleteError) throw deleteError;

  if (lines.length === 0) return [];

  const inserts = lines.map((line, index) => ({
    order_id: orderId,
    price_list_item_id: line.priceListItemId ?? null,
    shade_id: line.shadeId ?? null,
    shade_code: line.shadeCode.trim(),
    qty: line.qty,
    unit: line.unit ?? "box",
    source: line.source ?? "manual",
    sort_order: index,
  }));

  const { error: insertError } = await supabase
    .from("customer_order_lines")
    .insert(inserts);
  if (insertError) throw insertError;

  return loadLines(supabase, orderId);
}

export async function addOrderAttachment(
  supabase: SupabaseClient,
  input: {
    orderId: string;
    kind: CustomerOrderAttachmentKind;
    storagePath: string;
    fileName?: string | null;
    contentType?: string | null;
    sortOrder?: number;
  },
) {
  const { data, error } = await supabase
    .from("customer_order_attachments")
    .insert({
      order_id: input.orderId,
      kind: input.kind,
      storage_path: input.storagePath,
      file_name: input.fileName ?? null,
      content_type: input.contentType ?? null,
      sort_order: input.sortOrder ?? 0,
    })
    .select("*")
    .single();
  if (error) throw error;
  const row = data as DbAttachmentRow;
  return mapAttachmentRow(
    row,
    await createSignedUrl(supabase, row.storage_path),
  );
}

export async function deleteOrderAttachment(
  supabase: SupabaseClient,
  attachmentId: string,
): Promise<{ storagePath: string } | null> {
  const { data, error } = await supabase
    .from("customer_order_attachments")
    .select("*")
    .eq("id", attachmentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as DbAttachmentRow;
  const { error: deleteError } = await supabase
    .from("customer_order_attachments")
    .delete()
    .eq("id", attachmentId);
  if (deleteError) throw deleteError;

  await supabase.storage
    .from(CUSTOMER_ORDER_FILES_BUCKET)
    .remove([row.storage_path]);

  return { storagePath: row.storage_path };
}

export async function listShadesForItem(
  supabase: SupabaseClient,
  priceListItemId: string,
): Promise<ItemShade[]> {
  const { data, error } = await supabase
    .from("item_shades")
    .select("*")
    .eq("price_list_item_id", priceListItemId)
    .eq("is_active", true)
    .order("shade_code");
  if (error) throw error;
  return ((data ?? []) as DbItemShadeRow[]).map(mapItemShadeRow);
}

export type UpsertShadeInput = {
  priceListItemId: string;
  shadeCode: string;
  colorLabel?: string | null;
  colorHex?: string | null;
  patchStoragePath?: string | null;
};

export function normalizeShadeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export async function findOrCreateShade(
  supabase: SupabaseClient,
  input: UpsertShadeInput,
): Promise<ItemShade> {
  const shadeCode = normalizeShadeCode(input.shadeCode);
  if (!shadeCode) throw new Error("Shade code is required");

  const { data: existing, error: findError } = await supabase
    .from("item_shades")
    .select("*")
    .eq("price_list_item_id", input.priceListItemId)
    .eq("shade_code", shadeCode)
    .maybeSingle();
  if (findError) throw findError;

  if (existing) {
    const updates: Record<string, unknown> = {};
    if (input.colorLabel !== undefined) updates.color_label = input.colorLabel;
    if (input.colorHex !== undefined) updates.color_hex = input.colorHex;
    if (input.patchStoragePath !== undefined) {
      updates.patch_storage_path = input.patchStoragePath;
    }
    if (Object.keys(updates).length > 0) {
      const { data, error } = await supabase
        .from("item_shades")
        .update(updates)
        .eq("id", (existing as DbItemShadeRow).id)
        .select("*")
        .single();
      if (error) throw error;
      return mapItemShadeRow(data as DbItemShadeRow);
    }
    return mapItemShadeRow(existing as DbItemShadeRow);
  }

  const { data, error } = await supabase
    .from("item_shades")
    .insert({
      price_list_item_id: input.priceListItemId,
      shade_code: shadeCode,
      color_label: input.colorLabel ?? null,
      color_hex: input.colorHex ?? null,
      patch_storage_path: input.patchStoragePath ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapItemShadeRow(data as DbItemShadeRow);
}

export async function resolveShadesForLines(
  supabase: SupabaseClient,
  lines: OrderLineInput[],
): Promise<OrderLineInput[]> {
  const resolved: OrderLineInput[] = [];
  for (const line of lines) {
    if (!line.priceListItemId || !line.shadeCode.trim()) {
      resolved.push(line);
      continue;
    }
    const shade = await findOrCreateShade(supabase, {
      priceListItemId: line.priceListItemId,
      shadeCode: line.shadeCode,
    });
    resolved.push({
      ...line,
      shadeId: shade.id,
      shadeCode: shade.shadeCode,
    });
  }
  return resolved;
}
