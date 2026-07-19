import type {
  CustomerOrder,
  CustomerOrderAttachment,
  CustomerOrderAttachmentKind,
  CustomerOrderLine,
  CustomerOrderLineSource,
  CustomerOrderLineUnit,
  CustomerOrderStatus,
  ItemShade,
} from "./types";

export type DbItemShadeRow = {
  id: string;
  price_list_item_id: string;
  shade_code: string;
  color_label: string | null;
  color_hex: string | null;
  patch_storage_path: string | null;
  is_active: boolean;
};

export type DbOrderRow = {
  id: string;
  customer_id: string;
  status: CustomerOrderStatus;
  order_date: string;
  notes: string | null;
  invoice_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  salesmen?: { name: string } | { name: string }[] | null;
};

export type DbAttachmentRow = {
  id: string;
  order_id: string;
  kind: CustomerOrderAttachmentKind;
  storage_path: string;
  file_name: string | null;
  content_type: string | null;
  ocr_raw_json: unknown;
  sort_order: number;
  created_at: string;
};

export type DbOrderLineRow = {
  id: string;
  order_id: string;
  price_list_item_id: string | null;
  shade_id: string | null;
  shade_code: string;
  qty: number | string;
  unit: CustomerOrderLineUnit;
  source: CustomerOrderLineSource;
  sort_order: number;
  price_list_items?: { item_name: string } | { item_name: string }[] | null;
  item_shades?: DbItemShadeRow | DbItemShadeRow[] | null;
};

function num(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

function nestedName(
  value: { name: string } | { name: string }[] | null | undefined,
): string | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return value[0]?.name;
  return value.name;
}

function nestedItemName(
  value:
    | { item_name: string }
    | { item_name: string }[]
    | null
    | undefined,
): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0]?.item_name ?? null;
  return value.item_name;
}

function nestedShade(
  value: DbItemShadeRow | DbItemShadeRow[] | null | undefined,
): DbItemShadeRow | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export function mapItemShadeRow(row: DbItemShadeRow): ItemShade {
  return {
    id: row.id,
    priceListItemId: row.price_list_item_id,
    shadeCode: row.shade_code,
    colorLabel: row.color_label,
    colorHex: row.color_hex,
    patchStoragePath: row.patch_storage_path,
    isActive: row.is_active,
  };
}

export function mapAttachmentRow(
  row: DbAttachmentRow,
  signedUrl?: string | null,
): CustomerOrderAttachment {
  return {
    id: row.id,
    orderId: row.order_id,
    kind: row.kind,
    storagePath: row.storage_path,
    fileName: row.file_name,
    contentType: row.content_type,
    ocrRawJson: row.ocr_raw_json,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    signedUrl: signedUrl ?? null,
  };
}

export function mapOrderLineRow(row: DbOrderLineRow): CustomerOrderLine {
  const shadeRow = nestedShade(row.item_shades);
  return {
    id: row.id,
    orderId: row.order_id,
    priceListItemId: row.price_list_item_id,
    itemName: nestedItemName(row.price_list_items),
    shadeId: row.shade_id,
    shadeCode: row.shade_code,
    qty: num(row.qty),
    unit: row.unit,
    source: row.source,
    sortOrder: row.sort_order,
    shade: shadeRow ? mapItemShadeRow(shadeRow) : null,
  };
}

export function mapOrderRow(
  row: DbOrderRow,
  lines: CustomerOrderLine[] = [],
  attachments: CustomerOrderAttachment[] = [],
): CustomerOrder {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: nestedName(row.salesmen),
    status: row.status,
    orderDate: row.order_date,
    notes: row.notes,
    invoiceId: row.invoice_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lineCount: lines.length,
    lines,
    attachments,
  };
}
