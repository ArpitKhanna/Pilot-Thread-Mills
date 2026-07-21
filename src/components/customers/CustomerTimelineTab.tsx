"use client";

import { useMemo } from "react";
import { PendingLink } from "@/components/ui/PendingLink";
import type { CustomerOrder } from "@/lib/customer-orders/types";
import {
  formatINR,
  formatShortDate,
} from "@/lib/salesmen/mock-data";
import type {
  Invoice,
  InvoicePaymentMethod,
} from "@/lib/salesmen/types";

type CustomerTimelineTabProps = {
  orders: CustomerOrder[];
  invoices: Invoice[];
};

type TimelineKind = "order" | "payment";

type TimelineChild = {
  id: string;
  label: string;
  detail?: string;
};

type TimelineEvent = {
  id: string;
  kind: TimelineKind;
  at: number;
  title: string;
  subtitle: string;
  href: string;
  tag: string;
  children: TimelineChild[];
};

const METHOD_LABELS: Record<InvoicePaymentMethod, string> = {
  cash: "Cash",
  cheque: "Cheque",
  upi: "UPI",
  imps: "IMPS",
};

const CONFIRMED_STATUSES = new Set([
  "confirmed",
  "picking",
  "invoiced",
]);

function orderTimestamp(order: CustomerOrder): number {
  const created = Date.parse(order.createdAt);
  if (Number.isFinite(created)) return created;
  const day = Date.parse(order.orderDate);
  return Number.isFinite(day) ? day : 0;
}

function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
      className="text-surface"
    >
      <path
        d="M2.5 6.2L4.8 8.5L9.5 3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function buildTimeline(
  orders: CustomerOrder[],
  invoices: Invoice[],
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const order of orders) {
    if (!CONFIRMED_STATUSES.has(order.status)) continue;
    const at = orderTimestamp(order);
    events.push({
      id: `order-${order.id}`,
      kind: "order",
      at,
      title: "Confirmed order",
      subtitle: [
        formatShortDate(order.orderDate),
        `${order.lineCount} item${order.lineCount === 1 ? "" : "s"}`,
        order.amount > 0 ? formatINR(order.amount) : null,
        order.deliveryByName ? `Delivery: ${order.deliveryByName}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      href: `/orders/customers/${order.id}`,
      tag: "Confirmed Order",
      children: order.lines.slice(0, 6).map((line) => ({
        id: line.id,
        label: line.itemName?.trim() || "Item",
        detail: [
          line.shadeCode.trim() ? `Shade ${line.shadeCode.trim()}` : null,
          `${line.qty}`,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    });
  }

  for (const invoice of invoices) {
    const issued = Date.parse(invoice.issuedAt);
    const at = Number.isFinite(issued) ? issued : 0;

    const entries =
      invoice.paymentEntries && invoice.paymentEntries.length > 0
        ? invoice.paymentEntries
        : invoice.amountPaid > 0
          ? [
              {
                id: `${invoice.id}-paid`,
                method: "cash" as const,
                amount: invoice.amountPaid,
                senderName: undefined as string | undefined,
                chequeNumber: undefined as string | undefined,
              },
            ]
          : [];

    for (const entry of entries) {
      if (!(entry.amount > 0)) continue;
      events.push({
        id: `payment-${invoice.id}-${entry.id}`,
        kind: "payment",
        at,
        title: "Payment received",
        subtitle: [
          formatShortDate(invoice.issuedAt),
          formatINR(entry.amount),
          METHOD_LABELS[entry.method] ?? entry.method,
          `Invoice ${invoice.number}`,
        ].join(" · "),
        href: `/orders/salesmen/${invoice.id}/edit`,
        tag: "Payment",
        children: [
          ...(entry.senderName
            ? [{ id: `${entry.id}-sender`, label: entry.senderName, detail: "Sender" }]
            : []),
          ...(entry.chequeNumber
            ? [
                {
                  id: `${entry.id}-chq`,
                  label: `Cheque ${entry.chequeNumber}`,
                },
              ]
            : []),
        ],
      });
    }
  }

  return events.sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
}

export function CustomerTimelineTab({
  orders,
  invoices,
}: CustomerTimelineTabProps) {
  const events = useMemo(
    () => buildTimeline(orders, invoices),
    [orders, invoices],
  );

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
        No confirmed orders or payments yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium tracking-tight">Timeline</h2>
        <p className="mt-1 text-sm text-muted">
          Confirmed orders and payments — newest first
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface px-4 py-2 sm:px-5">
        <ul>
          {events.map((event, index) => {
            const isLast = index === events.length - 1;
            const tagDot =
              event.kind === "payment" ? "bg-emerald-500" : "bg-sky-500";

            return (
              <li key={event.id} className="relative flex gap-3 sm:gap-4">
                {/* Rail */}
                <div className="relative flex w-5 shrink-0 flex-col items-center">
                  {!isLast ? (
                    <span
                      className="absolute top-5 bottom-0 left-1/2 w-px -translate-x-1/2 bg-border"
                      aria-hidden
                    />
                  ) : null}
                  <span className="relative z-[1] mt-3 flex h-5 w-5 items-center justify-center rounded-full bg-foreground/55">
                    <CheckIcon />
                  </span>
                </div>

                <PendingLink
                  href={event.href}
                  className={`min-w-0 flex-1 py-3 transition-colors hover:opacity-90 ${
                    isLast ? "" : "border-b border-border/70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold tracking-tight text-foreground">
                        {event.title}
                      </p>
                      <p className="mt-0.5 text-sm text-muted">
                        {event.subtitle}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${tagDot}`}
                        aria-hidden
                      />
                      {event.tag}
                    </span>
                  </div>

                  {event.children.length > 0 ? (
                    <ul className="mt-3 space-y-2 border-l border-border pl-4 ml-0.5">
                      {event.children.map((child) => (
                        <li
                          key={child.id}
                          className="relative text-sm text-muted"
                        >
                          <span
                            className="absolute top-2.5 -left-4 h-px w-3 bg-border"
                            aria-hidden
                          />
                          <span className="font-medium text-foreground/90">
                            {child.label}
                          </span>
                          {child.detail ? (
                            <span className="text-muted"> · {child.detail}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </PendingLink>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
