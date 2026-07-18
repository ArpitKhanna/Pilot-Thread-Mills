import type {
  Invoice,
  InvoiceLineItem,
  InvoicePaymentEntry,
  InvoicePaymentMethod,
  Salesman,
  SalesmanDiscountRule,
} from "./types";

export type DbSalesmanRow = {
  id: string;
  name: string;
  phone: string;
  category: string;
  is_active: boolean;
  pending_balance: number | string;
  last_invoice_at: string | null;
  discount_rule: SalesmanDiscountRule | null;
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

export function mapSalesmanRow(row: DbSalesmanRow): Salesman {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    category: "Salesmen",
    isActive: row.is_active,
    pendingBalance: num(row.pending_balance),
    lastInvoiceAt: row.last_invoice_at,
    discountRule: row.discount_rule ?? null,
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
