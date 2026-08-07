"use client";

import Link from "next/link";
import { formatINR } from "@/lib/salesmen/mock-data";
import { MotionCard } from "@/components/ui/motion";

type NetBalanceCardProps = {
  date: string;
  netTotal: number;
  receiptsTotal: number;
  expensesTotal: number;
  loading: boolean;
  pendingVerificationCount: number;
  onDateChange: (date: string) => void;
  onAddReceipt?: () => void;
  onAddExpense?: () => void;
};

export function NetBalanceCard({
  date,
  netTotal,
  receiptsTotal,
  expensesTotal,
  loading,
  pendingVerificationCount,
  onDateChange,
  onAddReceipt,
  onAddExpense,
}: NetBalanceCardProps) {
  const netClass =
    netTotal > 0
      ? "text-emerald-700"
      : netTotal < 0
        ? "text-red-600"
        : "text-foreground";

  return (
    <MotionCard className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
            Net balance
          </p>
          <p className="mt-1 text-3xl font-medium tabular-nums sm:text-4xl">
            <span className={netClass}>{formatINR(netTotal)}</span>
          </p>
          <p className="mt-1 text-sm text-muted">
            {receiptsTotal > 0 || expensesTotal > 0
              ? `${formatINR(receiptsTotal)} in · ${formatINR(expensesTotal)} out`
              : "No activity for this day"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={date}
            max={new Date().toISOString().slice(0, 10)}
            disabled={loading}
            onChange={(e) => onDateChange(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
          />
          {onAddReceipt && (
            <button
              type="button"
              onClick={onAddReceipt}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium transition hover:bg-sidebar"
            >
              + Receipt
            </button>
          )}
          {onAddExpense && (
            <button
              type="button"
              onClick={onAddExpense}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium transition hover:bg-sidebar"
            >
              + Payment
            </button>
          )}
          <Link
            href="/payments"
            className="text-sm font-medium underline underline-offset-2"
          >
            History
          </Link>
        </div>
      </div>

      {pendingVerificationCount > 0 && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {pendingVerificationCount} receipt
          {pendingVerificationCount === 1 ? "" : "s"} pending verification
        </p>
      )}
    </MotionCard>
  );
}
