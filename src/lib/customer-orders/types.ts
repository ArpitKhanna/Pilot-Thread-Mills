export type CustomerOrderStatus =
  | "draft"
  | "picking"
  | "packed"
  | "invoiced"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type CustomerOrderAttachmentKind = "order_slip" | "cloth_patch";

export type CustomerOrderLineSource = "ocr" | "manual";

export type CustomerOrderLineUnit = "box" | "dibbi" | "cone" | "unit";

export type ItemShade = {
  id: string;
  priceListItemId: string;
  shadeCode: string;
  colorLabel: string | null;
  colorHex: string | null;
  patchStoragePath: string | null;
  patchUrl?: string | null;
  isActive: boolean;
};

export type CustomerOrderAttachment = {
  id: string;
  orderId: string;
  kind: CustomerOrderAttachmentKind;
  storagePath: string;
  fileName: string | null;
  contentType: string | null;
  ocrRawJson: unknown;
  sortOrder: number;
  createdAt: string;
  signedUrl?: string | null;
};

export type CustomerOrderLine = {
  id: string;
  orderId: string;
  priceListItemId: string | null;
  itemName?: string | null;
  shadeId: string | null;
  shadeCode: string;
  qty: number;
  unit: CustomerOrderLineUnit;
  unitPrice?: number;
  source: CustomerOrderLineSource;
  sortOrder: number;
  isUrgent: boolean;
  shade?: ItemShade | null;
};

export type DeliveryStaff = {
  id: string;
  fullName: string;
};

export type CustomerOrder = {
  id: string;
  customerId: string;
  customerName?: string;
  customerArea?: string | null;
  customerPhone?: string | null;
  customerMarketDay?: string | null;
  status: CustomerOrderStatus;
  orderDate: string;
  notes: string | null;
  invoiceId: string | null;
  deliveryBy: string | null;
  deliveryByName: string | null;
  isUrgent: boolean;
  areaSnapshot: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  lineCount: number;
  amount: number;
  lines: CustomerOrderLine[];
  attachments: CustomerOrderAttachment[];
};

export type CustomerOrderEventKind =
  | "created"
  | "status_changed"
  | "urgent_set"
  | "urgent_cleared"
  | "invoice_generated"
  | "delivery_assigned"
  | "note";

export type CustomerOrderEvent = {
  id: string;
  orderId: string;
  kind: CustomerOrderEventKind;
  message: string;
  fromStatus: CustomerOrderStatus | null;
  toStatus: CustomerOrderStatus | null;
  actorId: string | null;
  actorName: string | null;
  createdAt: string;
};

export type DeliveryRunStatus = "open" | "dispatched" | "done";

export type DeliveryRunOrder = {
  id: string;
  runId: string;
  orderId: string;
  invoiceId: string | null;
  sortOrder: number;
  order?: CustomerOrder | null;
};

export type DeliveryRun = {
  id: string;
  runDate: string;
  area: string | null;
  deliveryBy: string | null;
  deliveryByName: string | null;
  status: DeliveryRunStatus;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  orders: DeliveryRunOrder[];
};

export type CustomerPendingItemStatus =
  | "open"
  | "in_dyeing"
  | "ready"
  | "fulfilled"
  | "cancelled";

export type CustomerPendingItem = {
  id: string;
  customerId: string;
  customerName?: string | null;
  invoiceId: string | null;
  invoiceDate: string | null;
  orderId: string | null;
  priceListItemId: string | null;
  itemName?: string | null;
  shadeId: string | null;
  shadeCode: string;
  qty: number;
  unit: CustomerOrderLineUnit;
  status: CustomerPendingItemStatus;
  isUrgent: boolean;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DyeingJobStatus = "queued" | "dyeing" | "done" | "cancelled";

export type DyeingJob = {
  id: string;
  customerId: string | null;
  customerName?: string | null;
  pendingItemId: string | null;
  clothPatchId: string | null;
  priceListItemId: string | null;
  itemName?: string | null;
  shadeId: string | null;
  shadeCode: string;
  qty: number;
  unit: CustomerOrderLineUnit;
  status: DyeingJobStatus;
  isUrgent: boolean;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerClothPatchStatus = "awaiting_shade" | "assigned";

export type CustomerClothPatch = {
  id: string;
  customerId: string;
  storagePath: string;
  fileName: string | null;
  contentType: string | null;
  priceListItemId: string | null;
  itemName?: string | null;
  shadeId: string | null;
  shadeCode: string | null;
  status: CustomerClothPatchStatus;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  signedUrl?: string | null;
};

export const CUSTOMER_ORDER_STATUS_LABELS: Record<CustomerOrderStatus, string> =
  {
    draft: "Drafts",
    picking: "Picking",
    packed: "Packed",
    invoiced: "Invoiced",
    out_for_delivery: "Out for Delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };

export const KANBAN_COLUMNS: CustomerOrderStatus[] = [
  "picking",
  "packed",
  "invoiced",
  "out_for_delivery",
  "delivered",
];

/** Client-safe allowed status moves (mirrors server STATUS_TRANSITIONS). */
export const ORDER_STATUS_MOVES: Record<
  CustomerOrderStatus,
  CustomerOrderStatus[]
> = {
  draft: ["picking", "cancelled"],
  picking: ["packed", "cancelled"],
  packed: ["invoiced", "picking", "cancelled"],
  invoiced: ["out_for_delivery"],
  out_for_delivery: ["delivered", "invoiced"],
  delivered: [],
  cancelled: ["picking"],
};

export const ORDER_LINE_UNIT_LABELS: Record<CustomerOrderLineUnit, string> = {
  box: "Box",
  dibbi: "Dibbi",
  cone: "Cone",
  unit: "Unit",
};

export const DELIVERY_RUN_STATUS_LABELS: Record<DeliveryRunStatus, string> = {
  open: "Open",
  dispatched: "Dispatched",
  done: "Done",
};

export const PENDING_ITEM_STATUS_LABELS: Record<
  CustomerPendingItemStatus,
  string
> = {
  open: "Open",
  in_dyeing: "In dyeing",
  ready: "Ready",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
};

export const DYEING_JOB_STATUS_LABELS: Record<DyeingJobStatus, string> = {
  queued: "Queued",
  dyeing: "Dyeing",
  done: "Done",
  cancelled: "Cancelled",
};
