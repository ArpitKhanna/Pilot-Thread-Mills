export type CustomerOrderStatus =
  | "draft"
  | "confirmed"
  | "picking"
  | "invoiced"
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
  source: CustomerOrderLineSource;
  sortOrder: number;
  shade?: ItemShade | null;
};

export type CustomerOrder = {
  id: string;
  customerId: string;
  customerName?: string;
  status: CustomerOrderStatus;
  orderDate: string;
  notes: string | null;
  invoiceId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  lineCount: number;
  lines: CustomerOrderLine[];
  attachments: CustomerOrderAttachment[];
};

export const CUSTOMER_ORDER_STATUS_LABELS: Record<CustomerOrderStatus, string> =
  {
    draft: "Draft",
    confirmed: "Confirmed",
    picking: "Picking",
    invoiced: "Invoiced",
    cancelled: "Cancelled",
  };

export const ORDER_LINE_UNIT_LABELS: Record<CustomerOrderLineUnit, string> = {
  box: "Box",
  dibbi: "Dibbi",
  cone: "Cone",
  unit: "Unit",
};
