"use client";

import type { ReactNode } from "react";
import { formatINR } from "@/lib/salesmen/mock-data";
import type { PaymentBucket } from "./ledger-utils";
import { PAYMENT_BUCKET_LABELS } from "./ledger-utils";

type LedgerColumnProps = {
  title: string;
  total: number;
  totalLabel?: string;
  breakdown: Record<PaymentBucket, number>;
  action?: ReactNode;
  footer?: ReactNode;
  emptyMessage?: string;
  children: ReactNode;
};

export function LedgerColumn({
  title,
  total,
  totalLabel = "Total",
  breakdown,
  action,
  footer,
  emptyMessage = "No entries for this day.",
  children,
}: LedgerColumnProps) {
  const buckets: PaymentBucket[] = ["cash", "cheque", "bank"];

  return (
    <section className="flex min-h-[420px] flex-col rounded-xl border border-border bg-surface lg:min-h-[calc(100dvh-10rem)]">
      <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3 sm:px-5">
        <h2 className="text-base font-medium sm:text-lg">{title}</h2>
        {action}
      </div>

      <div className="border-b border-border px-4 py-4 text-center sm:px-5">
        <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
          {totalLabel}
        </p>
        <p className="mt-1 text-2xl font-medium tabular-nums sm:text-3xl">
          {formatINR(total)}
        </p>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
        {buckets.map((bucket) => (
          <div key={bucket} className="px-2 py-3 text-center sm:px-3">
            <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
              {PAYMENT_BUCKET_LABELS[bucket]}
            </p>
            <p className="mt-1 text-sm font-medium tabular-nums sm:text-base">
              {formatINR(breakdown[bucket])}
            </p>
          </div>
        ))}
      </div>

      {footer}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
        {children}
        {!children && (
          <p className="py-8 text-center text-sm text-muted">{emptyMessage}</p>
        )}
      </div>
    </section>
  );
}

export function LedgerLineItem({
  title,
  subtitle,
  amount,
  amountClass,
  variant = "default",
}: {
  title: string;
  subtitle?: string;
  amount: number;
  amountClass?: string;
  variant?: "default" | "expense";
}) {
  return (
    <div
      className={`mb-2 flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm last:mb-0 ${
        variant === "expense"
          ? "border-red-100 bg-red-50/40"
          : "border-border/70"
      }`}
    >
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
      </div>
      <p
        className={`shrink-0 tabular-nums font-medium ${amountClass ?? ""}`}
      >
        {formatINR(amount)}
      </p>
    </div>
  );
}
