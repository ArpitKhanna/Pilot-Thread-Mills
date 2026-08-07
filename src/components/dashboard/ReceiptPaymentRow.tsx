"use client";

import { formatINR } from "@/lib/salesmen/mock-data";
import { MotionCard } from "@/components/ui/motion";

type ReceiptPaymentRowProps = {
  receiptsTotal: number;
  expensesTotal: number;
  onAddReceipt?: () => void;
  onAddExpense?: () => void;
};

export function ReceiptPaymentRow({
  receiptsTotal,
  expensesTotal,
  onAddReceipt,
  onAddExpense,
}: ReceiptPaymentRowProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      <MotionCard className="rounded-xl border border-border bg-surface px-4 py-3.5">
        <div className="flex items-start justify-between gap-2">
          <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
            Receipts
          </p>
          {onAddReceipt && (
            <button
              type="button"
              onClick={onAddReceipt}
              className="text-xs font-medium underline underline-offset-2"
            >
              Add
            </button>
          )}
        </div>
        <p className="mt-1 text-xl font-medium tabular-nums text-emerald-700 sm:text-2xl">
          {formatINR(receiptsTotal)}
        </p>
      </MotionCard>

      <MotionCard className="rounded-xl border border-border bg-surface px-4 py-3.5">
        <div className="flex items-start justify-between gap-2">
          <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
            Payments
          </p>
          {onAddExpense && (
            <button
              type="button"
              onClick={onAddExpense}
              className="text-xs font-medium underline underline-offset-2"
            >
              Add
            </button>
          )}
        </div>
        <p className="mt-1 text-xl font-medium tabular-nums text-red-600 sm:text-2xl">
          {formatINR(expensesTotal)}
        </p>
      </MotionCard>
    </div>
  );
}
