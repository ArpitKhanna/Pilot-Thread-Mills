import type {
  CustomerClothPatch,
  CustomerClothPatchStatus,
  CustomerOrder,
  CustomerOrderAttachment,
  CustomerOrderAttachmentKind,
  CustomerOrderLine,
  CustomerOrderLineSource,
  CustomerOrderLineUnit,
  CustomerOrderStatus,
  CustomerPendingItem,
  CustomerPendingItemStatus,
  DeliveryRun,
  DeliveryRunOrder,
  DeliveryRunStatus,
  DyeingJob,
  DyeingJobStatus,
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
  delivery_by?: string | null;
  delivery_by_name?: string | null;
  is_urgent?: boolean | null;
  area_snapshot?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  salesmen?:
    | {
        name: string;
        area?: string | null;
        address_area?: string | null;
        phone?: string | null;
        market_day?: string | null;
      }
    | {
        name: string;
        area?: string | null;
        address_area?: string | null;
        phone?: string | null;
        market_day?: string | null;
      }[]
    | null;
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
  is_urgent?: boolean | null;
  price_list_items?:
    | { item_name: string; customer_price?: number | string }
    | { item_name: string; customer_price?: number | string }[]
    | null;
  item_shades?: DbItemShadeRow | DbItemShadeRow[] | null;
};

export type DbDeliveryRunRow = {
  id: string;
  run_date: string;
  area: string | null;
  delivery_by: string | null;
  delivery_by_name: string | null;
  status: DeliveryRunStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DbDeliveryRunOrderRow = {
  id: string;
  run_id: string;
  order_id: string;
  invoice_id: string | null;
  sort_order: number;
};

export type DbPendingItemRow = {
  id: string;
  customer_id: string;
  invoice_id: string | null;
  invoice_date: string | null;
  order_id: string | null;
  price_list_item_id: string | null;
  shade_id: string | null;
  shade_code: string;
  qty: number | string;
  unit: CustomerOrderLineUnit;
  status: CustomerPendingItemStatus;
  is_urgent: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  salesmen?: { name: string } | { name: string }[] | null;
  price_list_items?:
    | { item_name: string }
    | { item_name: string }[]
    | null;
};

export type DbDyeingJobRow = {
  id: string;
  customer_id: string | null;
  pending_item_id: string | null;
  cloth_patch_id: string | null;
  price_list_item_id: string | null;
  shade_id: string | null;
  shade_code: string;
  qty: number | string;
  unit: CustomerOrderLineUnit;
  status: DyeingJobStatus;
  is_urgent: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  salesmen?: { name: string } | { name: string }[] | null;
  price_list_items?:
    | { item_name: string }
    | { item_name: string }[]
    | null;
};

export type DbClothPatchRow = {
  id: string;
  customer_id: string;
  storage_path: string;
  file_name: string | null;
  content_type: string | null;
  price_list_item_id: string | null;
  shade_id: string | null;
  shade_code: string | null;
  status: CustomerClothPatchStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  price_list_items?:
    | { item_name: string }
    | { item_name: string }[]
    | null;
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

function nestedSalesman(row: DbOrderRow) {
  const value = row.salesmen;
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function nestedItemName(
  value:
    | { item_name: string; customer_price?: number | string }
    | { item_name: string; customer_price?: number | string }[]
    | null
    | undefined,
): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0]?.item_name ?? null;
  return value.item_name;
}

function nestedCustomerPrice(
  value:
    | { item_name: string; customer_price?: number | string }
    | { item_name: string; customer_price?: number | string }[]
    | null
    | undefined,
): number {
  if (!value) return 0;
  const row = Array.isArray(value) ? value[0] : value;
  if (!row?.customer_price) return 0;
  return num(row.customer_price);
}

export function sumOrderAmount(lines: CustomerOrderLine[]): number {
  return lines.reduce(
    (sum, line) => sum + line.qty * (line.unitPrice ?? 0),
    0,
  );
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
    unitPrice: nestedCustomerPrice(row.price_list_items),
    source: row.source,
    sortOrder: row.sort_order,
    isUrgent: Boolean(row.is_urgent),
    shade: shadeRow ? mapItemShadeRow(shadeRow) : null,
  };
}

export function mapOrderRow(
  row: DbOrderRow,
  lines: CustomerOrderLine[] = [],
  attachments: CustomerOrderAttachment[] = [],
): CustomerOrder {
  const salesman = nestedSalesman(row);
  const area =
    row.area_snapshot?.trim() ||
    salesman?.address_area?.trim() ||
    salesman?.area?.trim() ||
    null;
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: salesman?.name ?? nestedName(row.salesmen),
    customerArea: area,
    customerPhone: salesman?.phone ?? null,
    customerMarketDay: salesman?.market_day ?? null,
    status: row.status,
    orderDate: row.order_date,
    notes: row.notes,
    invoiceId: row.invoice_id,
    deliveryBy: row.delivery_by ?? null,
    deliveryByName: row.delivery_by_name ?? null,
    isUrgent: Boolean(row.is_urgent),
    areaSnapshot: row.area_snapshot ?? null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lineCount: lines.length,
    amount: sumOrderAmount(lines),
    lines,
    attachments,
  };
}

export function mapDeliveryRunOrderRow(
  row: DbDeliveryRunOrderRow,
  order?: CustomerOrder | null,
): DeliveryRunOrder {
  return {
    id: row.id,
    runId: row.run_id,
    orderId: row.order_id,
    invoiceId: row.invoice_id,
    sortOrder: row.sort_order,
    order: order ?? null,
  };
}

export function mapDeliveryRunRow(
  row: DbDeliveryRunRow,
  orders: DeliveryRunOrder[] = [],
): DeliveryRun {
  return {
    id: row.id,
    runDate: row.run_date,
    area: row.area,
    deliveryBy: row.delivery_by,
    deliveryByName: row.delivery_by_name,
    status: row.status,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    orders,
  };
}

export function mapPendingItemRow(row: DbPendingItemRow): CustomerPendingItem {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: nestedName(row.salesmen) ?? null,
    invoiceId: row.invoice_id,
    invoiceDate: row.invoice_date,
    orderId: row.order_id,
    priceListItemId: row.price_list_item_id,
    itemName: nestedItemName(row.price_list_items),
    shadeId: row.shade_id,
    shadeCode: row.shade_code,
    qty: num(row.qty),
    unit: row.unit,
    status: row.status,
    isUrgent: Boolean(row.is_urgent),
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapDyeingJobRow(row: DbDyeingJobRow): DyeingJob {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: nestedName(row.salesmen) ?? null,
    pendingItemId: row.pending_item_id,
    clothPatchId: row.cloth_patch_id,
    priceListItemId: row.price_list_item_id,
    itemName: nestedItemName(row.price_list_items),
    shadeId: row.shade_id,
    shadeCode: row.shade_code,
    qty: num(row.qty),
    unit: row.unit,
    status: row.status,
    isUrgent: Boolean(row.is_urgent),
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapClothPatchRow(
  row: DbClothPatchRow,
  signedUrl?: string | null,
): CustomerClothPatch {
  return {
    id: row.id,
    customerId: row.customer_id,
    storagePath: row.storage_path,
    fileName: row.file_name,
    contentType: row.content_type,
    priceListItemId: row.price_list_item_id,
    itemName: nestedItemName(row.price_list_items),
    shadeId: row.shade_id,
    shadeCode: row.shade_code,
    status: row.status,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    signedUrl: signedUrl ?? null,
  };
}
