"use client";

import { useEffect, useRef, useState } from "react";
import {
  formatINR,
  formatInvoiceDate,
} from "@/lib/salesmen/mock-data";
import type { Invoice } from "@/lib/salesmen/types";

type InvoiceListProps = {
  invoices: Invoice[];
  selectedId: string | null;
  onView: (invoice: Invoice) => void;
  onEdit: (invoice: Invoice) => void;
  onPrint: (invoice: Invoice) => void;
  onWhatsApp: (invoice: Invoice) => void;
};

type MenuState = { invoiceId: string; top: number; right: number } | null;

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
  onView,
  onEdit,
  onPrint,
  onWhatsApp,
}: InvoiceListProps) {
  const [menu, setMenu] = useState<MenuState>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu(null);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenu(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  if (invoices.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
        No invoices yet
      </div>
    );
  }

  const groups = groupByMonth(invoices);
  const openInvoice = invoices.find((i) => i.id === menu?.invoiceId);

  return (
    <div className="relative space-y-6">
      {groups.map((group) => (
        <section key={group.label}>
          <h3 className="mb-3 text-sm font-medium text-muted">{group.label}</h3>
          <div className="space-y-3">
            {group.items.map((invoice) => {
              const date = formatInvoiceDate(invoice.issuedAt);
              const selected = selectedId === invoice.id;
              return (
                <article
                  key={invoice.id}
                  className={`flex items-stretch overflow-hidden rounded-xl border bg-surface transition-colors ${
                    selected
                      ? "border-foreground/30 ring-1 ring-foreground/10"
                      : "border-border hover:border-foreground/15"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onView(invoice)}
                    className="flex min-w-0 flex-1 items-stretch text-left"
                  >
                    <div className="flex w-[4.5rem] shrink-0 flex-col items-center justify-center border-r border-border px-2 py-4 sm:w-20">
                      <span className="text-xs text-muted">{date.weekday}</span>
                      <span className="mt-0.5 text-2xl font-semibold tracking-tight text-[#c45c26]">
                        {date.day}
                      </span>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 px-3 py-3.5 sm:flex-row sm:items-center sm:gap-6 sm:px-4">
                      <div className="space-y-1.5 text-xs text-muted sm:w-36 sm:shrink-0">
                        <p className="flex items-center gap-1.5">
                          <ClockIcon />
                          <span>{date.time}</span>
                        </p>
                        <p className="flex items-center gap-1.5">
                          <ItemsIcon />
                          <span>
                            {invoice.itemCount} item
                            {invoice.itemCount === 1 ? "" : "s"}
                          </span>
                        </p>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {invoice.number}
                        </p>
                        <p className="mt-0.5 text-sm text-muted">
                          Paid{" "}
                          <span className="font-medium text-foreground">
                            {formatINR(invoice.amountPaid)}
                          </span>
                          {invoice.amountPaid < invoice.totalAmount && (
                            <span>
                              {" "}
                              of {formatINR(invoice.totalAmount)}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center border-l border-border px-1.5">
                    <button
                      type="button"
                      aria-label={`Actions for ${invoice.number}`}
                      aria-expanded={menu?.invoiceId === invoice.id}
                      aria-haspopup="menu"
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = (
                          e.currentTarget as HTMLButtonElement
                        ).getBoundingClientRect();
                        setMenu(
                          menu?.invoiceId === invoice.id
                            ? null
                            : {
                                invoiceId: invoice.id,
                                top: rect.bottom + 4,
                                right: window.innerWidth - rect.right,
                              },
                        );
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-sidebar hover:text-foreground"
                    >
                      <MoreIcon />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      {menu && openInvoice && (
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-40 min-w-[180px] rounded-lg border border-border bg-surface py-1 shadow-lg"
          style={{ top: menu.top, right: menu.right }}
        >
          <MenuItem
            label="View"
            onClick={() => {
              setMenu(null);
              onView(openInvoice);
            }}
          />
          <MenuItem
            label="Edit"
            onClick={() => {
              setMenu(null);
              onEdit(openInvoice);
            }}
          />
          <MenuItem
            label="Print"
            onClick={() => {
              setMenu(null);
              onPrint(openInvoice);
            }}
          />
          <MenuItem
            label="Share on WhatsApp"
            onClick={() => {
              setMenu(null);
              onWhatsApp(openInvoice);
            }}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="w-full px-3 py-2 text-left text-sm hover:bg-sidebar"
    >
      {label}
    </button>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="5.25" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M7 4.5V7l2 1.25"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ItemsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M2.5 3.5h9M2.5 7h9M2.5 10.5h6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="3.5" r="1.25" fill="currentColor" />
      <circle cx="8" cy="8" r="1.25" fill="currentColor" />
      <circle cx="8" cy="12.5" r="1.25" fill="currentColor" />
    </svg>
  );
}
