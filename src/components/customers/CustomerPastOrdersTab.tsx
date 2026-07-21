"use client";

import { PendingLink } from "@/components/ui/PendingLink";
import {
  CUSTOMER_ORDER_STATUS_LABELS,
  type CustomerOrder,
  type CustomerOrderStatus,
} from "@/lib/customer-orders/types";
import { formatINR, formatShortDate } from "@/lib/salesmen/mock-data";

type CustomerPastOrdersTabProps = {
  orders: CustomerOrder[];
  title?: string;
};

function statusTone(status: CustomerOrderStatus): string {
  switch (status) {
    case "draft":
      return "bg-sidebar text-muted";
    case "confirmed":
      return "bg-amber-50 text-amber-900";
    case "picking":
      return "bg-sky-50 text-sky-900";
    case "invoiced":
      return "bg-emerald-50 text-emerald-900";
    case "cancelled":
      return "bg-red-50 text-red-800";
    default:
      return "bg-sidebar text-muted";
  }
}

export function CustomerPastOrdersTab({
  orders,
  title = "Past Orders",
}: CustomerPastOrdersTabProps) {
  if (orders.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
        No {title.toLowerCase()}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-medium tracking-tight">
        {title} ({orders.length})
      </h2>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {orders.map((order) => (
          <li key={order.id}>
            <PendingLink
              href={`/orders/customers/${order.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-sidebar/50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {formatShortDate(order.orderDate)}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {order.lineCount} item{order.lineCount === 1 ? "" : "s"}
                  {order.deliveryByName
                    ? ` · Delivery: ${order.deliveryByName}`
                    : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusTone(order.status)}`}
                >
                  {CUSTOMER_ORDER_STATUS_LABELS[order.status]}
                </span>
                <span className="text-sm font-medium">
                  {formatINR(order.amount)}
                </span>
              </div>
            </PendingLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
