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

export type InvoicePaymentMethod = "cash" | "cheque" | "upi" | "imps";

/** Detailed payment capture during invoice creation (not printed line-by-line) */
export type InvoicePaymentEntry = {
  id: string;
  method: InvoicePaymentMethod;
  amount: number;
  /** Cheque number when method is cheque */
  chequeNumber?: string;
  /** Deposit bank account id (cheque / upi / imps) */
  depositAccountId?: string;
  /** Sender name for UPI / IMPS */
  senderName?: string;
};

export type Invoice = {
  id: string;
  number: string;
  salesmanId: string;
  issuedAt: string;
  itemCount: number;
  totalAmount: number;
  /** Clubbed sum of all payment entries */
  amountPaid: number;
  lineItems: InvoiceLineItem[];
  notes?: string;
  /** Clubbed rule discount + additional discount */
  discountAmount?: number;
  returnItems?: InvoiceLineItem[];
  /** Optional detail retained for ledger; preview uses amountPaid only */
  paymentEntries?: InvoicePaymentEntry[];
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
