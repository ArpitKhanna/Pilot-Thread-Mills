"use client";

import { useState } from "react";
import { formatBankAccountLabel } from "@/lib/bank-accounts/mappers";
import type { BankAccount } from "@/lib/bank-accounts/types";
import {
  formatINR,
  formatInvoiceDate,
} from "@/lib/salesmen/mock-data";
import type {
  Invoice,
  InvoicePaymentEntry,
  InvoicePaymentMethod,
} from "@/lib/salesmen/types";

type PaymentsListProps = {
  invoices: Invoice[];
  bankAccounts: BankAccount[];
};

const METHOD_LABELS: Record<InvoicePaymentMethod, string> = {
  cash: "Cash",
  cheque: "Cheque",
  upi: "UPI",
  imps: "IMPS",
};

function groupByMonth(invoices: Invoice[]) {
  const groups: { label: string; items: Invoice[] }[] = [];
  for (const inv of invoices) {
    const label = formatInvoiceDate(inv.issuedAt).monthYear;
    const existing = groups.find((g) => g.label === label);
    if (existing) {
      existing.items.push(inv);
    } else {
      groups.push({ label, items: [inv] });
    }
  }
  return groups;
}

function invoicesWithPayments(invoices: Invoice[]): Invoice[] {
  return invoices.filter(
    (inv) =>
      inv.amountPaid > 0 ||
      (inv.paymentEntries != null && inv.paymentEntries.length > 0),
  );
}

export function PaymentsList({
  invoices,
  bankAccounts,
}: PaymentsListProps) {
  const paidInvoices = invoicesWithPayments(invoices);
  const [expandedId, setExpandedId] = useState<string | null>(
    () => paidInvoices[0]?.id ?? null,
  );

  const accountById = new Map(bankAccounts.map((a) => [a.id, a]));

  if (paidInvoices.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
        No payments recorded yet
      </div>
    );
  }

  const groups = groupByMonth(paidInvoices);

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.label}>
          <h3 className="mb-2 px-1 text-xs font-medium tracking-wide text-muted uppercase">
            {group.label}
          </h3>
          <ul className="space-y-1 rounded-xl border border-border bg-surface p-1">
            {group.items.map((invoice) => {
              const date = formatInvoiceDate(invoice.issuedAt);
              const expanded = expandedId === invoice.id;
              const entries = resolveEntries(invoice);
              const methodsSummary = summarizeMethods(entries);

              return (
                <li key={invoice.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(expanded ? null : invoice.id)
                    }
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors sm:gap-4 sm:px-3.5 ${
                      expanded
                        ? "bg-sidebar"
                        : "hover:bg-sidebar/60"
                    }`}
                    aria-expanded={expanded}
                  >
                    <div className="flex w-11 shrink-0 flex-col items-center sm:w-12">
                      <span className="text-[11px] text-muted">
                        {date.weekday}
                      </span>
                      <span className="text-xl font-semibold tracking-tight tabular-nums">
                        {date.day}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {invoice.number}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {date.time}
                        <span className="mx-1.5 text-border">·</span>
                        {methodsSummary}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <div className="text-right">
                        <p className="text-sm font-medium tabular-nums">
                          {formatINR(invoice.amountPaid)}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          {entries.length} payment
                          {entries.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <ChevronIcon open={expanded} />
                    </div>
                  </button>

                  {expanded && (
                    <div className="mx-1 mb-1 rounded-lg border border-border bg-[#fafaf8] px-3 py-3 sm:mx-1.5 sm:px-4">
                      <ul className="space-y-3">
                        {entries.map((entry, index) => {
                          const account = entry.depositAccountId
                            ? accountById.get(entry.depositAccountId)
                            : undefined;

                          return (
                            <li
                              key={entry.id}
                              className="border-b border-border pb-3 last:border-0 last:pb-0"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium">
                                    {METHOD_LABELS[entry.method]}
                                    <span className="ml-1.5 font-normal text-muted">
                                      #{index + 1}
                                    </span>
                                  </p>
                                  <dl className="mt-1.5 space-y-0.5 text-xs text-muted">
                                    {entry.method === "cheque" &&
                                      entry.chequeNumber && (
                                        <div>
                                          <dt className="inline">Cheque no. </dt>
                                          <dd className="inline text-foreground">
                                            {entry.chequeNumber}
                                          </dd>
                                        </div>
                                      )}
                                    {(entry.method === "upi" ||
                                      entry.method === "imps") &&
                                      entry.senderName && (
                                        <div>
                                          <dt className="inline">Sender </dt>
                                          <dd className="inline text-foreground">
                                            {entry.senderName}
                                          </dd>
                                        </div>
                                      )}
                                    {account && (
                                      <div>
                                        <dt className="inline">Account </dt>
                                        <dd className="inline text-foreground">
                                          {formatBankAccountLabel(account)}
                                        </dd>
                                      </div>
                                    )}
                                    {entry.depositAccountId && !account && (
                                      <div>
                                        <dt className="inline">Account </dt>
                                        <dd className="inline text-foreground">
                                          {entry.depositAccountId}
                                        </dd>
                                      </div>
                                    )}
                                    {entry.method === "cash" && (
                                      <div className="text-muted">
                                        Received in cash
                                      </div>
                                    )}
                                  </dl>
                                </div>
                                <p className="shrink-0 text-sm font-medium tabular-nums">
                                  {formatINR(entry.amount)}
                                </p>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function resolveEntries(invoice: Invoice): InvoicePaymentEntry[] {
  if (invoice.paymentEntries && invoice.paymentEntries.length > 0) {
    return invoice.paymentEntries;
  }
  if (invoice.amountPaid > 0) {
    return [
      {
        id: `${invoice.id}-paid`,
        method: "cash",
        amount: invoice.amountPaid,
      },
    ];
  }
  return [];
}

function summarizeMethods(entries: InvoicePaymentEntry[]): string {
  const counts = new Map<InvoicePaymentMethod, number>();
  for (const entry of entries) {
    counts.set(entry.method, (counts.get(entry.method) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([method, count]) =>
      count > 1
        ? `${METHOD_LABELS[method]} ×${count}`
        : METHOD_LABELS[method],
    )
    .join(", ");
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
