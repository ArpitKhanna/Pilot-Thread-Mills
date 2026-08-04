import type { SupabaseClient } from "@supabase/supabase-js";
import { mapAdvanceRow, type DbAdvanceRow } from "@/lib/salesmen/mappers";
import type { InvoicePaymentMethod } from "@/lib/salesmen/types";
import { dayBounds } from "./date-utils";
import { listExpensesForDay } from "./expenses";
import type {
  DailyLedgerSummary,
  LedgerReceiptKind,
  LedgerReceiptLine,
  LedgerReceiptSource,
} from "./types";

type DbPaymentWithInvoice = {
  id: string;
  method: InvoicePaymentMethod;
  amount: number | string;
  received_at: string | null;
  sender_name: string | null;
  verification_status: string | null;
  status: string | null;
  advance_id: string | null;
  invoice_id: string;
  salesmen_invoices:
    | { id: string; number: string; salesman_id: string }
    | { id: string; number: string; salesman_id: string }[]
    | null;
};

type DbReturnRow = {
  id: string;
  total_amount: number | string;
  received_at: string;
  notes: string | null;
  verification_status: string | null;
  status: string | null;
  salesman_id: string;
};

export async function fetchDailyLedger(
  supabase: SupabaseClient,
  dateInput: string,
): Promise<DailyLedgerSummary> {
  const { start, end, date } = dayBounds(dateInput);

  const [advancesRes, paymentsRes, returnsRes, expenses, partiesRes] =
    await Promise.all([
      supabase
        .from("salesmen_advances")
        .select("*")
        .eq("status", "active")
        .gte("received_at", start)
        .lte("received_at", end)
        .order("received_at", { ascending: false }),
      supabase
        .from("salesmen_invoice_payments")
        .select(
          "id, method, amount, received_at, sender_name, verification_status, status, advance_id, invoice_id, salesmen_invoices ( id, number, salesman_id )",
        )
        .eq("status", "active")
        .is("advance_id", null)
        .gte("received_at", start)
        .lte("received_at", end)
        .order("received_at", { ascending: false }),
      supabase
        .from("salesmen_returns")
        .select("id, total_amount, received_at, notes, verification_status, status, salesman_id")
        .eq("status", "active")
        .gte("received_at", start)
        .lte("received_at", end)
        .order("received_at", { ascending: false }),
      listExpensesForDay(supabase, start, end),
      supabase.from("salesmen").select("id, name, entity_type"),
    ]);

  if (advancesRes.error) throw advancesRes.error;
  if (paymentsRes.error) throw paymentsRes.error;
  if (returnsRes.error) throw returnsRes.error;
  if (partiesRes.error) throw partiesRes.error;

  const partyMap = new Map(
    (partiesRes.data ?? []).map((p) => [
      p.id as string,
      {
        name: p.name as string,
        entityType: p.entity_type as "customer" | "salesman",
      },
    ]),
  );

  const receipts: LedgerReceiptLine[] = [];

  for (const row of (advancesRes.data ?? []) as DbAdvanceRow[]) {
    const advance = mapAdvanceRow(row);
    const party = advance.salesmanId
      ? partyMap.get(advance.salesmanId)
      : undefined;
    const sourceCategory = (row as DbAdvanceRow & { source_category?: string })
      .source_category as LedgerReceiptSource | undefined;
    receipts.push({
      id: advance.id,
      kind: "advance",
      amount: advance.amount,
      method: advance.method,
      receivedAt: advance.receivedAt,
      partyId: advance.salesmanId || null,
      partyName: party?.name ?? (sourceCategory && sourceCategory !== "party_payment" ? sourceCategory.replace("_", " ") : null),
      partyType: party?.entityType ?? null,
      sourceCategory: sourceCategory ?? "party_payment",
      invoiceId: null,
      invoiceNumber: null,
      notes: advance.notes ?? null,
      verificationStatus: advance.verificationStatus ?? null,
      senderName: advance.senderName ?? null,
    });
  }

  for (const row of (paymentsRes.data ?? []) as DbPaymentWithInvoice[]) {
    const invoiceRaw = row.salesmen_invoices;
    const invoice = Array.isArray(invoiceRaw) ? invoiceRaw[0] : invoiceRaw;
    const party = invoice ? partyMap.get(invoice.salesman_id) : undefined;
    receipts.push({
      id: row.id,
      kind: "invoice_payment",
      amount: Number(row.amount),
      method: row.method,
      receivedAt: row.received_at ?? "",
      partyId: invoice?.salesman_id ?? null,
      partyName: party?.name ?? null,
      partyType: party?.entityType ?? null,
      sourceCategory: "party_payment",
      invoiceId: invoice?.id ?? null,
      invoiceNumber: invoice?.number ?? null,
      notes: null,
      verificationStatus: row.verification_status,
      senderName: row.sender_name,
    });
  }

  for (const row of (returnsRes.data ?? []) as DbReturnRow[]) {
    const party = partyMap.get(row.salesman_id);
    receipts.push({
      id: row.id,
      kind: "return" as LedgerReceiptKind,
      amount: -Number(row.total_amount),
      method: "cash",
      receivedAt: row.received_at,
      partyId: row.salesman_id,
      partyName: party?.name ?? null,
      partyType: party?.entityType ?? null,
      sourceCategory: "party_payment",
      invoiceId: null,
      invoiceNumber: null,
      notes: row.notes,
      verificationStatus: row.verification_status ?? null,
      senderName: null,
    });
  }

  receipts.sort(
    (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(),
  );

  const methodBreakdown: Record<InvoicePaymentMethod, number> = {
    cash: 0,
    cheque: 0,
    upi: 0,
    imps: 0,
  };

  let receiptsTotal = 0;
  let pendingVerificationCount = 0;

  for (const r of receipts) {
    receiptsTotal += r.amount;
    if (r.amount > 0) {
      methodBreakdown[r.method] =
        Math.round((methodBreakdown[r.method] + r.amount) * 100) / 100;
    }
    if (r.verificationStatus === "pending_verification") {
      pendingVerificationCount += 1;
    }
  }

  const expensesTotal = expenses.reduce((s, e) => s + e.amount, 0);

  return {
    date,
    receiptsTotal: Math.round(receiptsTotal * 100) / 100,
    expensesTotal: Math.round(expensesTotal * 100) / 100,
    netTotal: Math.round((receiptsTotal - expensesTotal) * 100) / 100,
    pendingVerificationCount,
    methodBreakdown,
    receipts,
    expenses: expenses.map((e) => ({
      id: e.id,
      category: e.category,
      payee: e.payee,
      amount: e.amount,
      method: e.method,
      paidAt: e.paidAt,
      notes: e.notes,
    })),
  };
}

export async function fetchLedgerDateRange(
  supabase: SupabaseClient,
  fromDate: string,
  toDate: string,
): Promise<DailyLedgerSummary[]> {
  const startBound = dayBounds(fromDate).start;
  const endBound = dayBounds(toDate).end;

  const dates: string[] = [];
  const cursor = new Date(dayBounds(fromDate).date);
  const end = new Date(dayBounds(toDate).date);
  while (cursor <= end) {
    dates.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`,
    );
    cursor.setDate(cursor.getDate() + 1);
  }

  const summaries: DailyLedgerSummary[] = [];
  for (const date of dates.reverse()) {
    summaries.push(await fetchDailyLedger(supabase, date));
  }

  // For range totals, also expose aggregate - caller can sum
  void startBound;
  void endBound;
  return summaries;
}
