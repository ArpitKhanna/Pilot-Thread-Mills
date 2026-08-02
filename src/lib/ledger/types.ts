import type { InvoicePaymentMethod } from "@/lib/salesmen/types";

export type LedgerReceiptSource =
  | "party_payment"
  | "chitfund"
  | "mutual_fund"
  | "other";

export type ExpenseCategory =
  | "petrol"
  | "dyer"
  | "maintenance"
  | "scheduled"
  | "other";

export type DailyExpense = {
  id: string;
  category: ExpenseCategory;
  payee: string | null;
  amount: number;
  method: InvoicePaymentMethod;
  paidAt: string;
  notes: string | null;
  createdAt: string;
  createdBy: string | null;
  createdByName: string | null;
};

export type LedgerReceiptKind = "advance" | "invoice_payment" | "return";

export type LedgerReceiptLine = {
  id: string;
  kind: LedgerReceiptKind;
  amount: number;
  method: InvoicePaymentMethod;
  receivedAt: string;
  partyId: string | null;
  partyName: string | null;
  partyType: "customer" | "salesman" | null;
  sourceCategory: LedgerReceiptSource;
  invoiceId: string | null;
  invoiceNumber: string | null;
  notes: string | null;
  verificationStatus: string | null;
  senderName: string | null;
};

export type LedgerExpenseLine = {
  id: string;
  category: ExpenseCategory;
  payee: string | null;
  amount: number;
  method: InvoicePaymentMethod;
  paidAt: string;
  notes: string | null;
};

export type DailyLedgerSummary = {
  date: string;
  receiptsTotal: number;
  expensesTotal: number;
  netTotal: number;
  pendingVerificationCount: number;
  methodBreakdown: Record<InvoicePaymentMethod, number>;
  receipts: LedgerReceiptLine[];
  expenses: LedgerExpenseLine[];
};

export type ReceiptWriteInput = {
  mode: "advance" | "invoice";
  partyId?: string;
  invoiceId?: string;
  sourceCategory?: LedgerReceiptSource;
  method: InvoicePaymentMethod;
  amount: number;
  chequeNumber?: string;
  depositAccountId?: string;
  senderName?: string;
  notes?: string;
  receivedAt?: string;
};

export type ExpenseWriteInput = {
  category: ExpenseCategory;
  payee?: string;
  amount: number;
  method: InvoicePaymentMethod;
  paidAt?: string;
  notes?: string;
};

export type OrderStats = {
  date: string;
  receivedToday: number;
  deliveredToday: number;
  carriedOver: number;
  urgentCount: number;
  oldestCarriedOver: Array<{
    id: string;
    customerName: string;
    status: string;
    ageDays: number;
  }>;
};

export type DyeingStats = {
  slaDays: number;
  inQueue: number;
  lagging: number;
  readyUnfulfilled: number;
  awaitingShade: number;
  laggingJobs: Array<{
    id: string;
    customerName: string;
    shadeCode: string;
    status: string;
    ageDays: number;
    isUrgent: boolean;
  }>;
};
