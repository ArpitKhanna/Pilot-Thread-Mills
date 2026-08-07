"use client";

import { formatINR } from "@/lib/salesmen/mock-data";

type ReceiptPaymentRowProps = {
  receiptsTotal: number;
  expensesTotal: number;
};

export function ReceiptPaymentRow({
  receiptsTotal,
  expensesTotal,
}: ReceiptPaymentRowProps) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1">
          <p className="flex-1 font-mono text-sm tracking-[0.1em] text-muted uppercase">
            Receipts
          </p>
          <p className="text-base font-medium tabular-nums text-credit">
            {formatINR(receiptsTotal)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <p className="flex-1 font-mono text-sm tracking-[0.1em] text-muted uppercase">
            Payments
          </p>
          <p className="text-base font-medium tabular-nums text-debit">
            {formatINR(expensesTotal)}
          </p>
        </div>
      </div>
      <hr className="h-px shrink-0 border-0 bg-border" />
    </>
  );
}
