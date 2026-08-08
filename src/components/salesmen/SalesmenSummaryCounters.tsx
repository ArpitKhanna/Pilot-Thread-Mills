"use client";

import { useMemo, useState } from "react";
import {
  formatINR,
  resolveDateRange,
  summarizePurchasesAndPayments,
} from "@/lib/salesmen/mock-data";
import type {
  InvoiceSummary,
  Salesman,
  SalesmenListTimePreset,
  TimeRangePreset,
} from "@/lib/salesmen/types";

type SalesmenSummaryCountersProps = {
  salesmen: Salesman[];
  invoiceSummaries: InvoiceSummary[];
};

const RANGE_OPTIONS: { id: SalesmenListTimePreset; label: string }[] = [
  { id: "max", label: "All time" },
  { id: "week", label: "Last week" },
  { id: "month", label: "Last month" },
  { id: "6m", label: "Last 6 months" },
];

export function SalesmenSummaryCounters({
  salesmen,
  invoiceSummaries,
}: SalesmenSummaryCountersProps) {
  const [rangePreset, setRangePreset] =
    useState<SalesmenListTimePreset>("max");

  const stats = useMemo(() => {
    const preset = rangePreset as TimeRangePreset;
    const range = resolveDateRange(preset);
    const summary = summarizePurchasesAndPayments(invoiceSummaries, range);

    const totalPending =
      rangePreset === "max"
        ? salesmen.reduce((sum, s) => sum + s.pendingBalance, 0)
        : Math.max(0, summary.pending);

    return {
      pending: totalPending,
      purchases: summary.purchases,
      payments: summary.payments,
    };
  }, [salesmen, invoiceSummaries, rangePreset]);

  return (
    <section className="mb-5 space-y-3 sm:mb-6">
      <div className="inline-flex w-full flex-wrap rounded-lg border border-border bg-surface p-0.5 sm:w-auto">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setRangePreset(opt.id)}
            className={`flex-1 rounded-md px-3 py-2 text-sm sm:flex-none sm:px-4 sm:py-1.5 ${
              rangePreset === opt.id
                ? "bg-sidebar font-medium"
                : "text-muted hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryKpi
          label="Total pending"
          amount={stats.pending}
          amountClass={stats.pending > 0 ? "text-warning" : undefined}
        />
        <SummaryKpi label="Total purchases" amount={stats.purchases} />
        <SummaryKpi label="Total payments" amount={stats.payments} />
      </div>
    </section>
  );
}

function SummaryKpi({
  label,
  amount,
  amountClass,
}: {
  label: string;
  amount: number;
  amountClass?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3.5">
      <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-medium tabular-nums sm:text-xl ${amountClass ?? ""}`}
      >
        {formatINR(amount)}
      </p>
    </div>
  );
}
