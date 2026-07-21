import type {
  Invoice,
  InvoiceLineItem,
  InvoicePaymentEntry,
  InvoicePaymentMethod,
  MarketDay,
  Salesman,
  SalesmanDiscountRule,
  SalesmanEntityType,
} from "./types";
import { MARKET_DAYS } from "./types";

export type DbSalesmanRow = {
  id: string;
  name: string;
  phone: string;
  alternate_phone: string | null;
  entity_type: string | null;
  category: string;
  is_active: boolean;
  pending_balance: number | string;
  last_invoice_at: string | null;
  discount_rules: unknown;
  market_day: string | null;
  area: string | null;
  is_defaulter: boolean | null;
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
  notes: string | null;
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
};

export type DbInvoicePaymentRow = {
  id: string;
  invoice_id: string;
  method: InvoicePaymentMethod;
  amount: number | string;
  cheque_number: string | null;
  deposit_account_id: string | null;
  sender_name: string | null;
  sort_order: number;
};

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

export function mapSalesmanRow(row: DbSalesmanRow): Salesman {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    alternatePhone: row.alternate_phone ?? "",
    entityType: parseEntityType(row.entity_type),
    isActive: row.is_active,
    pendingBalance: num(row.pending_balance),
    lastInvoiceAt: row.last_invoice_at,
    discountRules: parseDiscountRules(row.discount_rules),
    marketDay: parseMarketDay(row.market_day),
    area: row.area ?? "",
    isDefaulter: Boolean(row.is_defaulter),
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
            senderName: p.sender_name ?? undefined,
          }))
      : undefined;

  const discount = num(invoice.discount_amount);

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
    returnItems,
    paymentEntries,
  };
}
