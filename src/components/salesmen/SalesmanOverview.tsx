"use client";

import { useMemo, useState } from "react";
import { buildOverviewInsights } from "@/lib/salesmen/insights";
import { formatINR } from "@/lib/salesmen/mock-data";
import type {
  Invoice,
  InvoicePaymentMethod,
  TimeRangePreset,
} from "@/lib/salesmen/types";

type SalesmanOverviewProps = {
  invoices: Invoice[];
};

const RANGE_OPTIONS: { id: TimeRangePreset; label: string }[] = [
  { id: "month", label: "1M" },
  { id: "6m", label: "6M" },
  { id: "1y", label: "1Y" },
  { id: "max", label: "Max" },
];

const METHOD_LABELS: Record<InvoicePaymentMethod, string> = {
  cash: "Cash",
  cheque: "Cheque",
  upi: "UPI",
  imps: "IMPS",
};

const METHOD_COLORS: Record<InvoicePaymentMethod, string> = {
  cash: "#2f6f4e",
  upi: "#e86f2a",
  imps: "#3b6ea5",
  cheque: "#8a6d3b",
};

export function SalesmanOverview({ invoices }: SalesmanOverviewProps) {
  const [rangePreset, setRangePreset] = useState<TimeRangePreset>("6m");

  const insights = useMemo(
    () => buildOverviewInsights(invoices, rangePreset),
    [invoices, rangePreset],
  );

  const maxBar = Math.max(
    1,
    ...insights.monthlyTrend.flatMap((p) => [p.purchases, p.payments]),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-medium tracking-tight">Overview</h2>
          <p className="mt-0.5 text-sm text-muted">
            Purchase and payment trends for this salesman
          </p>
        </div>
        <div className="inline-flex flex-wrap rounded-lg border border-border bg-surface p-0.5">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setRangePreset(opt.id)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                rangePreset === opt.id
                  ? "bg-sidebar font-medium"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Purchases" amount={insights.summary.purchases} />
        <Kpi label="Payments" amount={insights.summary.payments} />
        <Kpi
          label="Net change"
          amount={insights.summary.netChange}
          amountClass={
            insights.summary.netChange > 0
              ? "text-[#c45c26]"
              : insights.summary.netChange < 0
                ? "text-emerald-700"
                : undefined
          }
        />
        <Kpi
          label="Period pending"
          amount={Math.max(0, insights.summary.pending)}
          amountClass={
            insights.summary.pending > 0 ? "text-[#c45c26]" : undefined
          }
        />
      </div>

      <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
          Purchase vs payment trend
        </p>
        {insights.monthlyTrend.length === 0 ||
        insights.monthlyTrend.every(
          (p) => p.purchases === 0 && p.payments === 0,
        ) ? (
          <EmptyInsight text="No invoice activity in this period" />
        ) : (
          <>
            <div
              className="mt-4 flex h-44 items-end gap-1.5 sm:gap-2"
              role="img"
              aria-label="Monthly purchases and payments"
            >
              {insights.monthlyTrend.map((point) => (
                <div
                  key={point.key}
                  className="flex min-w-0 flex-1 flex-col items-center gap-1"
                >
                  <div className="flex h-36 w-full items-end justify-center gap-0.5 sm:gap-1">
                    <div
                      className="w-[42%] max-w-5 rounded-t-sm bg-[#f8d4b8]"
                      style={{
                        height:
                          point.purchases > 0
                            ? `${Math.max(2, (point.purchases / maxBar) * 100)}%`
                            : "0%",
                      }}
                      title={`Purchases ${formatINR(point.purchases)}`}
                    />
                    <div
                      className="w-[42%] max-w-5 rounded-t-sm bg-[#e86f2a]"
                      style={{
                        height:
                          point.payments > 0
                            ? `${Math.max(2, (point.payments / maxBar) * 100)}%`
                            : "0%",
                      }}
                      title={`Payments ${formatINR(point.payments)}`}
                    />
                  </div>
                  <span className="truncate text-[10px] text-muted">
                    {point.label}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
              <LegendDot className="bg-[#f8d4b8]" label="Purchases" />
              <LegendDot className="bg-[#e86f2a]" label="Payments" />
            </div>
          </>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
            Payment methods
          </p>
          {insights.paymentMethods.length === 0 ? (
            <EmptyInsight text="No payments recorded in this period" />
          ) : (
            <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center">
              <MethodDonut methods={insights.paymentMethods} />
              <ul className="min-w-0 flex-1 space-y-2.5">
                {insights.paymentMethods.map((row) => (
                  <li
                    key={row.method}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: METHOD_COLORS[row.method] }}
                      />
                      <span className="truncate">
                        {METHOD_LABELS[row.method]}
                      </span>
                      <span className="text-xs text-muted tabular-nums">
                        {row.pct}%
                      </span>
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {formatINR(row.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
            Top items purchased
          </p>
          {insights.topItems.length === 0 ? (
            <EmptyInsight text="No purchase lines in this period" />
          ) : (
            <ul className="mt-4 space-y-3">
              {insights.topItems.map((item, index) => (
                <li key={item.name}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">
                      <span className="mr-1.5 text-muted tabular-nums">
                        {index + 1}.
                      </span>
                      {item.name}
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {formatINR(item.amount)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#f5f0eb]">
                      <div
                        className="h-full rounded-full bg-[#c45c26]/80"
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-[11px] text-muted tabular-nums">
                      {item.qty} pcs
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Kpi({
  label,
  amount,
  amountClass,
}: {
  label: string;
  amount: number;
  amountClass?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-3 sm:px-4">
      <p className="text-xs text-muted">{label}</p>
      <p
        className={`mt-1 text-base font-medium tabular-nums sm:text-lg ${amountClass ?? ""}`}
      >
        {formatINR(amount)}
      </p>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-full ${className}`} />
      {label}
    </span>
  );
}

function EmptyInsight({ text }: { text: string }) {
  return <p className="mt-6 text-sm text-muted">{text}</p>;
}

function MethodDonut({
  methods,
}: {
  methods: { method: InvoicePaymentMethod; amount: number; pct: number }[];
}) {
  const size = 120;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="mx-auto shrink-0"
      aria-hidden
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#f5f0eb"
        strokeWidth={stroke}
      />
      {methods.map((row) => {
        const len = (row.pct / 100) * c;
        const el = (
          <circle
            key={row.method}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={METHOD_COLORS[row.method]}
            strokeWidth={stroke}
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
        offset += len;
        return el;
      })}
    </svg>
  );
}
