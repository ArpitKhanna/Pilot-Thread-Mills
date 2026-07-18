import type {
  DateRange,
  Invoice,
  PurchasePaymentsSummary,
  Salesman,
  TimeRangePreset,
} from "./types";

export {
  canEditInvoice,
  formatEditCountdown,
  getInvoiceEditRemainingMs,
  INVOICE_EDIT_WINDOW_MS,
} from "./invoice-api";

function startOfDay(d: Date): Date {
  const result = new Date(d);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(d: Date): Date {
  const result = new Date(d);
  result.setHours(23, 59, 59, 999);
  return result;
}

export function resolveDateRange(
  preset: TimeRangePreset,
  customFrom?: string,
  customTo?: string,
  now: Date = new Date(),
): DateRange | null {
  const to = endOfDay(now);

  switch (preset) {
    case "today":
      return { from: startOfDay(now), to };
    case "week": {
      const from = startOfDay(now);
      from.setDate(from.getDate() - 6);
      return { from, to };
    }
    case "month": {
      const from = startOfDay(now);
      from.setMonth(from.getMonth() - 1);
      return { from, to };
    }
    case "6m": {
      const from = startOfDay(now);
      from.setMonth(from.getMonth() - 6);
      return { from, to };
    }
    case "1y": {
      const from = startOfDay(now);
      from.setFullYear(from.getFullYear() - 1);
      return { from, to };
    }
    case "max":
      return null;
    case "custom": {
      if (!customFrom || !customTo) return null;
      return {
        from: startOfDay(new Date(customFrom)),
        to: endOfDay(new Date(customTo)),
      };
    }
    default:
      return null;
  }
}

export function summarizePurchasesAndPayments(
  invoices: Invoice[],
  range: DateRange | null,
): PurchasePaymentsSummary {
  const filtered = range
    ? invoices.filter((inv) => {
        const t = new Date(inv.issuedAt).getTime();
        return t >= range.from.getTime() && t <= range.to.getTime();
      })
    : invoices;

  const purchases = filtered.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const payments = filtered.reduce((sum, inv) => sum + inv.amountPaid, 0);
  const pending = purchases - payments;

  return { purchases, payments, pending };
}

export function formatINR(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

/** Sum matching purchase units × rule.amountPerUnit */
export function calculateSalesmanDiscount(
  lines: Array<{
    priceListItemId: string | null | undefined;
    qty: number;
  }>,
  priceList: Array<{
    id: string;
    item_name: string;
    item_type: string;
  }>,
  rule: Salesman["discountRule"],
): number {
  if (!rule || rule.amountPerUnit <= 0) return 0;

  let units = 0;
  const needle = rule.itemNameIncludes?.trim().toLowerCase();

  for (const line of lines) {
    if (!line.priceListItemId || !(line.qty > 0)) continue;
    const item = priceList.find((p) => p.id === line.priceListItemId);
    if (!item) continue;
    if (item.item_type !== rule.itemType) continue;
    if (needle && !item.item_name.toLowerCase().includes(needle)) continue;
    units += line.qty;
  }

  return Math.round(units * rule.amountPerUnit * 100) / 100;
}

export function formatInvoiceDate(iso: string): {
  weekday: string;
  day: string;
  monthYear: string;
  time: string;
} {
  const d = new Date(iso);
  return {
    weekday: d.toLocaleDateString("en-IN", { weekday: "short" }),
    day: d.toLocaleDateString("en-IN", { day: "numeric" }),
    monthYear: d.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    }),
    time: d.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
  };
}

export function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function buildWhatsAppShareUrl(
  phone: string,
  invoice: Invoice,
  salesmanName: string,
): string {
  const text = [
    `Invoice ${invoice.number}`,
    `Salesman: ${salesmanName}`,
    `Amount: ${formatINR(invoice.totalAmount)}`,
    `Paid: ${formatINR(invoice.amountPaid)}`,
    `Date: ${formatShortDate(invoice.issuedAt)}`,
  ].join("\n");

  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
