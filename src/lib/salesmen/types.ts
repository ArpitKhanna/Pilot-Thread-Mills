export type SalesmanEntityType = "salesman" | "customer";

export type MarketDay =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export const MARKET_DAYS: MarketDay[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export const MARKET_DAY_LABELS: Record<MarketDay, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export type CustomerTier = "A" | "B" | "C";

export const CUSTOMER_TIERS: CustomerTier[] = ["A", "B", "C"];

export const CUSTOMER_TIER_LABELS: Record<CustomerTier, string> = {
  A: "Tier A",
  B: "Tier B",
  C: "Tier C",
};

export type TierRubricScore = 1 | 2 | 3 | 4 | 5;

export type CustomerTierRubric = {
  orderFrequency: TierRubricScore | null;
  orderAmount: TierRubricScore | null;
  paymentAmount: TierRubricScore | null;
  paymentSpeed: TierRubricScore | null;
};

export const EMPTY_TIER_RUBRIC: CustomerTierRubric = {
  orderFrequency: null,
  orderAmount: null,
  paymentAmount: null,
  paymentSpeed: null,
};

export const TIER_RUBRIC_LABELS: Record<keyof CustomerTierRubric, string> = {
  orderFrequency: "Order Frequency",
  orderAmount: "Order Amount",
  paymentAmount: "Payment Amount",
  paymentSpeed: "Payment Speed",
};

/** Derive overall tier from rubric averages. Empty if any score is unset. */
export function deriveCustomerTier(
  rubric: CustomerTierRubric,
): CustomerTier | "" {
  const scores = [
    rubric.orderFrequency,
    rubric.orderAmount,
    rubric.paymentAmount,
    rubric.paymentSpeed,
  ];
  if (scores.some((s) => s == null)) return "";
  const avg =
    (scores as TierRubricScore[]).reduce((sum, s) => sum + s, 0) /
    scores.length;
  if (avg >= 4) return "A";
  if (avg >= 2.5) return "B";
  return "C";
}

/** Per-unit discount: for every matching item name purchased, award ₹amount */
export type SalesmanDiscountRule = {
  id: string;
  /** Item name matched against purchase lines / price list */
  itemName: string;
  /** Optional link to a catalog item when picked from price list */
  priceListItemId?: string;
  /** Rupees subtracted per matching unit purchased */
  amountPerUnit: number;
  /** Human-readable rule, e.g. "₹1 per Needle Poly Dibbi" */
  description: string;
};

/** Customer list-price adjustment: positive = upcharge, negative = discount */
export type CustomerPriceRule = {
  id: string;
  itemName: string;
  priceListItemId?: string;
  /** ₹ per unit relative to list price (+ upcharge, − discount) */
  adjustmentPerUnit: number;
  description: string;
};

export type Salesman = {
  id: string;
  name: string;
  phone: string;
  alternatePhone: string;
  entityType: SalesmanEntityType;
  isActive: boolean;
  pendingBalance: number;
  lastInvoiceAt: string | null;
  /** Purchase discount rules used when creating invoices */
  discountRules: SalesmanDiscountRule[];
  /** Customer market day (empty when unset / salesman) */
  marketDay: MarketDay | "";
  /** Geographic / route area label (legacy; synced from addressArea) */
  area: string;
  /** Flagged as payment defaulter */
  isDefaulter: boolean;
  /** Customer tier (empty when unset) */
  tier: CustomerTier | "";
  /** Alert when pending balance reaches/exceeds this amount (null = no alert) */
  balanceThreshold: number | null;
  /** Person / contact name at the shop */
  contactName: string;
  addressBuilding: string;
  addressArea: string;
  addressCity: string;
  addressState: string;
  addressPincode: string;
  mapLat: number | null;
  mapLng: number | null;
  tierRubric: CustomerTierRubric;
  priceRules: CustomerPriceRule[];
};

export const ENTITY_TYPE_LABELS: Record<SalesmanEntityType, string> = {
  salesman: "Salesmen",
  customer: "Customer",
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

export type ItemRequestStatus = "open" | "fulfilled";

export type ItemRequestUrgency = "high" | "medium" | "low";

export type ItemRequest = {
  id: string;
  salesmanId: string;
  itemName: string;
  itemType?: string;
  priceListItemId?: string;
  qty: number;
  urgency: ItemRequestUrgency;
  requestedAt: string;
  notes?: string;
  status: ItemRequestStatus;
  fulfilledAt: string | null;
};

export const ITEM_REQUEST_URGENCY_LABELS: Record<ItemRequestUrgency, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};
