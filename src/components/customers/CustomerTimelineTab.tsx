"use client";

import { useMemo } from "react";
import { PendingLink } from "@/components/ui/PendingLink";
import {
  CUSTOMER_ORDER_STATUS_LABELS,
  type CustomerOrder,
} from "@/lib/customer-orders/types";
import {
  formatINR,
  formatInvoiceDate,
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

type TimelineKind = "order" | "payment" | "invoice";

type TimelineEvent = {
  id: string;
  kind: TimelineKind;
  at: number;
  dateLabel: string;
  title: string;
  subtitle: string;
  amount: number | null;
  href: string | null;
  tone: string;
};

const METHOD_LABELS: Record<InvoicePaymentMethod, string> = {
  cash: "Cash",
  cheque: "Cheque",
  upi: "UPI",
  imps: "IMPS",
};

function kindLabel(kind: TimelineKind): string {
  switch (kind) {
    case "order":
      return "Order";
    case "payment":
      return "Payment";
    case "invoice":
      return "Invoice";
  }
}

function kindTone(kind: TimelineKind): string {
  switch (kind) {
    case "order":
      return "bg-sky-50 text-sky-900";
    case "payment":
      return "bg-emerald-50 text-emerald-900";
    case "invoice":
      return "bg-amber-50 text-amber-900";
  }
}

function orderTimestamp(order: CustomerOrder): number {
  const created = Date.parse(order.createdAt);
  if (Number.isFinite(created)) return created;
  const day = Date.parse(order.orderDate);
  return Number.isFinite(day) ? day : 0;
}

function buildTimeline(
  orders: CustomerOrder[],
  invoices: Invoice[],
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const order of orders) {
    if (order.status === "cancelled") continue;
    const at = orderTimestamp(order);
    events.push({
      id: `order-${order.id}`,
      kind: "order",
      at,
      dateLabel: formatShortDate(order.orderDate),
      title: `Order · ${CUSTOMER_ORDER_STATUS_LABELS[order.status]}`,
      subtitle: [
        `${order.lineCount} item${order.lineCount === 1 ? "" : "s"}`,
        order.deliveryByName ? `Delivery: ${order.deliveryByName}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      amount: order.amount,
      href: `/orders/customers/${order.id}`,
      tone: kindTone("order"),
    });
  }

  for (const invoice of invoices) {
    const issued = Date.parse(invoice.issuedAt);
    const at = Number.isFinite(issued) ? issued : 0;
    const date = formatInvoiceDate(invoice.issuedAt);

    events.push({
      id: `invoice-${invoice.id}`,
      kind: "invoice",
      at,
      dateLabel: formatShortDate(invoice.issuedAt),
      title: `Invoice ${invoice.number}`,
      subtitle: `${date.time} · ${invoice.itemCount} item${invoice.itemCount === 1 ? "" : "s"}`,
      amount: invoice.totalAmount,
      href: `/orders/salesmen/${invoice.id}/edit`,
      tone: kindTone("invoice"),
    });

    const entries =
      invoice.paymentEntries && invoice.paymentEntries.length > 0
        ? invoice.paymentEntries
        : invoice.amountPaid > 0
          ? [
              {
                id: `${invoice.id}-paid`,
                method: "cash" as const,
                amount: invoice.amountPaid,
              },
            ]
          : [];

    for (const entry of entries) {
      if (!(entry.amount > 0)) continue;
      events.push({
        id: `payment-${invoice.id}-${entry.id}`,
        kind: "payment",
        at: at + 1,
        dateLabel: formatShortDate(invoice.issuedAt),
        title: `Payment · ${METHOD_LABELS[entry.method] ?? entry.method}`,
        subtitle: `Against ${invoice.number}${
          entry.senderName ? ` · ${entry.senderName}` : ""
        }${entry.chequeNumber ? ` · Chq ${entry.chequeNumber}` : ""}`,
        amount: entry.amount,
        href: `/orders/salesmen/${invoice.id}/edit`,
        tone: kindTone("payment"),
      });
    }
  }

  return events.sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
}

function groupByMonth(events: TimelineEvent[]) {
  const groups: { label: string; items: TimelineEvent[] }[] = [];
  for (const event of events) {
    const label = new Date(event.at).toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });
    const existing = groups.find((g) => g.label === label);
    if (existing) existing.items.push(event);
    else groups.push({ label, items: [event] });
  }
  return groups;
}

export function CustomerTimelineTab({
  orders,
  invoices,
}: CustomerTimelineTabProps) {
  const events = useMemo(
    () => buildTimeline(orders, invoices),
    [orders, invoices],
  );
  const groups = useMemo(() => groupByMonth(events), [events]);

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
        No activity yet
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-medium tracking-tight">Timeline</h2>
        <p className="mt-1 text-sm text-muted">
          Orders, invoices, and payments — newest first
        </p>
      </div>

      {groups.map((group) => (
        <section key={group.label}>
          <h3 className="mb-2 px-1 text-xs font-medium tracking-wide text-muted uppercase">
            {group.label}
          </h3>
          <ul className="relative space-y-0 overflow-hidden rounded-xl border border-border bg-surface">
            {group.items.map((event, index) => {
              const body = (
                <div className="flex items-start gap-3 px-4 py-3 sm:gap-4">
                  <div className="relative flex w-11 shrink-0 flex-col items-center pt-0.5 sm:w-12">
                    {index < group.items.length - 1 ? (
                      <span
                        className="absolute top-7 bottom-[-0.75rem] left-1/2 w-px -translate-x-1/2 bg-border"
                        aria-hidden
                      />
                    ) : null}
                    <span
                      className={`relative z-[1] rounded-full px-1.5 py-0.5 text-[10px] font-medium ${event.tone}`}
                    >
                      {kindLabel(event.kind).slice(0, 3)}
                    </span>
                    <span className="mt-1 text-center text-[11px] leading-tight text-muted">
                      {event.dateLabel}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{event.title}</p>
                    {event.subtitle ? (
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {event.subtitle}
                      </p>
                    ) : null}
                  </div>

                  {event.amount != null ? (
                    <p
                      className={`shrink-0 text-sm font-medium tabular-nums ${
                        event.kind === "payment"
                          ? "text-emerald-700"
                          : "text-foreground"
                      }`}
                    >
                      {event.kind === "payment" ? "+" : ""}
                      {formatINR(event.amount)}
                    </p>
                  ) : null}
                </div>
              );

              return (
                <li
                  key={event.id}
                  className="border-b border-border last:border-0"
                >
                  {event.href ? (
                    <PendingLink
                      href={event.href}
                      className="block transition-colors hover:bg-sidebar/50"
                    >
                      {body}
                    </PendingLink>
                  ) : (
                    body
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
