export type SalesmanCategory = "Salesmen";

/** Per-unit discount applied on matching purchase lines */
export type SalesmanDiscountRule = {
  /** Match price list `item_type` (e.g. dibbi) */
  itemType: "dibbi" | "box" | "cone" | "zip" | "elastic";
  /** Optional case-insensitive name filter (e.g. "poly", "needle") */
  itemNameIncludes?: string;
  /** Rupees subtracted per matching unit purchased */
  amountPerUnit: number;
  /** Human-readable rule, e.g. "₹1 per Needle Poly Dibbi" */
  description: string;
};

export type Salesman = {
  id: string;
  name: string;
  phone: string;
  category: SalesmanCategory;
  isActive: boolean;
  pendingBalance: number;
  lastInvoiceAt: string | null;
  /** Optional purchase discount rule used when creating invoices */
  discountRule?: SalesmanDiscountRule | null;
};

export type InvoiceLineItem = {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
  amount: number;
  /** Linked catalog item when created from the price list */
  priceListItemId?: string;
};

export type Invoice = {
  id: string;
  number: string;
  salesmanId: string;
  issuedAt: string;
  itemCount: number;
  totalAmount: number;
  amountPaid: number;
  lineItems: InvoiceLineItem[];
  notes?: string;
  discountAmount?: number;
  returnItems?: InvoiceLineItem[];
};

export type TimeRangePreset =
  | "today"
  | "week"
  | "month"
  | "6m"
  | "1y"
  | "max"
  | "custom";

export type DateRange = {
  from: Date;
  to: Date;
};

export type PurchasePaymentsSummary = {
  purchases: number;
  payments: number;
  pending: number;
};
