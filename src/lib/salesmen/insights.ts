import { resolveDateRange, summarizePurchasesAndPayments } from "./mock-data";
import type {
  DateRange,
  Invoice,
  InvoicePaymentMethod,
  TimeRangePreset,
} from "./types";

export type MonthlyTrendPoint = {
  key: string;
  label: string;
  purchases: number;
  payments: number;
};

export type PaymentMethodShare = {
  method: InvoicePaymentMethod;
  amount: number;
  pct: number;
};

export type TopItemShare = {
  name: string;
  qty: number;
  amount: number;
  pct: number;
};

export type OverviewInsights = {
  summary: {
    purchases: number;
    payments: number;
    pending: number;
    netChange: number;
  };
  monthlyTrend: MonthlyTrendPoint[];
  paymentMethods: PaymentMethodShare[];
  topItems: TopItemShare[];
};

const METHOD_ORDER: InvoicePaymentMethod[] = [
  "cash",
  "upi",
  "imps",
  "cheque",
];

function filterInvoices(
  invoices: Invoice[],
  range: DateRange | null,
): Invoice[] {
  if (!range) return invoices;
  const from = range.from.getTime();
  const to = range.to.getTime();
  return invoices.filter((inv) => {
    const t = new Date(inv.issuedAt).getTime();
    return t >= from && t <= to;
  });
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y!, (m ?? 1) - 1, 1);
  return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

/** Build contiguous month keys from range (or from earliest invoice to now). */
function enumerateMonths(
  invoices: Invoice[],
  range: DateRange | null,
  now: Date = new Date(),
): string[] {
  let start: Date;
  let end: Date;

  if (range) {
    start = new Date(range.from.getFullYear(), range.from.getMonth(), 1);
    end = new Date(range.to.getFullYear(), range.to.getMonth(), 1);
  } else if (invoices.length > 0) {
    const times = invoices.map((i) => new Date(i.issuedAt).getTime());
    const earliest = new Date(Math.min(...times));
    start = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = start;
  }

  const keys: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    keys.push(monthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

export function buildMonthlyTrend(
  invoices: Invoice[],
  range: DateRange | null,
): MonthlyTrendPoint[] {
  const filtered = filterInvoices(invoices, range);
  const byMonth = new Map<string, { purchases: number; payments: number }>();

  for (const inv of filtered) {
    const key = monthKey(new Date(inv.issuedAt));
    const current = byMonth.get(key) ?? { purchases: 0, payments: 0 };
    current.purchases += inv.totalAmount;
    current.payments += inv.amountPaid;
    byMonth.set(key, current);
  }

  return enumerateMonths(filtered, range).map((key) => {
    const totals = byMonth.get(key) ?? { purchases: 0, payments: 0 };
    return {
      key,
      label: monthLabel(key),
      purchases: Math.round(totals.purchases * 100) / 100,
      payments: Math.round(totals.payments * 100) / 100,
    };
  });
}

export function buildPaymentMethodMix(
  invoices: Invoice[],
  range: DateRange | null,
): PaymentMethodShare[] {
  const filtered = filterInvoices(invoices, range);
  const totals = new Map<InvoicePaymentMethod, number>();

  for (const inv of filtered) {
    if (inv.paymentEntries && inv.paymentEntries.length > 0) {
      for (const entry of inv.paymentEntries) {
        totals.set(
          entry.method,
          (totals.get(entry.method) ?? 0) + entry.amount,
        );
      }
    } else if (inv.amountPaid > 0) {
      totals.set("cash", (totals.get("cash") ?? 0) + inv.amountPaid);
    }
  }

  const grand = Array.from(totals.values()).reduce((s, n) => s + n, 0);
  if (grand <= 0) return [];

  return METHOD_ORDER.filter((m) => (totals.get(m) ?? 0) > 0).map((method) => {
    const amount = Math.round((totals.get(method) ?? 0) * 100) / 100;
    return {
      method,
      amount,
      pct: Math.round((amount / grand) * 1000) / 10,
    };
  });
}

export function buildTopItems(
  invoices: Invoice[],
  range: DateRange | null,
  limit = 8,
): TopItemShare[] {
  const filtered = filterInvoices(invoices, range);
  const byName = new Map<string, { qty: number; amount: number }>();

  for (const inv of filtered) {
    for (const line of inv.lineItems) {
      const name = line.name.trim() || "Untitled";
      const current = byName.get(name) ?? { qty: 0, amount: 0 };
      current.qty += line.qty;
      current.amount += line.amount;
      byName.set(name, current);
    }
  }

  const rows = Array.from(byName.entries())
    .map(([name, stats]) => ({
      name,
      qty: Math.round(stats.qty * 100) / 100,
      amount: Math.round(stats.amount * 100) / 100,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);

  const maxAmount = rows[0]?.amount ?? 0;

  return rows.map((row) => ({
    ...row,
    pct: maxAmount > 0 ? Math.round((row.amount / maxAmount) * 1000) / 10 : 0,
  }));
}

export function buildOverviewInsights(
  invoices: Invoice[],
  preset: TimeRangePreset,
  customFrom?: string,
  customTo?: string,
): OverviewInsights {
  const range = resolveDateRange(preset, customFrom, customTo);
  const summary = summarizePurchasesAndPayments(invoices, range);

  return {
    summary: {
      purchases: summary.purchases,
      payments: summary.payments,
      pending: summary.pending,
      netChange: summary.purchases - summary.payments,
    },
    monthlyTrend: buildMonthlyTrend(invoices, range),
    paymentMethods: buildPaymentMethodMix(invoices, range),
    topItems: buildTopItems(invoices, range),
  };
}
