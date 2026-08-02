"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { AppContext } from "@/app/(app)/layout";
import { TopBar } from "@/components/layout/AppShell";
import { AddExpenseModal } from "@/components/dashboard/AddExpenseModal";
import { AddLedgerReceiptModal } from "@/components/dashboard/AddLedgerReceiptModal";
import { WidgetKpi, WidgetSection } from "@/components/dashboard/WidgetKpi";
import type { BankAccount } from "@/lib/bank-accounts/types";
import type { DailyLedgerSummary } from "@/lib/ledger/types";
import { formatINR } from "@/lib/salesmen/mock-data";
import { useSyncedState } from "@/lib/realtime/use-synced-state";
import { useRealtimeRefresh } from "@/lib/realtime/use-realtime-refresh";

type PaymentsLedgerClientProps = {
  context: AppContext;
  initialSummaries: DailyLedgerSummary[];
  fromDate: string;
  toDate: string;
  bankAccounts: BankAccount[];
  canAddReceipt: boolean;
  canAddExpense: boolean;
};

export function PaymentsLedgerClient({
  context,
  initialSummaries,
  fromDate,
  toDate,
  bankAccounts,
  canAddReceipt,
  canAddExpense,
}: PaymentsLedgerClientProps) {
  const router = useRouter();
  const [summaries, setSummaries] = useSyncedState(initialSummaries);
  const [rangeFrom, setRangeFrom] = useState(fromDate);
  const [rangeTo, setRangeTo] = useState(toDate);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useRealtimeRefresh();

  const totals = summaries.reduce(
    (acc, day) => ({
      receipts: acc.receipts + day.receiptsTotal,
      expenses: acc.expenses + day.expensesTotal,
      net: acc.net + day.netTotal,
    }),
    { receipts: 0, expenses: 0, net: 0 },
  );

  const loadRange = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/payments/ledger?from=${encodeURIComponent(rangeFrom)}&to=${encodeURIComponent(rangeTo)}`,
      );
      const data = (await res.json()) as {
        summaries?: DailyLedgerSummary[];
      };
      if (data.summaries) {
        setSummaries(data.summaries);
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }, [rangeFrom, rangeTo, router, setSummaries]);

  function onEntryCreated() {
    void loadRange();
  }

  function shiftDay(delta: number) {
    const from = new Date(rangeFrom);
    const to = new Date(rangeTo);
    from.setDate(from.getDate() + delta);
    to.setDate(to.getDate() + delta);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setRangeFrom(fmt(from));
    setRangeTo(fmt(to));
  }

  return (
    <>
      <TopBar
        context={context}
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Payments" },
        ]}
      />
      <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-medium tracking-tight sm:text-2xl">
              Payment ledger
            </h1>
            <p className="mt-1 text-sm text-muted">
              Daily receipts and expenses history
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-sm font-medium underline underline-offset-2"
          >
            Back to dashboard
          </Link>
        </div>

        <WidgetSection title="Date range">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted">From</label>
              <input
                type="date"
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">To</label>
              <input
                type="date"
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
              />
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={() => void loadRange()}
              className="rounded-lg bg-foreground px-4 py-1.5 text-sm font-medium text-surface disabled:opacity-40"
            >
              Apply
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => shiftDay(-1)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm"
            >
              ← Prev day
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => shiftDay(1)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm"
            >
              Next day →
            </button>
            {canAddReceipt && (
              <button
                type="button"
                onClick={() => setReceiptOpen(true)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium"
              >
                + Receipt
              </button>
            )}
            {canAddExpense && (
              <button
                type="button"
                onClick={() => setExpenseOpen(true)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium"
              >
                + Expense
              </button>
            )}
          </div>

          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <WidgetKpi label="Total receipts" value={totals.receipts} />
            <WidgetKpi label="Total expenses" value={totals.expenses} />
            <WidgetKpi
              label="Net"
              value={totals.net}
              valueClass={totals.net >= 0 ? "text-emerald-700" : "text-[#c45c26]"}
            />
          </div>
        </WidgetSection>

        <div className="mt-5 space-y-4">
          {summaries.map((day) => (
            <WidgetSection
              key={day.date}
              title={day.date}
              description={`${day.receipts.length} receipts · ${day.expenses.length} expenses`}
            >
              <div className="mb-3 grid grid-cols-3 gap-2 text-sm">
                <span>Receipts: {formatINR(day.receiptsTotal)}</span>
                <span>Expenses: {formatINR(day.expensesTotal)}</span>
                <span className={day.netTotal >= 0 ? "text-emerald-700" : "text-[#c45c26]"}>
                  Net: {formatINR(day.netTotal)}
                </span>
              </div>
              <div className="max-h-48 space-y-1 overflow-y-auto text-sm">
                {day.receipts.map((r) => (
                  <div
                    key={`${r.kind}-${r.id}`}
                    className="flex justify-between gap-2 border-b border-border/50 py-1"
                  >
                    <span className="truncate">
                      {r.partyName ?? r.sourceCategory} · {r.kind}
                    </span>
                    <span className="tabular-nums">{formatINR(r.amount)}</span>
                  </div>
                ))}
                {day.expenses.map((e) => (
                  <div
                    key={e.id}
                    className="flex justify-between gap-2 border-b border-border/50 py-1 text-[#c45c26]"
                  >
                    <span className="truncate capitalize">
                      {e.category} {e.payee ? `· ${e.payee}` : ""}
                    </span>
                    <span className="tabular-nums">−{formatINR(e.amount)}</span>
                  </div>
                ))}
                {day.receipts.length === 0 && day.expenses.length === 0 && (
                  <p className="py-2 text-muted">No entries</p>
                )}
              </div>
            </WidgetSection>
          ))}
        </div>
      </main>

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
