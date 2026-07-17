export type SalesmanCategory = "Salesmen";

export type Salesman = {
  id: string;
  name: string;
  phone: string;
  category: SalesmanCategory;
  isActive: boolean;
  pendingBalance: number;
  lastInvoiceAt: string | null;
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
