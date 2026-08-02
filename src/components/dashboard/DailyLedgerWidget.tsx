"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { BankAccount } from "@/lib/bank-accounts/types";
import type { DailyLedgerSummary } from "@/lib/ledger/types";
import { formatINR } from "@/lib/salesmen/mock-data";
import { useSyncedState } from "@/lib/realtime/use-synced-state";
import { AddExpenseModal } from "./AddExpenseModal";
import { AddLedgerReceiptModal } from "./AddLedgerReceiptModal";
import { WidgetKpi, WidgetSection } from "./WidgetKpi";

type DailyLedgerWidgetProps = {
  initialLedger: DailyLedgerSummary;
  bankAccounts: BankAccount[];
  canAddReceipt: boolean;
  canAddExpense: boolean;
};

const METHOD_LABELS = {
  cash: "Cash",
  cheque: "Cheque",
  upi: "UPI",
  imps: "IMPS",
} as const;

function kindLabel(kind: string): string {
  switch (kind) {
    case "advance":
      return "Advance";
    case "invoice_payment":
      return "Invoice";
    case "return":
      return "Return";
    default:
      return kind;
  }
}

export function DailyLedgerWidget({
  initialLedger,
  bankAccounts,
  canAddReceipt,
  canAddExpense,
}: DailyLedgerWidgetProps) {
  const router = useRouter();
  const [ledger, setLedger] = useSyncedState(initialLedger);
  const [date, setDate] = useState(initialLedger.date);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async (nextDate?: string) => {
    const d = nextDate ?? date;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/dashboard/ledger?date=${encodeURIComponent(d)}`,
      );
      const data = (await res.json()) as {
        ledger?: DailyLedgerSummary;
        error?: string;
      };
      if (data.ledger) {
        setLedger(data.ledger);
      }
    } finally {
      setLoading(false);
    }
  }, [date, setLedger]);

  async function handleDateChange(next: string) {
    setDate(next);
    await refresh(next);
  }

  function onEntryCreated() {
    void refresh();
    router.refresh();
  }

  return (
    <>
      <WidgetSection
        title="Daily ledger"
        description="Receipts and expenses for the selected day"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={date}
              max={new Date().toISOString().slice(0, 10)}
              disabled={loading}
              onChange={(e) => void handleDateChange(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
            />
            {canAddReceipt && (
              <button
                type="button"
                onClick={() => setReceiptOpen(true)}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:bg-sidebar"
              >
                + Receipt
              </button>
            )}
            {canAddExpense && (
              <button
                type="button"
                onClick={() => setExpenseOpen(true)}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:bg-sidebar"
              >
                + Expense
              </button>
            )}
            <Link
              href="/payments"
              className="text-sm font-medium underline underline-offset-2"
            >
              History
            </Link>
          </div>
        }
      >
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <WidgetKpi label="Receipts" value={ledger.receiptsTotal} />
          <WidgetKpi label="Expenses" value={ledger.expensesTotal} />
          <WidgetKpi
            label="Net"
            value={ledger.netTotal}
            valueClass={
              ledger.netTotal >= 0 ? "text-emerald-700" : "text-[#c45c26]"
            }
          />
        </div>

        {ledger.pendingVerificationCount > 0 && (
          <p className="mb-3 text-sm text-amber-800">
            {ledger.pendingVerificationCount} receipt
            {ledger.pendingVerificationCount === 1 ? "" : "s"} pending
            verification
          </p>
        )}

        <div className="mb-4 flex flex-wrap gap-2">
          {(Object.keys(METHOD_LABELS) as Array<keyof typeof METHOD_LABELS>).map(
            (m) =>
              ledger.methodBreakdown[m] > 0 ? (
                <span
                  key={m}
                  className="rounded-full border border-border bg-sidebar px-2.5 py-1 text-xs text-muted"
                >
                  {METHOD_LABELS[m]}: {formatINR(ledger.methodBreakdown[m])}
                </span>
              ) : null,
          )}
        </div>

        <div className="max-h-72 space-y-2 overflow-y-auto">
          {ledger.receipts.length === 0 && ledger.expenses.length === 0 && (
            <p className="py-6 text-center text-sm text-muted">
              No entries for this day.
            </p>
          )}

          {ledger.receipts.map((line) => (
            <div
              key={`${line.kind}-${line.id}`}
              className="flex items-start justify-between gap-3 rounded-lg border border-border/70 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {line.partyName ?? line.sourceCategory.replace("_", " ")}
                  {line.invoiceNumber ? ` · ${line.invoiceNumber}` : ""}
                </p>
                <p className="text-xs text-muted">
                  {kindLabel(line.kind)} · {METHOD_LABELS[line.method]}
                  {line.verificationStatus === "pending_verification"
                    ? " · pending verification"
                    : ""}
                </p>
              </div>
              <p
                className={`shrink-0 tabular-nums font-medium ${
                  line.amount < 0 ? "text-[#c45c26]" : ""
                }`}
              >
                {formatINR(line.amount)}
              </p>
            </div>
          ))}

          {ledger.expenses.map((line) => (
            <div
              key={line.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-red-100 bg-red-50/40 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium capitalize">
                  {line.category.replace("_", " ")}
                  {line.payee ? ` · ${line.payee}` : ""}
                </p>
                <p className="text-xs text-muted">
                  Expense · {METHOD_LABELS[line.method]}
                </p>
              </div>
              <p className="shrink-0 tabular-nums font-medium text-[#c45c26]">
                −{formatINR(line.amount)}
              </p>
            </div>
          ))}
        </div>
      </WidgetSection>

      {canAddReceipt && (
        <AddLedgerReceiptModal
          open={receiptOpen}
          onClose={() => setReceiptOpen(false)}
          bankAccounts={bankAccounts}
          onCreated={onEntryCreated}
        />
      )}
      {canAddExpense && (
        <AddExpenseModal
          open={expenseOpen}
          onClose={() => setExpenseOpen(false)}
          onCreated={onEntryCreated}
        />
      )}
    </>
  );
}
