"use client";

import { useMemo, useState } from "react";
import {
  formatINR,
  formatInvoiceDate,
} from "@/lib/salesmen/mock-data";
import type { Invoice } from "@/lib/salesmen/types";

type InvoiceListProps = {
  invoices: Invoice[];
  selectedId: string | null;
  onSelect: (invoice: Invoice) => void;
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

export function InvoiceList({
  invoices,
  selectedId,
  onSelect,
}: InvoiceListProps) {
  if (invoices.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
        No invoices yet
      </div>
    );
  }

  const groups = groupByMonth(invoices);

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.label}>
          <h3 className="mb-2 px-1 text-xs font-medium tracking-wide text-muted uppercase">
            {group.label}
          </h3>
          <ul className="overflow-hidden rounded-xl border border-border bg-surface">
            {group.items.map((invoice, index) => {
              const date = formatInvoiceDate(invoice.issuedAt);
              const selected = selectedId === invoice.id;
              const balance = invoice.totalAmount - invoice.amountPaid;

              return (
                <li
                  key={invoice.id}
                  className={
                    index > 0 ? "border-t border-border" : undefined
                  }
                >
                  <button
                    type="button"
                    onClick={() => onSelect(invoice)}
                    className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors sm:gap-4 sm:px-4 ${
                      selected
                        ? "bg-[#fff7f0] ring-2 ring-inset ring-[#e86f2a]"
                        : "hover:bg-sidebar/50"
                    }`}
                  >
                    <div className="flex w-11 shrink-0 flex-col items-center sm:w-12">
                      <span className="text-[11px] text-muted">
                        {date.weekday}
                      </span>
                      <span
                        className={`text-xl font-semibold tracking-tight tabular-nums ${
                          selected ? "text-[#e86f2a]" : "text-foreground"
                        }`}
                      >
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
                        {invoice.itemCount} item
                        {invoice.itemCount === 1 ? "" : "s"}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium tabular-nums">
                        {formatINR(invoice.totalAmount)}
                      </p>
                      <p
                        className={`mt-0.5 text-xs tabular-nums ${
                          balance > 0 ? "text-[#c45c26]" : "text-muted"
                        }`}
                      >
                        {balance > 0
                          ? `${formatINR(balance)} due`
                          : "Paid"}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
