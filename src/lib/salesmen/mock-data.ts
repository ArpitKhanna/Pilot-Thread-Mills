import type {
  DateRange,
  Invoice,
  PurchasePaymentsSummary,
  Salesman,
  TimeRangePreset,
} from "./types";

export const MOCK_SALESMEN: Salesman[] = [
  {
    id: "sm-nandkishore",
    name: "Nandkishore",
    phone: "919876543210",
    category: "Salesmen",
    isActive: true,
    pendingBalance: 30000,
    lastInvoiceAt: "2026-07-15T14:30:00.000Z",
  },
  {
    id: "sm-ramesh",
    name: "Ramesh Kumar",
    phone: "919811122233",
    category: "Salesmen",
    isActive: true,
    pendingBalance: 12500,
    lastInvoiceAt: "2026-07-12T10:15:00.000Z",
  },
  {
    id: "sm-suresh",
    name: "Suresh Patel",
    phone: "919822233344",
    category: "Salesmen",
    isActive: true,
    pendingBalance: 0,
    lastInvoiceAt: "2026-07-08T16:45:00.000Z",
  },
  {
    id: "sm-anil",
    name: "Anil Sharma",
    phone: "919833344455",
    category: "Salesmen",
    isActive: false,
    pendingBalance: 8500,
    lastInvoiceAt: "2026-03-20T11:00:00.000Z",
  },
  {
    id: "sm-vijay",
    name: "Vijay Mehta",
    phone: "919844455566",
    category: "Salesmen",
    isActive: true,
    pendingBalance: 45200,
    lastInvoiceAt: "2026-07-16T09:20:00.000Z",
  },
  {
    id: "sm-prakash",
    name: "Prakash Joshi",
    phone: "919855566677",
    category: "Salesmen",
    isActive: false,
    pendingBalance: 0,
    lastInvoiceAt: "2025-11-04T13:30:00.000Z",
  },
];

export const MOCK_INVOICES: Invoice[] = [
  {
    id: "inv-nk-01",
    number: "INV-2026-0142",
    salesmanId: "sm-nandkishore",
    issuedAt: "2026-07-15T14:30:00.000Z",
    itemCount: 4,
    totalAmount: 28500,
    amountPaid: 20000,
    lineItems: [
      { id: "li-1", name: "Cotton Cone 40s", qty: 20, unitPrice: 450, amount: 9000 },
      { id: "li-2", name: "Polyester Dibbi 1/8", qty: 50, unitPrice: 180, amount: 9000 },
      { id: "li-3", name: "Elastic 3/16", qty: 30, unitPrice: 220, amount: 6600 },
      { id: "li-4", name: "Zip Bulk Pack", qty: 10, unitPrice: 390, amount: 3900 },
    ],
    notes: "Partial payment received. Balance due in 7 days.",
  },
  {
    id: "inv-nk-02",
    number: "INV-2026-0138",
    salesmanId: "sm-nandkishore",
    issuedAt: "2026-07-10T11:00:00.000Z",
    itemCount: 3,
    totalAmount: 42000,
    amountPaid: 42000,
    lineItems: [
      { id: "li-5", name: "Cotton Cone 60s", qty: 40, unitPrice: 520, amount: 20800 },
      { id: "li-6", name: "Box Pack Assorted", qty: 15, unitPrice: 800, amount: 12000 },
      { id: "li-7", name: "Polyester Dibbi 1/4", qty: 40, unitPrice: 230, amount: 9200 },
    ],
  },
  {
    id: "inv-nk-03",
    number: "INV-2026-0129",
    salesmanId: "sm-nandkishore",
    issuedAt: "2026-07-02T16:20:00.000Z",
    itemCount: 2,
    totalAmount: 18500,
    amountPaid: 18500,
    lineItems: [
      { id: "li-8", name: "Cotton Cone 40s", qty: 25, unitPrice: 450, amount: 11250 },
      { id: "li-9", name: "Elastic 1/8", qty: 25, unitPrice: 290, amount: 7250 },
    ],
  },
  {
    id: "inv-nk-04",
    number: "INV-2026-0115",
    salesmanId: "sm-nandkishore",
    issuedAt: "2026-06-18T09:45:00.000Z",
    itemCount: 5,
    totalAmount: 35600,
    amountPaid: 30000,
    lineItems: [
      { id: "li-10", name: "Zip Bulk Pack", qty: 20, unitPrice: 390, amount: 7800 },
      { id: "li-11", name: "Cotton Cone 60s", qty: 30, unitPrice: 520, amount: 15600 },
      { id: "li-12", name: "Box Pack Assorted", qty: 8, unitPrice: 800, amount: 6400 },
      { id: "li-13", name: "Polyester Dibbi 1/8", qty: 20, unitPrice: 180, amount: 3600 },
      { id: "li-14", name: "Elastic 3/16", qty: 10, unitPrice: 220, amount: 2200 },
    ],
  },
  {
    id: "inv-nk-05",
    number: "INV-2026-0098",
    salesmanId: "sm-nandkishore",
    issuedAt: "2026-05-22T13:10:00.000Z",
    itemCount: 3,
    totalAmount: 27400,
    amountPaid: 27400,
    lineItems: [
      { id: "li-15", name: "Cotton Cone 40s", qty: 30, unitPrice: 450, amount: 13500 },
      { id: "li-16", name: "Polyester Dibbi 1/4", qty: 40, unitPrice: 230, amount: 9200 },
      { id: "li-17", name: "Elastic 1/8", qty: 20, unitPrice: 235, amount: 4700 },
    ],
  },
  {
    id: "inv-nk-06",
    number: "INV-2026-0081",
    salesmanId: "sm-nandkishore",
    issuedAt: "2026-04-14T10:30:00.000Z",
    itemCount: 2,
    totalAmount: 15800,
    amountPaid: 10000,
    lineItems: [
      { id: "li-18", name: "Box Pack Assorted", qty: 12, unitPrice: 800, amount: 9600 },
      { id: "li-19", name: "Zip Bulk Pack", qty: 16, unitPrice: 390, amount: 6240 },
    ],
  },
  {
    id: "inv-nk-07",
    number: "INV-2026-0064",
    salesmanId: "sm-nandkishore",
    issuedAt: "2026-03-08T15:00:00.000Z",
    itemCount: 4,
    totalAmount: 31200,
    amountPaid: 31200,
    lineItems: [
      { id: "li-20", name: "Cotton Cone 60s", qty: 35, unitPrice: 520, amount: 18200 },
      { id: "li-21", name: "Polyester Dibbi 1/8", qty: 40, unitPrice: 180, amount: 7200 },
      { id: "li-22", name: "Elastic 3/16", qty: 20, unitPrice: 220, amount: 4400 },
      { id: "li-23", name: "Zip Bulk Pack", qty: 4, unitPrice: 350, amount: 1400 },
    ],
  },
  {
    id: "inv-nk-08",
    number: "INV-2025-1187",
    salesmanId: "sm-nandkishore",
    issuedAt: "2025-12-19T12:00:00.000Z",
    itemCount: 3,
    totalAmount: 22100,
    amountPaid: 22100,
    lineItems: [
      { id: "li-24", name: "Cotton Cone 40s", qty: 28, unitPrice: 450, amount: 12600 },
      { id: "li-25", name: "Box Pack Assorted", qty: 7, unitPrice: 800, amount: 5600 },
      { id: "li-26", name: "Elastic 1/8", qty: 15, unitPrice: 260, amount: 3900 },
    ],
  },
  {
    id: "inv-nk-09",
    number: "INV-2026-0140",
    salesmanId: "sm-nandkishore",
    issuedAt: "2026-07-17T08:15:00.000Z",
    itemCount: 2,
    totalAmount: 9800,
    amountPaid: 9800,
    lineItems: [
      { id: "li-27", name: "Polyester Dibbi 1/8", qty: 30, unitPrice: 180, amount: 5400 },
      { id: "li-28", name: "Elastic 3/16", qty: 20, unitPrice: 220, amount: 4400 },
    ],
  },
  {
    id: "inv-rm-01",
    number: "INV-2026-0135",
    salesmanId: "sm-ramesh",
    issuedAt: "2026-07-12T10:15:00.000Z",
    itemCount: 3,
    totalAmount: 24600,
    amountPaid: 12100,
    lineItems: [
      { id: "li-29", name: "Cotton Cone 40s", qty: 20, unitPrice: 450, amount: 9000 },
      { id: "li-30", name: "Box Pack Assorted", qty: 10, unitPrice: 800, amount: 8000 },
      { id: "li-31", name: "Zip Bulk Pack", qty: 20, unitPrice: 380, amount: 7600 },
    ],
  },
  {
    id: "inv-vj-01",
    number: "INV-2026-0145",
    salesmanId: "sm-vijay",
    issuedAt: "2026-07-16T09:20:00.000Z",
    itemCount: 4,
    totalAmount: 51200,
    amountPaid: 6000,
    lineItems: [
      { id: "li-32", name: "Cotton Cone 60s", qty: 50, unitPrice: 520, amount: 26000 },
      { id: "li-33", name: "Polyester Dibbi 1/4", qty: 60, unitPrice: 230, amount: 13800 },
      { id: "li-34", name: "Elastic 1/8", qty: 30, unitPrice: 290, amount: 8700 },
      { id: "li-35", name: "Zip Bulk Pack", qty: 7, unitPrice: 386, amount: 2700 },
    ],
  },
];

export function getSalesmanById(id: string): Salesman | undefined {
  return MOCK_SALESMEN.find((s) => s.id === id);
}

export function getInvoicesForSalesman(salesmanId: string): Invoice[] {
  return MOCK_INVOICES.filter((inv) => inv.salesmanId === salesmanId).sort(
    (a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime(),
  );
}

export function getInvoiceById(id: string): Invoice | undefined {
  return MOCK_INVOICES.find((inv) => inv.id === id);
}

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
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
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
