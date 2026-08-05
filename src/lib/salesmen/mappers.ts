import { isCustomerDefaulter } from "@/lib/customers/defaulter";
import type {
  CustomerPriceRule,
  CustomerTier,
  CustomerTierRubric,
  Invoice,
  InvoiceLineItem,
  InvoicePaymentEntry,
  InvoicePaymentMethod,
  InvoiceVerificationStatus,
  MarketDay,
  PaymentRecordStatus,
  Salesman,
  SalesmanAdvance,
  SalesmanDiscountRule,
  SalesmanEntityType,
  SalesmanReturn,
  TierRubricScore,
} from "./types";
import {
  CUSTOMER_TIERS,
  EMPTY_TIER_RUBRIC,
  MARKET_DAYS,
} from "./types";

export type DbSalesmanRow = {
  id: string;
  name: string;
  phone: string;
  alternate_phone: string | null;
  entity_type: string | null;
  category: string;
  is_active: boolean;
  pending_balance: number | string;
  opening_balance?: number | string | null;
  last_invoice_at: string | null;
  discount_rules: unknown;
  market_day: string | null;
  area: string | null;
  tier: string | null;
  balance_threshold: number | string | null;
  address_building: string | null;
  address_area: string | null;
  address_city: string | null;
  address_state: string | null;
  address_pincode: string | null;
  map_lat: number | string | null;
  map_lng: number | string | null;
  tier_rubric: unknown;
  price_rules: unknown;
};

export type DbInvoiceRow = {
  id: string;
  number: string;
  salesman_id: string;
  issued_at: string;
  item_count: number;
  total_amount: number | string;
  amount_paid: number | string;
  discount_amount: number | string;
  additional_amount: number | string;
  additional_amount_reason?: string | null;
  notes: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  verification_status?: string | null;
  verified_by?: string | null;
  verified_by_name?: string | null;
  verified_at?: string | null;
  verification_note?: string | null;
};

export type DbInvoiceLineRow = {
  id: string;
  invoice_id: string;
  name: string;
  qty: number | string;
  unit_price: number | string;
  amount: number | string;
  price_list_item_id: string | null;
  is_return: boolean;
  sort_order: number;
  stand_alone_return_id?: string | null;
};

export type DbInvoicePaymentRow = {
  id: string;
  invoice_id: string;
  method: InvoicePaymentMethod;
  amount: number | string;
  cheque_number: string | null;
  deposit_account_id: string | null;
  deposit_account_other: string | null;
  sender_name: string | null;
  sort_order: number;
  status?: string | null;
  advance_id?: string | null;
  received_at?: string | null;
  created_at?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancelled_by_name?: string | null;
  cancel_reason?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  verification_status?: string | null;
  verified_by?: string | null;
  verified_by_name?: string | null;
  verified_at?: string | null;
};

export type DbAdvanceRow = {
  id: string;
  salesman_id: string | null;
  source_category?: string | null;
  method: InvoicePaymentMethod;
  amount: number | string;
  remaining_amount: number | string;
  cheque_number: string | null;
  deposit_account_id: string | null;
  sender_name: string | null;
  notes: string | null;
  received_at: string;
  created_at?: string | null;
  status: string;
  verification_status?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  verified_by?: string | null;
  verified_by_name?: string | null;
  verified_at?: string | null;
  verification_note?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancelled_by_name?: string | null;
  cancel_reason?: string | null;
};

export type DbReturnRow = {
  id: string;
  salesman_id: string;
  total_amount: number | string;
  remaining_amount: number | string;
  notes: string | null;
  received_at: string;
  created_at?: string | null;
  status: string;
  verification_status?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  verified_by?: string | null;
  verified_by_name?: string | null;
  verified_at?: string | null;
  verification_note?: string | null;
};

export type DbReturnLineRow = {
  id: string;
  return_id: string;
  name: string;
  qty: number | string;
  unit_price: number | string;
  amount: number | string;
  price_list_item_id: string | null;
  sort_order: number;
};

function parseVerificationStatus(
  value: string | null | undefined,
): InvoiceVerificationStatus {
  if (
    value === "pending_verification" ||
    value === "needs_edit" ||
    value === "verified"
  ) {
    return value;
  }
  return "verified";
}

function parsePaymentStatus(
  value: string | null | undefined,
): PaymentRecordStatus {
  return value === "cancelled" ? "cancelled" : "active";
}

function num(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

function parseEntityType(value: string | null | undefined): SalesmanEntityType {
  return value === "customer" ? "customer" : "salesman";
}

function parseMarketDay(value: string | null | undefined): MarketDay | "" {
  if (!value) return "";
  return (MARKET_DAYS as readonly string[]).includes(value)
    ? (value as MarketDay)
    : "";
}

function parseTier(value: string | null | undefined): CustomerTier | "" {
  if (!value) return "";
  return (CUSTOMER_TIERS as readonly string[]).includes(value)
    ? (value as CustomerTier)
    : "";
}

function parseBalanceThreshold(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function parseDiscountRules(raw: unknown): SalesmanDiscountRule[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  const rules: SalesmanDiscountRule[] = [];

  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const itemName = String(
      row.itemName ?? row.itemNameIncludes ?? "",
    ).trim();
    const amountPerUnit = Number(row.amountPerUnit);
    if (!itemName || !Number.isFinite(amountPerUnit) || amountPerUnit < 0) {
      continue;
    }
    rules.push({
      id: String(row.id ?? crypto.randomUUID()),
      itemName,
      priceListItemId: row.priceListItemId
        ? String(row.priceListItemId)
        : undefined,
      amountPerUnit,
      description:
        String(row.description ?? "").trim() ||
        `₹${amountPerUnit} per ${itemName}`,
    });
  }

  return rules;
}

function parseCoord(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseRubricScore(value: unknown): TierRubricScore | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n as TierRubricScore;
}

function parseTierRubric(raw: unknown): CustomerTierRubric {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...EMPTY_TIER_RUBRIC };
  }
  const row = raw as Record<string, unknown>;
  return {
    orderFrequency: parseRubricScore(row.orderFrequency),
    orderAmount: parseRubricScore(row.orderAmount),
    paymentAmount: parseRubricScore(row.paymentAmount),
    paymentSpeed: parseRubricScore(row.paymentSpeed),
  };
}

function parsePriceRules(raw: unknown): CustomerPriceRule[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  const rules: CustomerPriceRule[] = [];

  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const itemName = String(row.itemName ?? "").trim();
    const adjustmentPerUnit = Number(row.adjustmentPerUnit);
    if (
      !itemName ||
      !Number.isFinite(adjustmentPerUnit) ||
      adjustmentPerUnit === 0
    ) {
      continue;
    }
    const rounded = Math.round(adjustmentPerUnit * 100) / 100;
    const abs = Math.abs(rounded);
    rules.push({
      id: String(row.id ?? crypto.randomUUID()),
      itemName,
      priceListItemId: row.priceListItemId
        ? String(row.priceListItemId)
        : undefined,
      adjustmentPerUnit: rounded,
      description:
        String(row.description ?? "").trim() ||
        (rounded > 0
          ? `₹${abs} upcharge per ${itemName}`
          : `₹${abs} discount per ${itemName}`),
    });
  }

  return rules;
}

export function mapSalesmanRow(row: DbSalesmanRow): Salesman {
  const addressArea = row.address_area ?? "";
  const entityType = parseEntityType(row.entity_type);
  const pendingBalance = num(row.pending_balance);
  const balanceThreshold = parseBalanceThreshold(row.balance_threshold);
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    alternatePhone: row.alternate_phone ?? "",
    entityType,
    isActive: row.is_active,
    openingBalance: num(row.opening_balance ?? 0),
    pendingBalance,
    lastInvoiceAt: row.last_invoice_at,
    discountRules: parseDiscountRules(row.discount_rules),
    marketDay: parseMarketDay(row.market_day),
    area: addressArea || row.area || "",
    isDefaulter:
      entityType === "customer"
        ? isCustomerDefaulter(pendingBalance, balanceThreshold)
        : false,
    tier: parseTier(row.tier),
    balanceThreshold,
    addressBuilding: row.address_building ?? "",
    addressArea,
    addressCity: row.address_city ?? "",
    addressState: row.address_state ?? "",
    addressPincode: row.address_pincode ?? "",
    mapLat: parseCoord(row.map_lat),
    mapLng: parseCoord(row.map_lng),
    tierRubric: parseTierRubric(row.tier_rubric),
    priceRules: parsePriceRules(row.price_rules),
  };
}

export function mapInvoiceRows(
  invoice: DbInvoiceRow,
  lines: DbInvoiceLineRow[],
  payments: DbInvoicePaymentRow[],
): Invoice {
  const purchaseLines = lines
    .filter((l) => !l.is_return)
    .sort((a, b) => a.sort_order - b.sort_order);
  const returnLines = lines
    .filter((l) => l.is_return)
    .sort((a, b) => a.sort_order - b.sort_order);

  const lineItems: InvoiceLineItem[] = purchaseLines.map((l) => ({
    id: l.id,
    name: l.name,
    qty: num(l.qty),
    unitPrice: num(l.unit_price),
    amount: num(l.amount),
    priceListItemId: l.price_list_item_id ?? undefined,
  }));

  const returnItems: InvoiceLineItem[] | undefined =
    returnLines.length > 0
      ? returnLines.map((l) => ({
          id: l.id,
          name: l.name,
          qty: num(l.qty),
          unitPrice: num(l.unit_price),
          amount: num(l.amount),
          priceListItemId: l.price_list_item_id ?? undefined,
          standAloneReturnId: l.stand_alone_return_id ?? undefined,
        }))
      : undefined;

  const paymentEntries: InvoicePaymentEntry[] | undefined =
    payments.length > 0
      ? [...payments]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((p) => ({
            id: p.id,
            method: p.method,
            amount: num(p.amount),
            chequeNumber: p.cheque_number ?? undefined,
            depositAccountId: p.deposit_account_id ?? undefined,
            depositAccountOther: p.deposit_account_other ?? undefined,
            senderName: p.sender_name ?? undefined,
            advanceId: p.advance_id ?? undefined,
            receivedAt: p.received_at ?? undefined,
            createdAt: p.created_at ?? undefined,
            status: parsePaymentStatus(p.status),
            cancelledAt: p.cancelled_at ?? null,
            cancelledByName: p.cancelled_by_name ?? null,
            cancelReason: p.cancel_reason ?? null,
            verificationStatus: parseVerificationStatus(p.verification_status),
            createdBy: p.created_by ?? null,
            createdByName: p.created_by_name ?? null,
            verifiedBy: p.verified_by ?? null,
            verifiedByName: p.verified_by_name ?? null,
            verifiedAt: p.verified_at ?? null,
          }))
      : undefined;

  const discount = num(invoice.discount_amount);
  const additional = num(invoice.additional_amount);

  return {
    id: invoice.id,
    number: invoice.number,
    salesmanId: invoice.salesman_id,
    issuedAt: invoice.issued_at,
    itemCount: invoice.item_count,
    totalAmount: num(invoice.total_amount),
    amountPaid: num(invoice.amount_paid),
    lineItems,
    notes: invoice.notes ?? undefined,
    discountAmount: discount > 0 ? discount : undefined,
    additionalAmount: additional > 0 ? additional : undefined,
    additionalAmountReason: invoice.additional_amount_reason?.trim()
      ? invoice.additional_amount_reason.trim()
      : undefined,
    returnItems,
    paymentEntries,
    verificationStatus: parseVerificationStatus(invoice.verification_status),
    createdBy: invoice.created_by ?? null,
    createdByName: invoice.created_by_name ?? null,
    verifiedBy: invoice.verified_by ?? null,
    verifiedByName: invoice.verified_by_name ?? null,
    verifiedAt: invoice.verified_at ?? null,
    verificationNote: invoice.verification_note ?? null,
  };
}

export function mapAdvanceRow(row: DbAdvanceRow): SalesmanAdvance {
  const sourceCategory = row.source_category as SalesmanAdvance["sourceCategory"];
  return {
    id: row.id,
    salesmanId: row.salesman_id ?? "",
    sourceCategory: sourceCategory ?? "party_payment",
    method: row.method,
    amount: num(row.amount),
    remainingAmount: num(row.remaining_amount),
    chequeNumber: row.cheque_number ?? undefined,
    depositAccountId: row.deposit_account_id ?? undefined,
    senderName: row.sender_name ?? undefined,
    notes: row.notes ?? undefined,
    receivedAt: row.received_at,
    createdAt: row.created_at ?? row.received_at,
    status: parsePaymentStatus(row.status),
    verificationStatus: parseVerificationStatus(row.verification_status),
    createdBy: row.created_by ?? null,
    createdByName: row.created_by_name ?? null,
    verifiedBy: row.verified_by ?? null,
    verifiedByName: row.verified_by_name ?? null,
    verifiedAt: row.verified_at ?? null,
    verificationNote: row.verification_note ?? null,
    cancelledAt: row.cancelled_at ?? null,
    cancelledByName: row.cancelled_by_name ?? null,
    cancelReason: row.cancel_reason ?? null,
  };
}

export function mapReturnRow(
  row: DbReturnRow,
  lines: DbReturnLineRow[],
): SalesmanReturn {
  const sorted = [...lines].sort((a, b) => a.sort_order - b.sort_order);
  return {
    id: row.id,
    salesmanId: row.salesman_id,
    totalAmount: num(row.total_amount),
    remainingAmount: num(row.remaining_amount),
    lineItems: sorted.map((l) => ({
      id: l.id,
      name: l.name,
      qty: num(l.qty),
      unitPrice: num(l.unit_price),
      amount: num(l.amount),
      priceListItemId: l.price_list_item_id ?? undefined,
    })),
    notes: row.notes ?? undefined,
    receivedAt: row.received_at,
    createdAt: row.created_at ?? row.received_at,
    status: parsePaymentStatus(row.status),
    verificationStatus: parseVerificationStatus(row.verification_status),
    createdBy: row.created_by ?? null,
    createdByName: row.created_by_name ?? null,
    verifiedBy: row.verified_by ?? null,
    verifiedByName: row.verified_by_name ?? null,
    verifiedAt: row.verified_at ?? null,
    verificationNote: row.verification_note ?? null,
  };
}
